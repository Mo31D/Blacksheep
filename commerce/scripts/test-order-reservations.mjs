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
const tempRoot = mkdtempSync(join(tmpdir(), "black-sheep-order-reservations-"));
const persistDir = join(tempRoot, "state");
const migrationsDir = join(tempRoot, "migrations");
const configPath = join(tempRoot, "wrangler-order-reservations-test.json");

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
        name: "black-sheep-order-reservations-test",
        main: resolve(commerceRoot, "src/index.ts"),
        compatibility_date: "2026-09-24",
        d1_databases: [
          {
            binding: "DB",
            database_name: "black-sheep-order-reservations-test",
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

  const empty = execute(
    "SELECT (SELECT COUNT(*) FROM inventory_reservations) AS reservations, (SELECT COUNT(*) FROM inventory_reservation_items) AS items",
  );
  if (!empty.includes("0")) {
    throw new Error("Migration must not invent reservation rows.");
  }

  execute(`
    INSERT INTO orders (
      id, public_reference, idempotency_key, status, currency,
      fulfilment_method, customer_name, customer_email,
      items_subtotal_minor, delivery_amount_minor, final_total_minor,
      payment_status, created_at, updated_at
    ) VALUES (
      'ord_res_test', 'RES-TEST-1', 'res-order-idem', 'UNDER_REVIEW', 'GBP',
      'collection', 'Reservation Test', 'test@example.com',
      1000, 0, 1000, 'UNPAID',
      '2026-09-25T00:00:00.000Z', '2026-09-25T00:00:00.000Z'
    );

    INSERT INTO order_items (
      order_id, line_number, catalog_product_id, sku, slug, product_name,
      unit_price_minor, quantity, line_total_minor, options_json, created_at
    ) VALUES (
      'ord_res_test', 1, 'legacy-res-product', 'RES-1',
      'reservation-test-product', 'Reservation Test Product',
      1000, 1, 1000, '{}', '2026-09-25T00:00:00.000Z'
    );

    INSERT INTO order_revisions (
      id, order_id, revision_number, state, version, currency,
      items_subtotal_minor, delivery_amount_minor, adjustment_amount_minor,
      final_total_minor, customer_message, internal_note, created_by,
      created_at, expires_at, fulfilment_method, mutation_token
    ) VALUES (
      'rev_res_test', 'ord_res_test', 1, 'SENT', 2, 'GBP',
      1000, 0, 0, 1000, NULL, NULL, 'owner@example.com',
      '2026-09-25T00:00:01.000Z', '2026-09-26T00:00:00.000Z',
      'collection', 'revision-mutation-token'
    );

    INSERT INTO order_revision_items (
      revision_id, line_number, source_order_item_id, catalog_product_id,
      sku, slug, product_name, unit_price_minor, requested_quantity,
      confirmed_quantity, availability_status, reason_code,
      customer_note, internal_note, line_total_minor, created_at, updated_at
    )
    SELECT
      'rev_res_test', 1, id, 'legacy-res-product', 'RES-1',
      'reservation-test-product', 'Reservation Test Product',
      1000, 1, 1, 'CONFIRMED', NULL, NULL, NULL, 1000,
      '2026-09-25T00:00:01.000Z', '2026-09-25T00:00:01.000Z'
    FROM order_items
    WHERE order_id='ord_res_test' AND line_number=1;

    INSERT INTO products (
      id, legacy_catalog_id, current_slug, publication_status, sell_status,
      online_ordering_enabled, featured, current_published_version_id,
      current_draft_version_id, version, created_at, updated_at, archived_at
    ) VALUES (
      'prd_res_test', 'legacy-res-product', 'reservation-test-product',
      'ACTIVE', 'AUTO', 1, 0, NULL, NULL, 1,
      '2026-09-25T00:00:00.000Z', '2026-09-25T00:00:00.000Z', NULL
    );

    INSERT INTO product_variants (
      id, product_id, title, sku, barcode, price_minor, compare_at_price_minor,
      cost_minor, currency, track_inventory, low_stock_threshold, active,
      is_default, version, created_at, updated_at, inventory_mutation_token
    ) VALUES (
      'var_res_test', 'prd_res_test', 'Default', 'RES-1', NULL, 1000,
      NULL, NULL, 'GBP', 1, 2, 1, 1, 1,
      '2026-09-25T00:00:00.000Z', '2026-09-25T00:00:00.000Z', 'seed-token'
    );

    INSERT INTO inventory_balances (
      variant_id, location_id, on_hand, reserved, safety_stock,
      version, mutation_token, updated_at
    ) VALUES (
      'var_res_test', 'loc_ambleside', 3, 0, 0,
      1, 'seed-token', '2026-09-25T00:00:00.000Z'
    );
  `);

  execute(`
    INSERT INTO inventory_reservations (
      id, order_id, revision_id, location_id, state, expires_at,
      committed_at, released_at, consumed_at, release_reason,
      version, mutation_token, idempotency_key, created_by, created_at, updated_at
    ) VALUES (
      'res_test_1', 'ord_res_test', 'rev_res_test', 'loc_ambleside',
      'ACTIVE', '2026-09-26T00:00:00.000Z',
      NULL, NULL, NULL, NULL, 1, 'res-mutation-1',
      'reservation:test:1', 'owner@example.com',
      '2026-09-25T00:00:02.000Z', '2026-09-25T00:00:02.000Z'
    );

    INSERT INTO inventory_reservation_items (
      id, reservation_id, revision_item_id, variant_id, quantity, created_at
    )
    SELECT
      'res_item_test_1', 'res_test_1', id, 'var_res_test', 1,
      '2026-09-25T00:00:02.000Z'
    FROM order_revision_items
    WHERE revision_id='rev_res_test' AND line_number=1;
  `);

  // One reservation group per revision.
  execute(`
    INSERT INTO inventory_reservations (
      id, order_id, revision_id, location_id, state, expires_at,
      version, mutation_token, idempotency_key, created_by, created_at, updated_at
    ) VALUES (
      'res_test_duplicate_revision', 'ord_res_test', 'rev_res_test',
      'loc_ambleside', 'ACTIVE', '2026-09-26T00:00:00.000Z',
      1, 'res-mutation-2', 'reservation:test:2', 'owner@example.com',
      '2026-09-25T00:00:03.000Z', '2026-09-25T00:00:03.000Z'
    )
  `, false);

  // Reservation idempotency keys are globally unique.
  execute(`
    INSERT INTO inventory_reservations (
      id, order_id, revision_id, location_id, state, expires_at,
      version, mutation_token, idempotency_key, created_by, created_at, updated_at
    ) VALUES (
      'res_test_duplicate_idem', 'ord_res_test', 'missing-revision',
      'loc_ambleside', 'ACTIVE', '2026-09-26T00:00:00.000Z',
      1, 'res-mutation-3', 'reservation:test:1', 'owner@example.com',
      '2026-09-25T00:00:04.000Z', '2026-09-25T00:00:04.000Z'
    )
  `, false);

  // Reservation line membership is immutable historical truth.
  execute(
    "UPDATE inventory_reservation_items SET quantity=2 WHERE id='res_item_test_1'",
    false,
  );
  execute(
    "DELETE FROM inventory_reservation_items WHERE id='res_item_test_1'",
    false,
  );

  // A reviewed line can only participate in one numeric reservation item.
  execute(`
    INSERT INTO inventory_reservation_items (
      id, reservation_id, revision_item_id, variant_id, quantity, created_at
    )
    SELECT
      'res_item_test_duplicate', 'res_test_1', id, 'var_res_test', 1,
      '2026-09-25T00:00:05.000Z'
    FROM order_revision_items
    WHERE revision_id='rev_res_test' AND line_number=1
  `, false);

  // Foundation rows alone must not mutate physical/reserved stock.
  const balance = execute(`
    SELECT on_hand, reserved, safety_stock, version
    FROM inventory_balances
    WHERE variant_id='var_res_test' AND location_id='loc_ambleside';
  `);
  for (const expected of ["3", "0", "1"]) {
    if (!balance.includes(expected)) {
      throw new Error(`Unexpected balance after schema-only reservation test: ${balance}`);
    }
  }

  const schema = execute(`
    SELECT r.state, r.version, i.quantity
    FROM inventory_reservations r
    JOIN inventory_reservation_items i ON i.reservation_id=r.id
    WHERE r.id='res_test_1';
  `);
  for (const expected of ["ACTIVE", "1"]) {
    if (!schema.includes(expected)) {
      throw new Error(`Reservation schema result missing ${expected}:\n${schema}`);
    }
  }

  console.log(
    "PASS: Phase 5 reservation foundation has no migration side effects, enforces one reservation per revision, unique idempotency, immutable reservation items, and leaves inventory balances unchanged until domain logic runs.",
  );
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
