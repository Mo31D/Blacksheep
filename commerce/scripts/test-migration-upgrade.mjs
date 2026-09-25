import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const commerceRoot = process.cwd();
const sourceMigrations = resolve(commerceRoot, "migrations");
const tempRoot = mkdtempSync(join(tmpdir(), "black-sheep-d1-upgrade-"));
const tempMigrations = join(tempRoot, "migrations");
const persistDir = join(tempRoot, "state");
const configPath = join(tempRoot, "wrangler-upgrade-test.json");

function runWrangler(args) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(
    command,
    ["--no-install", "wrangler", ...args],
    {
      cwd: commerceRoot,
      encoding: "utf8",
      env: process.env,
    },
  );

  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(
      `Wrangler command failed (exit ${result.status}): ${args.join(" ")}\n${detail}`,
    );
  }

  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

function copyMigration(fileName) {
  copyFileSync(
    join(sourceMigrations, fileName),
    join(tempMigrations, fileName),
  );
}

try {
  mkdirSync(tempMigrations, { recursive: true });
  mkdirSync(persistDir, { recursive: true });

  writeFileSync(
    configPath,
    JSON.stringify(
      {
        name: "black-sheep-commerce-upgrade-test",
        main: resolve(commerceRoot, "src/index.ts"),
        compatibility_date: "2026-09-24",
        d1_databases: [
          {
            binding: "DB",
            database_name: "black-sheep-commerce-upgrade-test",
            database_id: "d442b45d-93b6-4535-b76a-4b72e62dc271",
            migrations_dir: "migrations",
          },
        ],
      },
      null,
      2,
    ),
  );

  const allMigrations = readdirSync(sourceMigrations)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();

  const baselineMigrations = allMigrations.filter(
    (name) => !name.startsWith("0008_"),
  );
  const hardeningMigration = allMigrations.find((name) =>
    name.startsWith("0008_"),
  );

  if (!hardeningMigration) {
    throw new Error("Expected 0008 concurrency migration was not found.");
  }
  if (
    baselineMigrations.length === 0 ||
    baselineMigrations.at(-1)?.startsWith("0007_") !== true
  ) {
    throw new Error(
      "Upgrade baseline must contain the ordered 0000–0007 migration set.",
    );
  }

  for (const fileName of baselineMigrations) {
    copyMigration(fileName);
  }

  runWrangler([
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--config",
    configPath,
    "--persist-to",
    persistDir,
  ]);

  copyMigration(hardeningMigration);

  runWrangler([
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--config",
    configPath,
    "--persist-to",
    persistDir,
  ]);

  const schemaQueries = [
    "SELECT mutation_token FROM order_revisions LIMIT 0",
    "SELECT refund_version, refund_mutation_token FROM orders LIMIT 0",
    "SELECT idempotency_key FROM refunds LIMIT 0",
    "SELECT claim_token FROM email_webhook_events LIMIT 0",
  ];

  for (const sql of schemaQueries) {
    runWrangler([
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      configPath,
      "--persist-to",
      persistDir,
      "--command",
      sql,
    ]);
  }

  const indexOutput = runWrangler([
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    configPath,
    "--persist-to",
    persistDir,
    "--command",
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_refunds_order_idempotency'",
  ]);

  if (!indexOutput.includes("idx_refunds_order_idempotency")) {
    throw new Error("Refund idempotency index was not present after the 0008 upgrade.");
  }

  console.log(
    "PASS: migrations 0000–0007 upgraded cleanly to 0008 and concurrency guard schema is present.",
  );
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
