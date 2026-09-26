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
  const result = spawnSync(command, ["--no-install", "wrangler", ...args], {
    cwd: commerceRoot,
    encoding: "utf8",
    env: process.env,
  });

  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(
      `Wrangler command failed (exit ${result.status}): ${args.join(" ")}\n${detail}`,
    );
  }

  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

function copyMigration(fileName) {
  copyFileSync(join(sourceMigrations, fileName), join(tempMigrations, fileName));
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

  const latestMigration = allMigrations.at(-1);
  const baselineMigrations = allMigrations.slice(0, -1);

  if (!latestMigration?.startsWith("0014_")) {
    throw new Error(
      `Expected latest migration to be 0014, found ${latestMigration ?? "none"}.`,
    );
  }
  if (baselineMigrations.at(-1)?.startsWith("0013_") !== true) {
    throw new Error("Upgrade baseline must contain ordered migrations through 0013.");
  }

  for (const fileName of baselineMigrations) copyMigration(fileName);

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

  copyMigration(latestMigration);

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
    "SELECT legacy_catalog_id, current_slug, publication_status, sell_status FROM products LIMIT 0",
    "SELECT product_id, version_number, title FROM product_versions LIMIT 0",
    "SELECT sku, barcode, price_minor, track_inventory, inventory_mutation_token FROM product_variants LIMIT 0",
    "SELECT storage_provider, storage_key, public_url FROM product_media LIMIT 0",
    "SELECT code, name FROM inventory_locations LIMIT 1",
    "SELECT variant_id, location_id, on_hand, reserved, safety_stock, version, mutation_token FROM inventory_balances LIMIT 0",
    "SELECT movement_type, on_hand_delta, reserved_delta, reason_code, idempotency_key FROM inventory_movements LIMIT 0",
    "SELECT expected_quantity, received_quantity, status, version FROM inventory_incoming LIMIT 0",
    "SELECT order_id, revision_id, location_id, state, expires_at, version, mutation_token, idempotency_key FROM inventory_reservations LIMIT 0",
    "SELECT reservation_id, revision_item_id, variant_id, quantity FROM inventory_reservation_items LIMIT 0",
    "SELECT returned_at FROM inventory_reservations LIMIT 0",
    "SELECT data_class, admin_hidden_at FROM orders LIMIT 0",
    "SELECT category_type FROM categories LIMIT 0",
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
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('idx_refunds_order_idempotency','idx_product_variants_sku','idx_product_version_media_one_primary','idx_inventory_movements_idempotency','idx_inventory_movements_initial_count','idx_inventory_movements_variant_created','idx_inventory_incoming_variant_status','idx_inventory_reservations_idempotency','idx_inventory_reservations_state_expiry','idx_inventory_reservation_items_variant','idx_inventory_reservations_returned','idx_orders_data_class_created','idx_categories_type_active_sort') ORDER BY name",
  ]);

  for (const required of [
    "idx_refunds_order_idempotency",
    "idx_product_variants_sku",
    "idx_product_version_media_one_primary",
    "idx_inventory_movements_idempotency",
    "idx_inventory_movements_initial_count",
    "idx_inventory_movements_variant_created",
    "idx_inventory_incoming_variant_status",
    "idx_inventory_reservations_idempotency",
    "idx_inventory_reservations_state_expiry",
    "idx_inventory_reservation_items_variant",
    "idx_inventory_reservations_returned",
    "idx_orders_data_class_created",
    "idx_categories_type_active_sort",
  ]) {
    if (!indexOutput.includes(required)) {
      throw new Error(`Required index missing after upgrade: ${required}`);
    }
  }

  const locationOutput = runWrangler([
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    configPath,
    "--persist-to",
    persistDir,
    "--command",
    "SELECT code, name FROM inventory_locations WHERE id='loc_ambleside'",
  ]);

  if (!locationOutput.includes("AMBLESIDE")) {
    throw new Error("Default Ambleside inventory location was not created.");
  }

  const ledgerGuard = runWrangler([
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    configPath,
    "--persist-to",
    persistDir,
    "--command",
    "SELECT name FROM sqlite_master WHERE type='trigger' AND name IN ('inventory_movements_immutable_update','inventory_movements_immutable_delete') ORDER BY name",
  ]);
  for (const required of [
    "inventory_movements_immutable_update",
    "inventory_movements_immutable_delete",
  ]) {
    if (!ledgerGuard.includes(required)) {
      throw new Error(`Immutable inventory ledger trigger missing: ${required}`);
    }
  }

  const reservationGuards = runWrangler([
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    configPath,
    "--persist-to",
    persistDir,
    "--command",
    "SELECT name FROM sqlite_master WHERE type='trigger' AND name IN ('inventory_reservation_items_immutable_update','inventory_reservation_items_immutable_delete') ORDER BY name",
  ]);
  for (const required of [
    "inventory_reservation_items_immutable_update",
    "inventory_reservation_items_immutable_delete",
  ]) {
    if (!reservationGuards.includes(required)) {
      throw new Error(`Immutable reservation-item trigger missing: ${required}`);
    }
  }

  console.log(
    "PASS: migrations 0000–0013 upgraded cleanly to 0014; managed category types, order data classification/reset and return-to-stock schema are present.",
  );
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
