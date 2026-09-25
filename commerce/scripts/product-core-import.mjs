import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  EXPECTED_CATALOG_BLOB,
  EXPECTED_PRODUCT_COUNT,
  buildImportSql,
  loadFrozenCatalogue,
} from "./product-core-lib.mjs";

const args = new Set(process.argv.slice(2));
const remote = args.has("--remote");
const envIndex = process.argv.indexOf("--env");
const environment = envIndex >= 0 ? process.argv[envIndex + 1] : null;

if (!remote || environment !== "staging") {
  throw new Error(
    "Phase 1 importer is staging-only. Run with --remote --env staging.",
  );
}

function runWrangler(extraArgs, expectJson = false) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(
    command,
    ["--no-install", "wrangler", "d1", "execute", "DB", "--remote", "--env", "staging", ...extraArgs],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `Wrangler failed (exit ${result.status}).\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }

  if (!expectJson) return result.stdout ?? "";

  const raw = (result.stdout ?? "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Could not parse Wrangler JSON output:\n${raw}`);
  }
}

function firstScalar(payload, key) {
  const block = Array.isArray(payload) ? payload[0] : payload;
  const row = block?.results?.[0];
  return Number(row?.[key] ?? 0);
}

const { items, blob } = loadFrozenCatalogue();

const existing = runWrangler(
  [
    "--command",
    "SELECT COUNT(*) AS product_count FROM products; SELECT COUNT(*) AS non_import_events FROM product_audit_events WHERE event_type <> 'PRODUCT_IMPORTED' OR actor_id <> 'catalogue-import';",
    "--json",
  ],
  true,
);

const blocks = Array.isArray(existing) ? existing : [];
const existingProductCount = Number(blocks[0]?.results?.[0]?.product_count ?? 0);
const nonImportEvents = Number(blocks[1]?.results?.[0]?.non_import_events ?? 0);

if (nonImportEvents > 0) {
  throw new Error(
    "Staging Product Core contains non-import owner/system changes. Refusing destructive Phase 1 re-import.",
  );
}

const tempDir = mkdtempSync(join(tmpdir(), "black-sheep-product-core-"));
const sqlFile = join(tempDir, "product-core-import.sql");

try {
  writeFileSync(sqlFile, buildImportSql(items), "utf8");
  runWrangler(["--file", sqlFile]);

  const verify = runWrangler(
    [
      "--command",
      "SELECT COUNT(*) AS product_count FROM products; SELECT COUNT(*) AS variant_count FROM product_variants; SELECT COUNT(*) AS imported_events FROM product_audit_events WHERE event_type='PRODUCT_IMPORTED';",
      "--json",
    ],
    true,
  );
  const verifyBlocks = Array.isArray(verify) ? verify : [];
  const productCount = Number(verifyBlocks[0]?.results?.[0]?.product_count ?? -1);
  const variantCount = Number(verifyBlocks[1]?.results?.[0]?.variant_count ?? -1);
  const importedEvents = Number(verifyBlocks[2]?.results?.[0]?.imported_events ?? -1);

  if (
    productCount !== EXPECTED_PRODUCT_COUNT ||
    variantCount !== EXPECTED_PRODUCT_COUNT ||
    importedEvents !== EXPECTED_PRODUCT_COUNT
  ) {
    throw new Error(
      `Import count mismatch: products=${productCount}, variants=${variantCount}, audit=${importedEvents}.`,
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        environment: "staging",
        sourceBlob: blob,
        previousProductCount: existingProductCount,
        productCount,
        variantCount,
        importedEvents,
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
