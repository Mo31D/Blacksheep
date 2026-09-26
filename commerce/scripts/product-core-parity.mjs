import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  EXPECTED_CATALOG_BLOB,
  EXPECTED_PRODUCT_COUNT,
  attributesFor,
  effectiveSellStatus,
  loadFrozenCatalogue,
  mediaEntries,
  moneyMinor,
  onlineOrderingEnabled,
} from "./product-core-lib.mjs";

const argv = process.argv.slice(2);
const remote = argv.includes("--remote");
const envIndex = argv.indexOf("--env");
const environment = envIndex >= 0 ? argv[envIndex + 1] : null;
const markdownIndex = argv.indexOf("--markdown");
const jsonIndex = argv.indexOf("--json-out");
const markdownPath = markdownIndex >= 0 ? argv[markdownIndex + 1] : null;
const jsonPath = jsonIndex >= 0 ? argv[jsonIndex + 1] : null;

if (
  !remote ||
  !["staging", "production"].includes(String(environment))
) {
  throw new Error(
    "Product Core parity verifier requires --remote --env staging|production.",
  );
}

const wranglerDatabaseArgs =
  environment === "staging"
    ? ["DB", "--remote", "--env", "staging"]
    : ["black-sheep-commerce-prod", "--remote"];

function query(command) {
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(
    executable,
    [
      "--no-install",
      "wrangler",
      "d1",
      "execute",
      ...wranglerDatabaseArgs,
      "--command",
      command,
      "--json",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
      maxBuffer: 30 * 1024 * 1024,
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `Wrangler query failed.\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
  return JSON.parse((result.stdout ?? "").trim());
}

function rows(block) {
  const payload = Array.isArray(block) ? block[0] : block;
  return payload?.results ?? [];
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

const { items, blob } = loadFrozenCatalogue();
const expectedById = new Map(items.map((item) => [item.id, item]));
const mismatches = [];

const productRows = rows(
  query(
    `SELECT
      p.legacy_catalog_id AS legacyId,
      p.current_slug AS slug,
      p.publication_status AS publicationStatus,
      p.sell_status AS sellStatus,
      p.online_ordering_enabled AS onlineOrderingEnabled,
      pv.title,
      pv.short_description AS shortDescription,
      pv.brand,
      pv.collection_label AS collectionLabel,
      pv.product_type AS productType,
      pv.public_note AS publicNote,
      v.sku,
      v.barcode,
      v.price_minor AS priceMinor,
      v.track_inventory AS trackInventory
    FROM products p
    JOIN product_versions pv ON pv.id = p.current_published_version_id
    JOIN product_variants v ON v.product_id = p.id AND v.is_default = 1 AND v.active = 1
    ORDER BY p.legacy_catalog_id`,
  ),
);

if (productRows.length !== EXPECTED_PRODUCT_COUNT) {
  mismatches.push(
    `Product row count expected ${EXPECTED_PRODUCT_COUNT}, got ${productRows.length}`,
  );
}

for (const row of productRows) {
  const item = expectedById.get(row.legacyId);
  if (!item) {
    mismatches.push(`Unexpected D1 product ${row.legacyId}`);
    continue;
  }

  const expected = {
    slug: item.slug,
    publicationStatus: "ACTIVE",
    sellStatus: effectiveSellStatus(item),
    onlineOrderingEnabled: onlineOrderingEnabled(item),
    title: item.name,
    shortDescription: item.desc ?? "",
    brand: item.brand ?? null,
    collectionLabel: item.label ?? null,
    productType: item.type,
    publicNote: item.note ?? null,
    sku: item.sku ?? null,
    barcode: item.barcode ?? null,
    priceMinor: moneyMinor(item.price),
    trackInventory: 0,
  };

  for (const [key, value] of Object.entries(expected)) {
    if (row[key] !== value) {
      mismatches.push(
        `${row.legacyId} ${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify(row[key])}`,
      );
    }
  }
}

for (const item of items) {
  if (!productRows.some((row) => row.legacyId === item.id)) {
    mismatches.push(`Missing D1 product ${item.id}`);
  }
}

const categoryRows = rows(
  query(
    `SELECT p.legacy_catalog_id AS legacyId, c.slug, pvc.position, pvc.is_primary AS isPrimary
     FROM products p
     JOIN product_version_categories pvc ON pvc.product_version_id = p.current_published_version_id
     JOIN categories c ON c.id = pvc.category_id
     ORDER BY p.legacy_catalog_id, pvc.position, c.slug`,
  ),
);
const actualCategories = new Map();
for (const row of categoryRows) {
  if (!actualCategories.has(row.legacyId)) actualCategories.set(row.legacyId, []);
  actualCategories.get(row.legacyId).push({
    slug: row.slug,
    position: row.position,
    isPrimary: row.isPrimary,
  });
}
for (const item of items) {
  const primary =
    item.category && item.categories.includes(item.category)
      ? item.category
      : item.categories[0] ?? null;
  const expected = item.categories.map((slug, position) => ({
    slug,
    position,
    isPrimary: slug === primary ? 1 : 0,
  }));
  const actual = actualCategories.get(item.id) ?? [];
  if (!sameJson(actual, expected)) {
    mismatches.push(
      `${item.id} categories differ. Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

const mediaRows = rows(
  query(
    `SELECT p.legacy_catalog_id AS legacyId, pm.storage_key AS storageKey,
            pvm.position, pvm.is_primary AS isPrimary,
            pvm.alt_text AS altText, pvm.display_fit AS displayFit
     FROM products p
     JOIN product_version_media pvm ON pvm.product_version_id = p.current_published_version_id
     JOIN product_media pm ON pm.id = pvm.media_id
     ORDER BY p.legacy_catalog_id, pvm.position`,
  ),
);
const actualMedia = new Map();
for (const row of mediaRows) {
  if (!actualMedia.has(row.legacyId)) actualMedia.set(row.legacyId, []);
  actualMedia.get(row.legacyId).push({
    storageKey: row.storageKey,
    position: row.position,
    isPrimary: row.isPrimary,
    altText: row.altText,
    displayFit: row.displayFit,
  });
}
for (const item of items) {
  const expected = mediaEntries(item).map((entry, position) => ({
    storageKey: `images/${entry.src}`,
    position,
    isPrimary: position === 0 ? 1 : 0,
    altText: entry.alt,
    displayFit: entry.fit,
  }));
  const actual = actualMedia.get(item.id) ?? [];
  if (!sameJson(actual, expected)) {
    mismatches.push(
      `${item.id} media differs. Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

const attributeRows = rows(
  query(
    `SELECT p.legacy_catalog_id AS legacyId, pa.attribute_key AS attributeKey,
            pa.label, pa.value_text AS valueText, pa.value_json AS valueJson
     FROM products p
     JOIN product_attributes pa ON pa.product_version_id = p.current_published_version_id
     ORDER BY p.legacy_catalog_id, pa.position, pa.attribute_key`,
  ),
);
const actualAttributes = new Map();
for (const row of attributeRows) {
  if (!actualAttributes.has(row.legacyId)) actualAttributes.set(row.legacyId, []);
  actualAttributes.get(row.legacyId).push({
    key: row.attributeKey,
    label: row.label,
    valueText: row.valueText,
    valueJson: row.valueJson,
  });
}
for (const item of items) {
  const expected = attributesFor(item).map((entry) => ({
    key: entry.key,
    label: entry.label,
    valueText: entry.valueText,
    valueJson: entry.valueJson,
  }));
  const actual = actualAttributes.get(item.id) ?? [];
  if (!sameJson(actual, expected)) {
    mismatches.push(
      `${item.id} product attributes differ.`,
    );
  }
}

const sourceRows = rows(
  query(
    `SELECT p.legacy_catalog_id AS legacyId, ps.source_type AS sourceType,
            ps.source_status AS sourceStatus
     FROM products p
     JOIN product_source_records ps ON ps.product_id = p.id
     ORDER BY p.legacy_catalog_id, ps.source_type`,
  ),
);
const sourceCounts = sourceRows.reduce(
  (acc, row) => {
    acc[row.sourceType] = (acc[row.sourceType] ?? 0) + 1;
    return acc;
  },
  {},
);
if ((sourceCounts.LEGACY ?? 0) !== EXPECTED_PRODUCT_COUNT) {
  mismatches.push(
    `Expected ${EXPECTED_PRODUCT_COUNT} LEGACY source records, got ${sourceCounts.LEGACY ?? 0}`,
  );
}
const expectedOfficial = items.filter((item) => item.official).length;
if ((sourceCounts.OFFICIAL ?? 0) !== expectedOfficial) {
  mismatches.push(
    `Expected ${expectedOfficial} OFFICIAL source records, got ${sourceCounts.OFFICIAL ?? 0}`,
  );
}

const expectedWarningIds = items
  .filter((item) => item.sourceStatus)
  .map((item) => item.id)
  .sort();
const actualWarningIds = sourceRows
  .filter((row) => row.sourceType === "LEGACY" && row.sourceStatus)
  .map((row) => row.legacyId)
  .sort();
if (!sameJson(actualWarningIds, expectedWarningIds)) {
  mismatches.push("Source warning product set differs from the frozen catalogue.");
}

const categoryCount = new Set(items.flatMap((item) => item.categories)).size;
const mediaCount = items.reduce(
  (sum, item) => sum + mediaEntries(item).length,
  0,
);
const attributeCount = items.reduce(
  (sum, item) => sum + attributesFor(item).length,
  0,
);
const outOfStock = items.filter(
  (item) => effectiveSellStatus(item) === "OUT_OF_STOCK",
).length;
const arriving = items.filter(
  (item) => effectiveSellStatus(item) === "ARRIVING_SOON",
).length;
const missingPrice = items.filter((item) => moneyMinor(item.price) === null).length;
const missingImage = items.filter((item) => mediaEntries(item).length === 0).length;

const report = {
  ok: mismatches.length === 0,
  environment,
  sourceBlob: blob,
  products: productRows.length,
  categories: categoryCount,
  mediaRecords: mediaCount,
  attributes: attributeCount,
  legacySourceRecords: sourceCounts.LEGACY ?? 0,
  officialSourceRecords: sourceCounts.OFFICIAL ?? 0,
  outOfStock,
  arrivingSoon: arriving,
  missingPrice,
  missingImage,
  inventoryTracked: productRows.filter((row) => row.trackInventory === 1).length,
  mismatches,
};

const markdown = `# Black Sheep — ${environment === "production" ? "Production" : "Staging"} Product Core Parity Report

**Source catalogue blob:** ${EXPECTED_CATALOG_BLOB}  
**Environment:** ${environment}  
**Result:** ${report.ok ? "PASS" : "FAIL"}

| Check | Result |
|---|---:|
| Products | ${report.products} / ${EXPECTED_PRODUCT_COUNT} |
| Categories | ${report.categories} |
| Product media records | ${report.mediaRecords} |
| Product attributes | ${report.attributes} |
| Legacy provenance records | ${report.legacySourceRecords} |
| Official provenance records | ${report.officialSourceRecords} |
| Explicit out of stock | ${report.outOfStock} |
| Arriving soon | ${report.arrivingSoon} |
| Missing price | ${report.missingPrice} |
| Missing main/media | ${report.missingImage} |
| Inventory tracked | ${report.inventoryTracked} |

## Parity scope

Verified against the frozen catalogue:
- identity and slug,
- title/description/brand/type/label,
- SKU and barcode,
- exact integer price,
- current explicit availability status,
- online-ordering migration rule,
- category membership and primary category,
- legacy media paths/order/primary/alt/fit,
- structured product attributes,
- provenance record counts and warning set,
- all imported variants remain inventory-untracked.

## Mismatches

${report.mismatches.length ? report.mismatches.map((item) => `- ${item}`).join("\n") : "- None."}
`;

if (markdownPath) writeFileSync(markdownPath, markdown, "utf8");
if (jsonPath) writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

console.log(JSON.stringify(report, null, 2));

if (!report.ok) process.exit(1);
