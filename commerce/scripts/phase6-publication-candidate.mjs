import { isDeepStrictEqual } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const remote = argv.includes("--remote");
const envIndex = argv.indexOf("--env");
const environment = envIndex >= 0 ? argv[envIndex + 1] : null;
const candidateIndex = argv.indexOf("--candidate-out");
const reportIndex = argv.indexOf("--report-out");
const candidatePath = candidateIndex >= 0 ? argv[candidateIndex + 1] : null;
const reportPath = reportIndex >= 0 ? argv[reportIndex + 1] : null;
const requireParity = argv.includes("--require-baseline-parity");

if (!remote || environment !== "staging") {
  throw new Error(
    "Phase 6 publication candidate export is staging-only. Run with --remote --env staging.",
  );
}

const repoRoot = resolve(process.cwd(), "..");
const legacyCataloguePath = resolve(repoRoot, "assets/catalog.js");

function query(command) {
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(
    executable,
    [
      "--no-install",
      "wrangler",
      "d1",
      "execute",
      "DB",
      "--remote",
      "--env",
      "staging",
      "--command",
      command,
      "--json",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
      maxBuffer: 40 * 1024 * 1024,
    },
  );

  if (result.status !== 0) {
    throw new Error(
      "Wrangler query failed.\n" +
        String(result.stdout ?? "") +
        "\n" +
        String(result.stderr ?? ""),
    );
  }

  return JSON.parse(String(result.stdout ?? "").trim());
}

function rows(payload) {
  const block = Array.isArray(payload) ? payload[0] : payload;
  return block?.results ?? [];
}

function parseJson(value, fallback = null) {
  if (value == null || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("Invalid JSON stored in Product Core publication data.");
  }
}

function money(minor) {
  return minor == null ? undefined : Number(minor) / 100;
}

function normalizeFit(value) {
  return String(value || "CONTAIN").toLowerCase() === "cover"
    ? "cover"
    : "contain";
}

function mediaSrc(row) {
  if (
    row.storageProvider === "LEGACY_REPO" &&
    String(row.storageKey || "").startsWith("images/")
  ) {
    return String(row.storageKey).slice("images/".length);
  }
  return String(row.publicUrl || "");
}

function normalizeMediaEntry(entry, itemFit) {
  return {
    src: String(entry?.src || ""),
    alt: String(entry?.alt || ""),
    fit: normalizeFit(entry?.fit || itemFit),
  };
}

function normalizeOfficial(value) {
  if (!value || typeof value !== "object") return null;
  return value;
}

function semanticProjection(item) {
  const status =
    item.availabilityStatus === "arriving-soon"
      ? "ARRIVING_SOON"
      : item.stockStatus === "out-of-stock"
        ? "OUT_OF_STOCK"
        : item.sellStatus === "NOT_FOR_SALE"
          ? "NOT_FOR_SALE"
          : "AUTO";

  const gallery = Array.isArray(item.gallery)
    ? item.gallery.map((entry) => normalizeMediaEntry(entry, item.imageFit))
    : item.img
      ? [
          normalizeMediaEntry(
            {
              src: item.img,
              alt: item.official?.imageAlt || item.name,
              fit: item.imageFit,
            },
            item.imageFit,
          ),
        ]
      : [];

  const attributes = {};
  for (const key of [
    "dimensions",
    "material",
    "packaging",
    "suitability",
    "care",
    "range",
    "lighting",
    "battery",
    "features",
  ]) {
    if (item[key] !== undefined) attributes[key] = item[key];
  }

  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    desc: item.desc ?? "",
    brand: item.brand ?? null,
    label: item.label ?? null,
    note: item.note ?? null,
    type: item.type,
    sku: item.sku ?? null,
    barcode: item.barcode ?? null,
    price: typeof item.price === "number" ? item.price : null,
    categories: item.categories ?? [],
    category: item.category ?? item.categories?.[0] ?? null,
    status,
    img: item.img || "",
    imageFit: normalizeFit(item.imageFit),
    media: gallery,
    imagePending: item.imagePending === true,
    official: normalizeOfficial(item.official),
    attributes,
    legacyMetadata: {
      confidence: item.confidence ?? null,
      sourceId: item.sourceId ?? null,
      priceSource: item.priceSource ?? null,
      source: item.source ?? null,
      sourceStatus: item.sourceStatus ?? null,
      sourceNotes: item.sourceNotes ?? null,
      availabilitySource: item.availabilitySource ?? null,
      availabilityUpdatedAt: item.availabilityUpdatedAt ?? null,
      availabilityLabel: item.availabilityLabel ?? null,
      sourceImages: item.sourceImages ?? null,
    },
  };
}

function loadLegacyCatalogue() {
  const source = readFileSync(legacyCataloguePath, "utf8").trim();
  const json = source.replace(/^window\.CATALOG=/, "").replace(/;$/, "");
  const catalogue = JSON.parse(json);
  const items = Object.entries(catalogue).flatMap(([section, list]) =>
    (list ?? []).map((item, position) => ({
      section,
      position,
      item,
    })),
  );
  return { catalogue, items };
}

const productRows = rows(
  query(
    `SELECT
      p.id AS productId,
      p.legacy_catalog_id AS legacyId,
      p.current_slug AS slug,
      p.sell_status AS sellStatus,
      p.online_ordering_enabled AS onlineOrderingEnabled,
      p.featured,
      p.updated_at AS productUpdatedAt,
      pv.id AS publishedVersionId,
      pv.version_number AS publishedVersionNumber,
      pv.title,
      pv.short_description AS shortDescription,
      pv.long_description AS longDescription,
      pv.brand,
      pv.collection_label AS collectionLabel,
      pv.product_type AS productType,
      pv.public_note AS publicNote,
      pv.seo_title AS seoTitle,
      pv.seo_description AS seoDescription,
      v.id AS variantId,
      v.sku,
      v.barcode,
      v.price_minor AS priceMinor,
      v.currency,
      v.track_inventory AS trackInventory
    FROM products p
    JOIN product_versions pv ON pv.id = p.current_published_version_id
    JOIN product_variants v
      ON v.product_id = p.id
     AND v.is_default = 1
     AND v.active = 1
    WHERE p.publication_status = 'ACTIVE'
      AND p.current_published_version_id IS NOT NULL
    ORDER BY COALESCE(p.legacy_catalog_id, p.id)`,
  ),
);

const categoryRows = rows(
  query(
    `SELECT
      p.id AS productId,
      c.slug,
      c.name,
      pvc.position,
      pvc.is_primary AS isPrimary
    FROM products p
    JOIN product_version_categories pvc
      ON pvc.product_version_id = p.current_published_version_id
    JOIN categories c ON c.id = pvc.category_id
    WHERE p.publication_status = 'ACTIVE'
      AND p.current_published_version_id IS NOT NULL
      AND c.active = 1
    ORDER BY p.id, pvc.position, c.slug`,
  ),
);

const mediaRows = rows(
  query(
    `SELECT
      p.id AS productId,
      pm.id AS mediaId,
      pm.storage_provider AS storageProvider,
      pm.storage_key AS storageKey,
      pm.public_url AS publicUrl,
      pvm.position,
      pvm.is_primary AS isPrimary,
      pvm.alt_text AS altText,
      pvm.display_fit AS displayFit
    FROM products p
    JOIN product_version_media pvm
      ON pvm.product_version_id = p.current_published_version_id
    JOIN product_media pm ON pm.id = pvm.media_id
    WHERE p.publication_status = 'ACTIVE'
      AND p.current_published_version_id IS NOT NULL
      AND pm.deleted_at IS NULL
    ORDER BY p.id, pvm.position, pm.id`,
  ),
);

const attributeRows = rows(
  query(
    `SELECT
      p.id AS productId,
      pa.attribute_key AS attributeKey,
      pa.label,
      pa.value_text AS valueText,
      pa.value_json AS valueJson,
      pa.position,
      COALESCE(ps.source_type, '') AS sourceType
    FROM products p
    JOIN product_attributes pa
      ON pa.product_version_id = p.current_published_version_id
    LEFT JOIN product_source_records ps
      ON ps.id = pa.source_record_id
    WHERE p.publication_status = 'ACTIVE'
      AND p.current_published_version_id IS NOT NULL
      AND pa.visibility = 'PUBLIC'
    ORDER BY p.id, pa.position, pa.attribute_key`,
  ),
);

const sourceRows = rows(
  query(
    `SELECT
      p.id AS productId,
      ps.source_type AS sourceType,
      ps.source_payload_json AS sourcePayloadJson,
      ps.created_at AS createdAt
    FROM products p
    JOIN product_source_records ps ON ps.product_id = p.id
    WHERE p.publication_status = 'ACTIVE'
      AND p.current_published_version_id IS NOT NULL
      AND ps.source_type IN ('LEGACY','OFFICIAL')
    ORDER BY p.id, ps.source_type, ps.created_at DESC`,
  ),
);

const categoriesByProduct = new Map();
for (const row of categoryRows) {
  if (!categoriesByProduct.has(row.productId)) {
    categoriesByProduct.set(row.productId, []);
  }
  categoriesByProduct.get(row.productId).push(row);
}

const mediaByProduct = new Map();
for (const row of mediaRows) {
  if (!mediaByProduct.has(row.productId)) mediaByProduct.set(row.productId, []);
  mediaByProduct.get(row.productId).push(row);
}

const attributesByProduct = new Map();
for (const row of attributeRows) {
  if (!attributesByProduct.has(row.productId)) {
    attributesByProduct.set(row.productId, []);
  }
  attributesByProduct.get(row.productId).push(row);
}

const sourcesByProduct = new Map();
for (const row of sourceRows) {
  if (!sourcesByProduct.has(row.productId)) {
    sourcesByProduct.set(row.productId, {});
  }
  const source = sourcesByProduct.get(row.productId);
  if (!source[row.sourceType]) {
    source[row.sourceType] = parseJson(row.sourcePayloadJson, {});
  }
}

const topLevelAttributeKeys = new Set([
  "dimensions",
  "material",
  "packaging",
  "suitability",
  "care",
  "range",
  "lighting",
  "battery",
  "features",
]);

function buildCandidateItem(row) {
  const source = sourcesByProduct.get(row.productId) ?? {};
  const legacy = source.LEGACY && typeof source.LEGACY === "object"
    ? { ...source.LEGACY }
    : {};
  const official = source.OFFICIAL && typeof source.OFFICIAL === "object"
    ? { ...source.OFFICIAL }
    : null;

  const item = {
    ...legacy,
    id: row.legacyId || row.productId,
    slug: row.slug,
    name: row.title,
    desc: row.shortDescription ?? "",
    brand: row.brand ?? "",
    label: row.collectionLabel ?? "",
    type: row.productType,
  };

  if (row.publicNote != null && row.publicNote !== "") item.note = row.publicNote;
  else delete item.note;

  if (row.sku != null && row.sku !== "") item.sku = row.sku;
  else delete item.sku;

  if (row.barcode != null && row.barcode !== "") item.barcode = row.barcode;
  else delete item.barcode;

  if (row.priceMinor != null) item.price = money(row.priceMinor);
  else delete item.price;

  if (Number(row.featured) === 1) item.featured = true;
  else delete item.featured;

  // Preserve an explicit publication-safe flag for future static fallback behavior.
  if (Number(row.onlineOrderingEnabled) === 0) item.onlineOrderingEnabled = false;
  else delete item.onlineOrderingEnabled;

  delete item.availabilityStatus;
  delete item.stockStatus;
  delete item.sellStatus;
  if (row.sellStatus === "ARRIVING_SOON") {
    item.availabilityStatus = "arriving-soon";
  } else if (row.sellStatus === "OUT_OF_STOCK") {
    item.stockStatus = "out-of-stock";
  } else if (row.sellStatus === "NOT_FOR_SALE") {
    item.sellStatus = "NOT_FOR_SALE";
  }

  const categoryRows = categoriesByProduct.get(row.productId) ?? [];
  item.categories = categoryRows.map((entry) => entry.slug);
  const primary =
    categoryRows.find((entry) => Number(entry.isPrimary) === 1)?.slug ??
    item.categories[0] ??
    null;
  if (primary) item.category = primary;
  else delete item.category;

  const publishedMedia = mediaByProduct.get(row.productId) ?? [];
  const main =
    publishedMedia.find((entry) => Number(entry.isPrimary) === 1) ??
    publishedMedia[0] ??
    null;

  if (main) {
    item.img = mediaSrc(main);
    item.imageFit = normalizeFit(main.displayFit);
    delete item.imagePending;
  } else {
    item.img = "";
    item.imageFit = "contain";
    item.imagePending = true;
  }

  if (publishedMedia.length > 1) {
    item.gallery = publishedMedia.map((entry) => {
      const result = {
        src: mediaSrc(entry),
        alt: entry.altText || row.title,
      };
      if (normalizeFit(entry.displayFit) === "cover") result.fit = "cover";
      return result;
    });
  } else {
    delete item.gallery;
  }

  if (official) item.official = official;
  else delete item.official;

  for (const attr of attributesByProduct.get(row.productId) ?? []) {
    let value = attr.valueText;
    if (attr.valueJson != null && attr.valueJson !== "") {
      value = parseJson(attr.valueJson);
    }
    if (topLevelAttributeKeys.has(attr.attributeKey)) {
      item[attr.attributeKey] = value;
    } else if (attr.sourceType === "OFFICIAL" && item.official) {
      const key =
        attr.attributeKey === "official_notes"
          ? "notes"
          : attr.attributeKey;
      if (item.official[key] === undefined) item.official[key] = value;
    }
  }

  return {
    item,
    publication: {
      productId: row.productId,
      publishedVersionId: row.publishedVersionId,
      publishedVersionNumber: Number(row.publishedVersionNumber),
      productUpdatedAt: row.productUpdatedAt,
      seoTitle: row.seoTitle ?? null,
      seoDescription: row.seoDescription ?? null,
      longDescription: row.longDescription ?? null,
      trackInventory: Number(row.trackInventory) === 1,
      r2Media: publishedMedia
        .filter((entry) => entry.storageProvider === "R2")
        .map((entry) => ({
          mediaId: entry.mediaId,
          publicUrl: entry.publicUrl,
          position: Number(entry.position),
          isPrimary: Number(entry.isPrimary) === 1,
        })),
    },
  };
}

const built = productRows.map(buildCandidateItem);
const { catalogue: legacyCatalogue, items: legacyItems } = loadLegacyCatalogue();
const legacyById = new Map(legacyItems.map((entry) => [entry.item.id, entry]));
const candidateById = new Map(built.map((entry) => [entry.item.id, entry]));

const semanticMismatches = [];
for (const legacy of legacyItems) {
  const candidate = candidateById.get(legacy.item.id);
  if (!candidate) {
    semanticMismatches.push({
      id: legacy.item.id,
      kind: "missing_from_candidate",
    });
    continue;
  }

  const expected = semanticProjection(legacy.item);
  const actual = semanticProjection(candidate.item);
  // The frozen baseline predates the explicit onlineOrderingEnabled field.
  delete actual.onlineOrderingEnabled;
  if (!isDeepStrictEqual(expected, actual)) {
    semanticMismatches.push({
      id: legacy.item.id,
      kind: "semantic_difference",
      expected,
      actual,
    });
  }
}

const newProducts = built
  .filter((entry) => !legacyById.has(entry.item.id))
  .map((entry) => entry.item.id);
const archivedOrMissing = legacyItems
  .filter((entry) => !candidateById.has(entry.item.id))
  .map((entry) => entry.item.id);

const knownSections = Object.keys(legacyCatalogue);
const candidateCatalogue = Object.fromEntries(
  knownSections.map((section) => [section, []]),
);

for (const legacy of legacyItems) {
  const candidate = candidateById.get(legacy.item.id);
  if (!candidate) continue;
  const section = knownSections.includes(candidate.item.type)
    ? candidate.item.type
    : legacy.section;
  if (!candidateCatalogue[section]) candidateCatalogue[section] = [];
  candidateCatalogue[section].push(candidate.item);
}

for (const entry of built) {
  if (legacyById.has(entry.item.id)) continue;
  const section = knownSections.includes(entry.item.type)
    ? entry.item.type
    : "gifts";
  if (!candidateCatalogue[section]) candidateCatalogue[section] = [];
  candidateCatalogue[section].push(entry.item);
}

const r2Media = built.flatMap((entry) =>
  entry.publication.r2Media.map((media) => ({
    id: entry.item.id,
    slug: entry.item.slug,
    ...media,
  })),
);

const report = {
  ok:
    semanticMismatches.length === 0 &&
    archivedOrMissing.length === 0,
  environment: "staging",
  activePublishedProducts: productRows.length,
  baselineProducts: legacyItems.length,
  candidateProducts: built.length,
  matchedBaselineProducts:
    legacyItems.length - archivedOrMissing.length,
  newProducts,
  archivedOrMissing,
  semanticMismatchCount: semanticMismatches.length,
  semanticMismatches,
  categoryLinks: categoryRows.length,
  mediaLinks: mediaRows.length,
  publicAttributes: attributeRows.length,
  sourceRecords: sourceRows.length,
  r2MediaNeedingProductionPublication: r2Media,
};

if (candidatePath) {
  writeFileSync(
    resolve(process.cwd(), candidatePath),
    "window.CATALOG=" + JSON.stringify(candidateCatalogue) + ";\n",
    "utf8",
  );
}

if (reportPath) {
  writeFileSync(
    resolve(process.cwd(), reportPath),
    JSON.stringify(report, null, 2) + "\n",
    "utf8",
  );
}

console.log(JSON.stringify(report, null, 2));

if (requireParity && !report.ok) process.exit(1);
