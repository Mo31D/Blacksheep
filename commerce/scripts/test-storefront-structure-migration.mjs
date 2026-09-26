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

const root = process.cwd();
const sourceMigrations = resolve(root, "migrations");
const tempRoot = mkdtempSync(join(tmpdir(), "black-sheep-storefront-structure-"));
const migrations = join(tempRoot, "migrations");
const state = join(tempRoot, "state");
const config = join(tempRoot, "wrangler.json");

function wrangler(args) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(command, ["--no-install", "wrangler", ...args], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `Wrangler failed: ${args.join(" ")}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
  return result.stdout ?? "";
}

function execute(sql) {
  const raw = wrangler([
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    config,
    "--persist-to",
    state,
    "--command",
    sql,
    "--json",
  ]).trim();
  return JSON.parse(raw);
}

function scalar(payload, key, block = 0) {
  return Number(payload?.[block]?.results?.[0]?.[key] ?? -1);
}

try {
  mkdirSync(migrations, { recursive: true });
  mkdirSync(state, { recursive: true });
  writeFileSync(
    config,
    JSON.stringify({
      name: "storefront-structure-migration-test",
      main: resolve(root, "src/index.ts"),
      compatibility_date: "2026-09-24",
      d1_databases: [{
        binding: "DB",
        database_name: "storefront-structure-migration-test",
        database_id: "d442b45d-93b6-4535-b76a-4b72e62dc271",
        migrations_dir: "migrations",
      }],
    }),
  );

  const all = readdirSync(sourceMigrations)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  const card01Index = all.findIndex((name) => name.startsWith("0017_"));
  const latest = card01Index >= 0 ? all[card01Index] : null;
  if (!latest) {
    throw new Error("Expected CARD 01 migration 0017_storefront_structure.sql.");
  }

  for (const name of all.slice(0, card01Index)) {
    copyFileSync(join(sourceMigrations, name), join(migrations, name));
  }
  wrangler([
    "d1","migrations","apply","DB","--local","--config",config,"--persist-to",state,
  ]);

  execute(`
    INSERT INTO categories (id,slug,name,parent_id,active,sort_order,created_at,updated_at,category_type)
    VALUES
      ('cat_hc','highland-cows','Highland Cows',NULL,1,10,'t','t','COLLECTION_THEME'),
      ('cat_seasonal','seasonal','Seasonal',NULL,1,20,'t','t','COLLECTION_THEME'),
      ('cat_romneys','romneys','Romney''s',NULL,1,30,'t','t','BRAND_RANGE'),
      ('cat_fudge','fudge','Fudge',NULL,1,40,'t','t','PRODUCT_CATEGORY');

    INSERT INTO products (
      id,legacy_catalog_id,current_slug,publication_status,sell_status,
      online_ordering_enabled,featured,current_published_version_id,current_draft_version_id,
      version,created_at,updated_at,archived_at
    ) VALUES
      ('prd_gift',NULL,'gift-test','ACTIVE','AUTO',1,0,'pver_gift',NULL,1,'t','t',NULL),
      ('prd_romneys',NULL,'romneys-test','ACTIVE','AUTO',1,0,'pver_romneys',NULL,1,'t','t',NULL);

    INSERT INTO product_versions (
      id,product_id,version_number,title,short_description,long_description,brand,
      collection_label,product_type,public_note,seo_title,seo_description,
      created_by,created_at,published_at,superseded_at
    ) VALUES
      ('pver_gift','prd_gift',1,'Gift test','',NULL,NULL,NULL,'gifts',NULL,NULL,NULL,'test','t','t',NULL),
      ('pver_romneys','prd_romneys',1,'Romneys test','',NULL,NULL,NULL,'romneys',NULL,NULL,NULL,'test','t','t',NULL);

    INSERT INTO product_version_categories (product_version_id,category_id,is_primary,position)
    VALUES
      ('pver_gift','cat_hc',1,0),
      ('pver_gift','cat_seasonal',0,1),
      ('pver_romneys','cat_romneys',1,0),
      ('pver_romneys','cat_fudge',0,1);
  `);

  copyFileSync(join(sourceMigrations, latest), join(migrations, latest));
  wrangler([
    "d1","migrations","apply","DB","--local","--config",config,"--persist-to",state,
  ]);

  const counts = execute(
    "SELECT COUNT(*) AS nodes FROM storefront_nodes;" +
    " SELECT COUNT(*) AS placements FROM product_version_storefront_placements;" +
    " SELECT COUNT(*) AS primaries FROM product_version_storefront_placements WHERE is_primary=1;"
  );
  if (scalar(counts, "nodes", 0) !== 23) throw new Error("Expected 23 seeded Storefront nodes.");
  if (scalar(counts, "placements", 1) !== 4) throw new Error("Expected 4 backfilled placements.");
  if (scalar(counts, "primaries", 2) !== 2) throw new Error("Expected 2 primary placements.");

  const placementRows = execute(
    "SELECT product_version_id,storefront_node_id,is_primary,position " +
    "FROM product_version_storefront_placements ORDER BY product_version_id,is_primary DESC,position;"
  )?.[0]?.results ?? [];

  const expected = [
    ["pver_gift","sfn_gifts_highland_cows",1],
    ["pver_gift","sfn_gifts_seasonal",0],
    ["pver_romneys","sfn_romneys",1],
    ["pver_romneys","sfn_romneys_fudge",0],
  ];
  for (const [versionId,nodeId,primary] of expected) {
    if (!placementRows.some((row) =>
      row.product_version_id === versionId &&
      row.storefront_node_id === nodeId &&
      Number(row.is_primary) === primary
    )) {
      throw new Error(`Missing expected placement ${versionId} → ${nodeId}.`);
    }
  }

  // Archive semantics are non-destructive: the stable node remains and all
  // Product-version placement history continues to reference it.
  execute(
    "UPDATE storefront_nodes SET publication_status='ARCHIVED', archived_at='2026-09-26T20:00:00.000Z' " +
    "WHERE id='sfn_gifts_highland_cows';"
  );
  const archiveCheck = execute(
    "SELECT n.publication_status AS status, COUNT(p.product_version_id) AS placements " +
    "FROM storefront_nodes n LEFT JOIN product_version_storefront_placements p " +
    "ON p.storefront_node_id=n.id WHERE n.id='sfn_gifts_highland_cows' GROUP BY n.id;"
  )?.[0]?.results?.[0];
  if (
    archiveCheck?.status !== "ARCHIVED" ||
    Number(archiveCheck?.placements ?? 0) !== 1
  ) {
    throw new Error("Archive semantics did not preserve Storefront placement history.");
  }

  let deleteRestricted = false;
  try {
    execute("DELETE FROM storefront_nodes WHERE id='sfn_gifts_highland_cows';");
  } catch (error) {
    deleteRestricted = String(error).includes("FOREIGN KEY") ||
      String(error).includes("constraint");
  }
  if (!deleteRestricted) {
    throw new Error("Expected Storefront node deletion with Product history to be restricted.");
  }

  // Restore only inside this disposable migration test so the idempotency
  // assertion below operates on the original active seed shape.
  execute(
    "UPDATE storefront_nodes SET publication_status='ACTIVE', archived_at=NULL " +
    "WHERE id='sfn_gifts_highland_cows';"
  );

  execute(
    "INSERT OR IGNORE INTO product_version_storefront_placements " +
    "(product_version_id,storefront_node_id,is_primary,position,source,created_at) " +
    "SELECT product_version_id,storefront_node_id,is_primary,position,source,created_at " +
    "FROM product_version_storefront_placements;"
  );
  const after = execute(
    "SELECT COUNT(*) AS placements FROM product_version_storefront_placements;"
  );
  if (scalar(after, "placements") !== 4) {
    throw new Error("Idempotent duplicate placement insert changed the row count.");
  }

  console.log(
    "PASS: 0017 backfills versioned Storefront placements, preserves history on archive, restricts destructive deletion, and duplicate inserts are idempotent.",
  );
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
