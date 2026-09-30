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

  if (!latestMigration?.startsWith("0030_")) {
    throw new Error(
      `Expected latest migration to be 0030, found ${latestMigration ?? "none"}.`,
    );
  }
  if (baselineMigrations.at(-1)?.startsWith("0029_") !== true) {
    throw new Error("Upgrade baseline must contain ordered migrations through 0029.");
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

  const placementsBefore = runWrangler([
    "d1", "execute", "DB", "--local", "--config", configPath,
    "--persist-to", persistDir, "--command",
    "SELECT COUNT(*) AS placement_count FROM product_version_storefront_placements",
  ]).match(/"placement_count":\s*(\d+)/)?.[1];
  // Simulate an owner draft: the migration must retain its image/content while
  // aligning hierarchy fields, so publishing it later cannot undo Local Treats.
  runWrangler([
    "d1", "execute", "DB", "--local", "--config", configPath,
    "--persist-to", persistDir, "--command",
    "INSERT INTO storefront_node_versions (id,node_id,version_number,name,slug,parent_node_id,sort_order,show_in_navigation,short_description,image_url,legacy_path,created_by,created_at,published_at,superseded_at) SELECT 'sfv_upgrade_romneys_draft',v.node_id,(SELECT MAX(version_number)+1 FROM storefront_node_versions WHERE node_id=v.node_id),v.name,v.slug,v.parent_node_id,v.sort_order,v.show_in_navigation,'Owner draft preserved','/images/owner-draft.png',v.legacy_path,'upgrade-fixture','2026-09-30T11:00:00.000Z',NULL,NULL FROM storefront_nodes n JOIN storefront_node_versions v ON v.id=n.current_published_version_id WHERE n.id='sfn_romneys'; UPDATE storefront_nodes SET current_draft_version_id='sfv_upgrade_romneys_draft' WHERE id='sfn_romneys'",
  ]);
  runWrangler([
    "d1", "execute", "DB", "--local", "--config", configPath,
    "--persist-to", persistDir, "--command",
    "UPDATE storefront_node_versions SET image_url='/media/local-canonical' WHERE id=(SELECT current_published_version_id FROM storefront_nodes WHERE stable_key='local-treats'); UPDATE website_appearance_versions SET section_images_json='{\"gifts\":\"/media/gifts-appearance\",\"local-treats\":\"/media/local-appearance\"}' WHERE id=(SELECT current_published_version_id FROM website_appearance)",
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
    "SELECT id, name, active FROM suppliers LIMIT 0",
    "SELECT cost_minor, supplier_id, supplier_product_code, vat_rate_basis_points FROM product_variants LIMIT 0",
    "SELECT snapshot_date, location_id, cost_value_inc_vat_minor, retail_value_inc_vat_minor, potential_gross_profit_minor FROM inventory_valuation_snapshots LIMIT 0",
    "SELECT id, failed_attempts, locked_until, updated_at FROM admin_password_security LIMIT 0",
    "SELECT id, stable_key, publication_status, current_published_version_id FROM storefront_nodes LIMIT 0",
    "SELECT node_id, slug, parent_node_id, sort_order, show_in_navigation, legacy_path FROM storefront_node_versions LIMIT 0",
    "SELECT product_version_id, storefront_node_id, is_primary, position, source FROM product_version_storefront_placements LIMIT 0",
    "SELECT node_id, event_type, actor_id, before_json, after_json, reason FROM storefront_audit_events LIMIT 0",
    "SELECT id, location_id, scope_type, scope_ref_id, scope_label, status, total_items, counted_items, skipped_items, conflict_items, current_position, version FROM stocktake_sessions LIMIT 0",
    "SELECT session_id, variant_id, position, counted_on_hand, item_status, expected_balance_version, version FROM stocktake_session_items LIMIT 0",
    "SELECT id, current_published_version_id, current_draft_version_id, version FROM homepage_merchandising LIMIT 0",
    "SELECT merchandising_id, version_number, enabled, mode, product_limit, heading, selected_storefront_node_id, published_at, superseded_at FROM homepage_merchandising_versions LIMIT 0",
    "SELECT version_id, product_id, position FROM homepage_merchandising_products LIMIT 0",
    "SELECT version_id, module_key, enabled, position FROM homepage_merchandising_modules LIMIT 0",
    "SELECT version_id, module_key, storefront_node_id, position FROM homepage_merchandising_cards LIMIT 0",
    "SELECT merchandising_id, event_type, actor_id, before_json, after_json FROM homepage_merchandising_audit_events LIMIT 0",
    "SELECT id, current_published_version_id, current_draft_version_id, version FROM website_appearance LIMIT 0",
    "SELECT appearance_id, version_number, preset_key, background_color, surface_color, text_color, muted_text_color, accent_color, button_color, border_color, header_color, hero_image_url, hero_heading, hero_text, hero_button_label, hero_button_href, section_images_json, scheduled_start_at, scheduled_end_at, published_at, superseded_at FROM website_appearance_versions LIMIT 0",
    "SELECT decorations_enabled FROM website_appearance_versions LIMIT 0",
    "SELECT appearance_id, event_type, actor_id, before_json, after_json FROM website_appearance_audit_events LIMIT 0",
    "SELECT id, storage_provider, storage_key, public_url, mime_type, file_size, checksum_sha256, title, alt_text, context, status, archived_at, deleted_at FROM shared_media_assets LIMIT 0",
    "SELECT asset_id, surface, owner_id, owner_version_id, slot_key, released_at FROM shared_media_references LIMIT 0",
    "SELECT asset_id, event_type, actor_id, before_json, after_json FROM shared_media_audit_events LIMIT 0",
    "SELECT asset_id, storage_key, state, attempt_count, claim_token, last_error, claimed_by, claimed_at, updated_at FROM shared_media_delete_jobs LIMIT 0",
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
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('idx_refunds_order_idempotency','idx_product_variants_sku','idx_product_version_media_one_primary','idx_inventory_movements_idempotency','idx_inventory_movements_initial_count','idx_inventory_movements_variant_created','idx_inventory_incoming_variant_status','idx_inventory_reservations_idempotency','idx_inventory_reservations_state_expiry','idx_inventory_reservation_items_variant','idx_inventory_reservations_returned','idx_orders_data_class_created','idx_categories_type_active_sort','idx_suppliers_active_name','idx_product_variants_supplier','idx_inventory_valuation_snapshots_location_date','idx_storefront_nodes_status_updated','idx_storefront_live_slug','idx_storefront_one_live_version','idx_storefront_node_versions_parent_sort','idx_product_storefront_one_primary','idx_product_storefront_node_version','idx_storefront_audit_node_created','idx_storefront_audit_event_created','idx_stocktake_sessions_status_updated','idx_stocktake_sessions_location_status','idx_stocktake_items_session_position','idx_stocktake_items_session_status','idx_homepage_merchandising_one_live_version','idx_homepage_merchandising_products_position','idx_homepage_merchandising_audit_created','idx_homepage_merchandising_modules_position','idx_homepage_merchandising_cards_order','idx_shared_media_assets_status_context','idx_shared_media_assets_checksum','idx_shared_media_references_asset','idx_shared_media_references_owner','idx_shared_media_audit_asset_created','idx_shared_media_delete_jobs_state_updated') ORDER BY name",
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
    "idx_suppliers_active_name",
    "idx_product_variants_supplier",
    "idx_inventory_valuation_snapshots_location_date",
    "idx_storefront_nodes_status_updated",
    "idx_storefront_live_slug",
    "idx_storefront_one_live_version",
    "idx_storefront_node_versions_parent_sort",
    "idx_product_storefront_one_primary",
    "idx_product_storefront_node_version",
    "idx_storefront_audit_node_created",
    "idx_storefront_audit_event_created",
    "idx_stocktake_sessions_status_updated",
    "idx_stocktake_sessions_location_status",
    "idx_stocktake_items_session_position",
    "idx_stocktake_items_session_status",
    "idx_homepage_merchandising_one_live_version",
    "idx_homepage_merchandising_products_position",
    "idx_homepage_merchandising_audit_created",
    "idx_homepage_merchandising_modules_position",
    "idx_homepage_merchandising_cards_order",
    "idx_shared_media_assets_status_context",
    "idx_shared_media_assets_checksum",
    "idx_shared_media_references_asset",
    "idx_shared_media_references_owner",
    "idx_shared_media_audit_asset_created",
    "idx_shared_media_delete_jobs_state_updated",
  ]) {
    if (!indexOutput.includes(required)) {
      throw new Error(`Required index missing after upgrade: ${required}`);
    }
  }

  const storefrontSeed = runWrangler([
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    configPath,
    "--persist-to",
    persistDir,
    "--command",
    "SELECT COUNT(*) AS node_count FROM storefront_nodes; SELECT COUNT(*) AS root_count FROM storefront_node_versions WHERE parent_node_id IS NULL AND published_at IS NOT NULL AND superseded_at IS NULL; SELECT COUNT(*) AS nav_roots FROM storefront_node_versions WHERE parent_node_id IS NULL AND show_in_navigation=1 AND published_at IS NOT NULL AND superseded_at IS NULL; SELECT COUNT(*) AS peter_rabbit_root FROM storefront_node_versions WHERE node_id='sfn_gifts_peter_rabbit' AND parent_node_id IS NULL AND published_at IS NOT NULL AND superseded_at IS NULL;",
  ]);
  for (const expected of ['"node_count": 24', '"root_count": 6', '"nav_roots": 6', '"peter_rabbit_root": 1']) {
    if (!storefrontSeed.includes(expected)) {
      throw new Error("Storefront Structure seed invariant missing: " + expected + "\\n" + storefrontSeed);
    }
  }
  const localHierarchy = runWrangler([
    "d1", "execute", "DB", "--local", "--config", configPath,
    "--persist-to", persistDir, "--command",
    "SELECT n.id, v.name, v.parent_node_id FROM storefront_nodes n JOIN storefront_node_versions v ON v.id=n.current_published_version_id WHERE n.id IN ('sfn_local_treats','sfn_romneys','sfn_hawkshead','sfn_romneys_mint_cake','sfn_hawkshead_honey') ORDER BY n.id",
  ]);
  for (const expected of ['Local Treats', 'sfn_local_treats', 'sfn_romneys_mint_cake', 'sfn_hawkshead_honey']) {
    if (!localHierarchy.includes(expected)) {
      throw new Error("Three-level Local Treats hierarchy missing: " + expected + "\n" + localHierarchy);
    }
  }
  const draftAfter = runWrangler([
    "d1", "execute", "DB", "--local", "--config", configPath,
    "--persist-to", persistDir, "--command",
    "SELECT v.name,v.parent_node_id,v.short_description,v.image_url FROM storefront_nodes n JOIN storefront_node_versions v ON v.id=n.current_draft_version_id WHERE n.id='sfn_romneys'",
  ]);
  for (const expected of ["sfn_local_treats", "Owner draft preserved", "/images/owner-draft.png"]) {
    if (!draftAfter.includes(expected)) {
      throw new Error("Owner draft was not preserved/aligned: " + expected + "\n" + draftAfter);
    }
  }
  const placementsAfter = runWrangler([
    "d1", "execute", "DB", "--local", "--config", configPath,
    "--persist-to", persistDir, "--command",
    "SELECT COUNT(*) AS placement_count FROM product_version_storefront_placements",
  ]).match(/"placement_count":\s*(\d+)/)?.[1];
  if (!placementsBefore || placementsBefore !== placementsAfter) {
    throw new Error("Storefront hierarchy migration changed Product placements.");
  }
  const sectionImagesAfter = runWrangler([
    "d1", "execute", "DB", "--local", "--config", configPath,
    "--persist-to", persistDir, "--command",
    "SELECT n.stable_key, v.image_url FROM storefront_nodes n JOIN storefront_node_versions v ON v.id=n.current_published_version_id WHERE n.stable_key IN ('gifts','local-treats') ORDER BY n.stable_key; SELECT section_images_json FROM website_appearance_versions WHERE id=(SELECT current_published_version_id FROM website_appearance)",
  ]);
  for (const expected of ['/media/gifts-appearance', '/media/local-canonical', '"section_images_json": "{}"']) {
    if (!sectionImagesAfter.includes(expected)) {
      throw new Error("Section image ownership transfer missing: " + expected + "\n" + sectionImagesAfter);
    }
  }

  const homepageSeed = runWrangler([
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    configPath,
    "--persist-to",
    persistDir,
    "--command",
    "SELECT hm.id, hm.version, hv.enabled, hv.mode, hv.product_limit AS product_limit FROM homepage_merchandising hm JOIN homepage_merchandising_versions hv ON hv.id=hm.current_published_version_id WHERE hm.id='home_product_rail'",
  ]);
  for (const expected of [
    "home_product_rail",
    "NEW_ARRIVALS",
    '"enabled": 0',
    '"product_limit": 8',
  ]) {
    if (!homepageSeed.includes(expected)) {
      throw new Error("Homepage Merchandising seed invariant missing: " + expected + "\n" + homepageSeed);
    }
  }

  const homepageModulesSeed = runWrangler([
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    configPath,
    "--persist-to",
    persistDir,
    "--command",
    "SELECT module_key, enabled, position FROM homepage_merchandising_modules WHERE version_id='hmv_default_1' ORDER BY position",
  ]);
  for (const expected of [
    '"module_key": "HERO"',
    '"module_key": "COLLECTIONS"',
    '"module_key": "PRODUCT_RAIL"',
    '"module_key": "LOCAL_FAVOURITES"',
    '"module_key": "VISIT_SHOP"',
  ]) {
    if (!homepageModulesSeed.includes(expected)) {
      throw new Error("Homepage module seed invariant missing: " + expected + "\n" + homepageModulesSeed);
    }
  }

  const homepageCardsSeed = runWrangler([
    "d1", "execute", "DB", "--local", "--config", configPath,
    "--persist-to", persistDir, "--command",
    "SELECT module_key, COUNT(*) AS cards FROM homepage_merchandising_cards WHERE version_id='hmv_default_1' GROUP BY module_key ORDER BY module_key",
  ]);
  for (const expected of ['"module_key": "COLLECTIONS"', '"cards": 6', '"module_key": "LOCAL_FAVOURITES"', '"cards": 3']) {
    if (!homepageCardsSeed.includes(expected)) {
      throw new Error("Homepage card seed invariant missing: " + expected + "\n" + homepageCardsSeed);
    }
  }

  const localCardImages = runWrangler([
    "d1", "execute", "DB", "--local", "--config", configPath,
    "--persist-to", persistDir, "--command",
    "SELECT n.id, nv.image_url FROM storefront_nodes n JOIN storefront_node_versions nv ON nv.id=n.current_published_version_id WHERE n.id IN ('sfn_icecream','sfn_romneys','sfn_hawkshead') ORDER BY n.id",
  ]);
  for (const expected of ["/images/9.png", "/images/46.png", "/images/49.png"]) {
    if (!localCardImages.includes(expected)) {
      throw new Error("Canonical local-favourite image missing: " + expected + "\n" + localCardImages);
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
    "PASS: migrations 0000–0029 upgraded cleanly to 0030; canonical Section images, six published roots, nested Local Treats and all prior platform schemas are present.",
  );
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
// Keep the latest migration as the upgrade candidate so seeded data survives.
