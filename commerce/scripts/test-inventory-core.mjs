import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const commerceRoot = process.cwd();
const tempRoot = mkdtempSync(join(tmpdir(), "black-sheep-inventory-core-"));
const persistDir = join(tempRoot, "state");
const migrationsDir = join(tempRoot, "migrations");
const configPath = join(tempRoot, "wrangler-inventory-test.json");

function wrangler(args, expectSuccess = true) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(command, ["--no-install", "wrangler", ...args], {
    cwd: commerceRoot,
    encoding: "utf8",
    env: process.env,
  });
  if (expectSuccess && result.status !== 0) {
    throw new Error(
      `Wrangler failed: ${args.join(" ")}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
  if (!expectSuccess && result.status === 0) {
    throw new Error(`Expected Wrangler failure: ${args.join(" ")}`);
  }
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

function execute(sql, expectSuccess = true) {
  return wrangler(
    [
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
    ],
    expectSuccess,
  );
}

try {
  mkdirSync(persistDir, { recursive: true });
  cpSync(resolve(commerceRoot, "migrations"), migrationsDir, {
    recursive: true,
  });
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        name: "black-sheep-inventory-core-test",
        main: resolve(commerceRoot, "src/index.ts"),
        compatibility_date: "2026-09-24",
        d1_databases: [
          {
            binding: "DB",
            database_name: "black-sheep-inventory-core-test",
            database_id: "d442b45d-93b6-4535-b76a-4b72e62dc271",
            migrations_dir: "migrations",
          },
        ],
      },
      null,
      2,
    ),
  );

  wrangler([
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

  execute(`
    INSERT INTO products (
      id, legacy_catalog_id, current_slug, publication_status, sell_status,
      online_ordering_enabled, featured, current_published_version_id,
      current_draft_version_id, version, created_at, updated_at, archived_at
    ) VALUES (
      'prd_inventory_test', NULL, 'inventory-test', 'ACTIVE', 'AUTO',
      1, 0, NULL, NULL, 1, '2026-09-25T00:00:00.000Z',
      '2026-09-25T00:00:00.000Z', NULL
    );
    INSERT INTO product_variants (
      id, product_id, title, sku, barcode, price_minor, compare_at_price_minor,
      cost_minor, currency, track_inventory, low_stock_threshold, active,
      is_default, version, created_at, updated_at, inventory_mutation_token
    ) VALUES (
      'var_inventory_test', 'prd_inventory_test', 'Default', 'INV-TEST',
      NULL, 1000, NULL, NULL, 'GBP', 1, 3, 1, 1, 2,
      '2026-09-25T00:00:00.000Z', '2026-09-25T00:00:00.000Z', 'imut_seed'
    );
    INSERT INTO inventory_balances (
      variant_id, location_id, on_hand, reserved, safety_stock,
      version, mutation_token, updated_at
    ) VALUES (
      'var_inventory_test', 'loc_ambleside', 5, 0, 0,
      1, 'imut_seed', '2026-09-25T00:00:00.000Z'
    );
    INSERT INTO inventory_movements (
      id, variant_id, location_id, movement_type, on_hand_delta,
      reserved_delta, safety_stock_delta, reason_code, note,
      order_id, order_revision_id, reservation_id, incoming_id, batch_id,
      idempotency_key, actor_type, actor_id, created_at,
      balance_on_hand_after, balance_reserved_after, balance_safety_after
    ) VALUES (
      'imv_initial', 'var_inventory_test', 'loc_ambleside', 'INITIAL_COUNT',
      5, 0, 0, 'INITIAL_COUNT', 'test', NULL, NULL, NULL, NULL, NULL,
      'inventory:test:initial', 'SYSTEM', 'inventory-core-test',
      '2026-09-25T00:00:00.000Z', 5, 0, 0
    );
  `);

  // The ledger must reject mutation and deletion.
  execute(
    "UPDATE inventory_movements SET note='mutated' WHERE id='imv_initial'",
    false,
  );
  execute("DELETE FROM inventory_movements WHERE id='imv_initial'", false);

  // Exactly one INITIAL_COUNT per variant/location.
  execute(`
    INSERT INTO inventory_movements (
      id, variant_id, location_id, movement_type, on_hand_delta,
      reserved_delta, safety_stock_delta, reason_code, idempotency_key,
      actor_type, actor_id, created_at, balance_on_hand_after,
      balance_reserved_after, balance_safety_after
    ) VALUES (
      'imv_initial_2', 'var_inventory_test', 'loc_ambleside', 'INITIAL_COUNT',
      0, 0, 0, 'INITIAL_COUNT', 'inventory:test:initial:2',
      'SYSTEM', 'inventory-core-test', '2026-09-25T00:00:01.000Z', 5, 0, 0
    )
  `, false);

  // Idempotency keys cannot be reused.
  execute(`
    INSERT INTO inventory_movements (
      id, variant_id, location_id, movement_type, on_hand_delta,
      reserved_delta, safety_stock_delta, reason_code, idempotency_key,
      actor_type, actor_id, created_at, balance_on_hand_after,
      balance_reserved_after, balance_safety_after
    ) VALUES (
      'imv_duplicate_key', 'var_inventory_test', 'loc_ambleside',
      'MANUAL_ADJUSTMENT', 0, 0, 0, 'OTHER', 'inventory:test:initial',
      'SYSTEM', 'inventory-core-test', '2026-09-25T00:00:02.000Z', 5, 0, 0
    )
  `, false);

  // Optimistic balance version allows one winner and rejects a stale write.
  execute(`
    UPDATE inventory_balances
      SET on_hand=6, version=version+1, mutation_token='imut_winner',
          updated_at='2026-09-25T00:00:03.000Z'
      WHERE variant_id='var_inventory_test'
        AND location_id='loc_ambleside' AND version=1;
    UPDATE inventory_balances
      SET on_hand=99, version=version+1, mutation_token='imut_stale',
          updated_at='2026-09-25T00:00:04.000Z'
      WHERE variant_id='var_inventory_test'
        AND location_id='loc_ambleside' AND version=1;
  `);

  const final = execute(`
    SELECT on_hand, reserved, safety_stock, version, mutation_token,
      MAX(0, on_hand-reserved-safety_stock) AS available
    FROM inventory_balances
    WHERE variant_id='var_inventory_test' AND location_id='loc_ambleside';
  `);

  for (const expected of ["6", "2", "imut_winner"]) {
    if (!final.includes(expected)) {
      throw new Error(`Inventory concurrency result missing ${expected}:\n${final}`);
    }
  }

  console.log(
    "PASS: Inventory Core ledger immutability, initial-count uniqueness, idempotency and optimistic balance concurrency.",
  );
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
