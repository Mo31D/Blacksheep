import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const EXPECTED_CATALOG_BLOB =
  "b382d8e161f165f7291da34b1cb23bef06c2742d";
export const EXPECTED_PRODUCT_COUNT = 146;
export const IMPORTED_AT = "2026-09-25T17:30:00.000Z";
export const STOREFRONT_ORIGIN = "https://theblacksheepshop.co.uk";

export function gitBlobSha(content) {
  const body = Buffer.from(content, "utf8");
  return createHash("sha1")
    .update(Buffer.concat([Buffer.from(`blob ${body.length}\0`), body]))
    .digest("hex");
}

export function stableId(prefix, value) {
  const hash = createHash("sha256").update(String(value)).digest("hex").slice(0, 24);
  return `${prefix}_${hash}`;
}

export function loadFrozenCatalogue() {
  const path = resolve(
    process.cwd(),
    "fixtures/product-core-baseline.catalog.js",
  );
  const content = readFileSync(path, "utf8");
  const blob = gitBlobSha(content);
  if (blob !== EXPECTED_CATALOG_BLOB) {
    throw new Error(
      `Frozen catalogue mismatch. Expected ${EXPECTED_CATALOG_BLOB}, got ${blob}. Rebase the Phase 1 migration baseline deliberately before importing.`,
    );
  }
  const json = content.trim().replace(/^window\.CATALOG=/, "").replace(/;$/, "");
  const catalogue = JSON.parse(json);
  const items = Object.entries(catalogue).flatMap(([section, list]) =>
    (list ?? []).map((item) => ({ ...item, section })),
  );
  validateCatalogue(items);
  return { catalogue, items, blob };
}

export function validateCatalogue(items) {
  if (items.length !== EXPECTED_PRODUCT_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_PRODUCT_COUNT} products, found ${items.length}.`,
    );
  }

  for (const field of ["id", "slug"]) assertUnique(items, field, true);
  for (const field of ["sku", "barcode"]) assertUnique(items, field, false);

  for (const item of items) {
    if (!item.name || !item.type || !Array.isArray(item.categories)) {
      throw new Error(`Catalogue identity/content incomplete for ${item.id ?? "unknown"}.`);
    }
    if (typeof item.price === "number" && (!Number.isFinite(item.price) || item.price < 0)) {
      throw new Error(`Invalid price for ${item.id}.`);
    }
  }
}

function assertUnique(items, field, required) {
  const seen = new Map();
  for (const item of items) {
    const value = item[field];
    if (value == null || value === "") {
      if (required) throw new Error(`Missing required ${field} for ${item.id ?? "unknown"}.`);
      continue;
    }
    if (seen.has(value)) {
      throw new Error(
        `Duplicate ${field} ${value}: ${seen.get(value)} and ${item.id}.`,
      );
    }
    seen.set(value, item.id);
  }
}

export function productId(item) {
  return stableId("prd", item.id);
}

export function versionId(item) {
  return stableId("pver", `${item.id}:v1`);
}

export function variantId(item) {
  return stableId("var", `${item.id}:default`);
}

export function categoryId(slug) {
  return stableId("cat", slug);
}

export function sourceId(item, kind) {
  return stableId("src", `${item.id}:${kind}`);
}

export function auditId(item) {
  return stableId("pae", `${item.id}:import:v1`);
}

export function moneyMinor(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value * 100)
    : null;
}

export function effectiveSellStatus(item) {
  if (item.availabilityStatus === "arriving-soon") return "ARRIVING_SOON";
  if (item.stockStatus === "out-of-stock") return "OUT_OF_STOCK";
  return "AUTO";
}

export function onlineOrderingEnabled(item) {
  return item.type === "icecream" ? 0 : 1;
}

export function categoryName(slug) {
  const names = {
    romneys: "Romney's",
    hawkshead: "Hawkshead Relish",
    icecream: "Ice Cream",
    "highland-cows": "Highland Cows",
    "peter-rabbit": "Peter Rabbit",
    "home-gifts": "Home & Gifts",
    "keyrings-badges": "Keyrings & Badges",
    "toys-games": "Toys & Games",
    "gift-boxes": "Gift Boxes",
    "savoury-sauces": "Savoury Sauces",
    "jams-preserves": "Jams & Preserves",
  };
  return (
    names[slug] ??
    slug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

export function mediaEntries(item) {
  const entries = [];
  const push = (src, alt, fit) => {
    if (!src || entries.some((entry) => entry.src === src)) return;
    entries.push({
      src,
      alt: alt || item.name,
      fit: String(fit || item.imageFit || "contain").toUpperCase() === "COVER"
        ? "COVER"
        : "CONTAIN",
    });
  };

  const mainGallery = Array.isArray(item.gallery)
    ? item.gallery.find((entry) => entry?.src === item.img)
    : null;
  push(
    item.img,
    mainGallery?.alt || item.official?.imageAlt || item.name,
    mainGallery?.fit || item.imageFit,
  );

  for (const entry of item.gallery ?? []) {
    push(entry?.src, entry?.alt, entry?.fit);
  }
  return entries;
}

const TOP_LEVEL_ATTRIBUTE_KEYS = [
  "dimensions",
  "material",
  "packaging",
  "suitability",
  "care",
  "range",
  "lighting",
  "battery",
  "features",
];

const OFFICIAL_ATTRIBUTE_KEYS = [
  "ingredients",
  "allergens",
  "mayContain",
  "dietary",
  "nutrition",
  "nutritionPer100ml",
  "storage",
  "pack",
  "awards",
  "manufacturerFormats",
  "vegetarian",
  "glutenFree",
  "glutenFreePublished",
  "alcohol",
  "notes",
];

function attributeLabel(key) {
  const overrides = {
    mayContain: "May contain",
    nutritionPer100ml: "Nutrition per 100ml",
    manufacturerFormats: "Manufacturer formats",
    glutenFree: "Gluten free",
    glutenFreePublished: "Gluten-free claim published",
    notes: "Official notes",
  };
  return (
    overrides[key] ??
    key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())
  );
}

export function attributesFor(item) {
  const rows = [];
  for (const key of TOP_LEVEL_ATTRIBUTE_KEYS) {
    if (item[key] == null || item[key] === "") continue;
    rows.push(makeAttribute(key, attributeLabel(key), item[key], "legacy"));
  }
  for (const key of OFFICIAL_ATTRIBUTE_KEYS) {
    const value = item.official?.[key];
    if (value == null || value === "") continue;
    const attrKey = key === "notes" ? "official_notes" : key;
    rows.push(makeAttribute(attrKey, attributeLabel(key), value, "official"));
  }
  return rows;
}

function makeAttribute(key, label, value, sourceKind) {
  if (typeof value === "object") {
    return {
      key,
      label,
      valueText: null,
      valueJson: JSON.stringify(value),
      sourceKind,
    };
  }
  return {
    key,
    label,
    valueText: String(value),
    valueJson: null,
    sourceKind,
  };
}

export function legacySourcePayload(item) {
  const keys = [
    "section",
    "confidence",
    "sourceId",
    "priceSource",
    "source",
    "sourceStatus",
    "sourceNotes",
    "availabilitySource",
    "availabilityUpdatedAt",
    "availabilityLabel",
    "sourceImages",
    "imagePending",
  ];
  const payload = {};
  for (const key of keys) {
    if (item[key] !== undefined) payload[key] = item[key];
  }
  return payload;
}

export function sql(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot serialize non-finite number.");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  return "'" + String(value).replace(/'/g, "''") + "'";
}

export function buildImportSql(items) {
  const statements = [
    "PRAGMA foreign_keys = ON;",
    "DELETE FROM product_version_media;",
    "DELETE FROM product_attributes;",
    "DELETE FROM product_source_records;",
    "DELETE FROM product_audit_events;",
    "DELETE FROM product_media;",
    "DELETE FROM product_version_categories;",
    "DELETE FROM product_slugs;",
    "DELETE FROM product_variants;",
    "DELETE FROM product_versions;",
    "DELETE FROM products;",
    "DELETE FROM categories;",
  ];

  const categories = [...new Set(items.flatMap((item) => item.categories ?? []))].sort();
  categories.forEach((slug, index) => {
    statements.push(
      `INSERT INTO categories (id, slug, name, parent_id, active, sort_order, created_at, updated_at) VALUES (${[
        sql(categoryId(slug)),
        sql(slug),
        sql(categoryName(slug)),
        "NULL",
        "1",
        String(index),
        sql(IMPORTED_AT),
        sql(IMPORTED_AT),
      ].join(", ")});`,
    );
  });

  for (const item of [...items].sort((a, b) => a.id.localeCompare(b.id))) {
    const pid = productId(item);
    const pver = versionId(item);
    const vid = variantId(item);
    const legacySource = sourceId(item, "legacy");
    const officialSource = item.official ? sourceId(item, "official") : null;
    const priceMinor = moneyMinor(item.price);
    const sellStatus = effectiveSellStatus(item);

    statements.push(
      `INSERT INTO products (id, legacy_catalog_id, current_slug, publication_status, sell_status, online_ordering_enabled, featured, current_published_version_id, current_draft_version_id, version, created_at, updated_at, archived_at) VALUES (${[
        sql(pid),
        sql(item.id),
        sql(item.slug),
        sql("ACTIVE"),
        sql(sellStatus),
        String(onlineOrderingEnabled(item)),
        item.featured ? "1" : "0",
        sql(pver),
        "NULL",
        "1",
        sql(IMPORTED_AT),
        sql(IMPORTED_AT),
        "NULL",
      ].join(", ")});`,
    );

    statements.push(
      `INSERT INTO product_versions (id, product_id, version_number, title, short_description, long_description, brand, collection_label, product_type, public_note, seo_title, seo_description, created_by, created_at, published_at, superseded_at) VALUES (${[
        sql(pver),
        sql(pid),
        "1",
        sql(item.name),
        sql(item.desc ?? ""),
        "NULL",
        sql(item.brand ?? null),
        sql(item.label ?? null),
        sql(item.type),
        sql(item.note ?? null),
        "NULL",
        "NULL",
        sql("catalogue-import"),
        sql(IMPORTED_AT),
        sql(IMPORTED_AT),
        "NULL",
      ].join(", ")});`,
    );

    statements.push(
      `INSERT INTO product_slugs (product_id, slug, is_primary, created_at, retired_at) VALUES (${[
        sql(pid),
        sql(item.slug),
        "1",
        sql(IMPORTED_AT),
        "NULL",
      ].join(", ")});`,
    );

    statements.push(
      `INSERT INTO product_variants (id, product_id, title, sku, barcode, price_minor, compare_at_price_minor, cost_minor, currency, track_inventory, low_stock_threshold, active, is_default, version, created_at, updated_at) VALUES (${[
        sql(vid),
        sql(pid),
        sql("Default"),
        sql(item.sku ?? null),
        sql(item.barcode ?? null),
        sql(priceMinor),
        "NULL",
        "NULL",
        sql("GBP"),
        "0",
        "NULL",
        "1",
        "1",
        "1",
        sql(IMPORTED_AT),
        sql(IMPORTED_AT),
      ].join(", ")});`,
    );

    const primaryCategory =
      item.category && item.categories.includes(item.category)
        ? item.category
        : item.categories[0] ?? null;
    item.categories.forEach((slug, index) => {
      statements.push(
        `INSERT INTO product_version_categories (product_version_id, category_id, is_primary, position) VALUES (${[
          sql(pver),
          sql(categoryId(slug)),
          slug === primaryCategory ? "1" : "0",
          String(index),
        ].join(", ")});`,
      );
    });

    const legacyPayload = legacySourcePayload(item);
    statements.push(
      `INSERT INTO product_source_records (id, product_id, source_type, source_name, source_url, supplier_url, external_product_code, confidence, source_status, notes, verified_at, source_payload_json, created_at, created_by) VALUES (${[
        sql(legacySource),
        sql(pid),
        sql("LEGACY"),
        sql("GitHub catalogue"),
        "NULL",
        "NULL",
        sql(item.sourceId ?? null),
        sql(item.confidence ?? null),
        sql(item.sourceStatus ?? null),
        sql(item.sourceNotes ?? null),
        sql(item.availabilityUpdatedAt ?? null),
        sql(JSON.stringify(legacyPayload)),
        sql(IMPORTED_AT),
        sql("catalogue-import"),
      ].join(", ")});`,
    );

    if (item.official) {
      statements.push(
        `INSERT INTO product_source_records (id, product_id, source_type, source_name, source_url, supplier_url, external_product_code, confidence, source_status, notes, verified_at, source_payload_json, created_at, created_by) VALUES (${[
          sql(officialSource),
          sql(pid),
          sql("OFFICIAL"),
          sql(item.official.manufacturer ?? item.official.brand ?? "Official product source"),
          sql(item.official.url ?? null),
          sql(item.official.supplierUrl ?? null),
          sql(item.official.productCode ?? null),
          sql(item.confidence ?? null),
          "NULL",
          sql(item.official.notes ?? null),
          sql(
            item.official.verifiedAt ??
              item.official.checked ??
              item.official.sourceSyncedAt ??
              null,
          ),
          sql(JSON.stringify(item.official)),
          sql(IMPORTED_AT),
          sql("catalogue-import"),
        ].join(", ")});`,
      );
    }

    attributesFor(item).forEach((attribute, index) => {
      statements.push(
        `INSERT INTO product_attributes (product_version_id, attribute_key, label, value_text, value_json, visibility, position, source_record_id) VALUES (${[
          sql(pver),
          sql(attribute.key),
          sql(attribute.label),
          sql(attribute.valueText),
          sql(attribute.valueJson),
          sql("PUBLIC"),
          String(index),
          sql(attribute.sourceKind === "official" ? officialSource : legacySource),
        ].join(", ")});`,
      );
    });

    mediaEntries(item).forEach((media, index) => {
      const mid = stableId("med", `${item.id}:${media.src}`);
      const extension = media.src.split(".").pop()?.toLowerCase();
      const mime =
        extension === "webp"
          ? "image/webp"
          : extension === "png"
            ? "image/png"
            : extension === "jpg" || extension === "jpeg"
              ? "image/jpeg"
              : null;
      const isMain = index === 0;
      statements.push(
        `INSERT INTO product_media (id, product_id, variant_id, storage_provider, storage_key, public_url, mime_type, width, height, file_size, checksum_sha256, created_by, created_at, deleted_at) VALUES (${[
          sql(mid),
          sql(pid),
          "NULL",
          sql("LEGACY_REPO"),
          sql(`images/${media.src}`),
          sql(`${STOREFRONT_ORIGIN}/images/${media.src}`),
          sql(mime),
          sql(isMain ? item.official?.width ?? null : null),
          sql(isMain ? item.official?.height ?? null : null),
          "NULL",
          "NULL",
          sql("catalogue-import"),
          sql(IMPORTED_AT),
          "NULL",
        ].join(", ")});`,
      );
      statements.push(
        `INSERT INTO product_version_media (product_version_id, media_id, position, is_primary, alt_text, display_fit) VALUES (${[
          sql(pver),
          sql(mid),
          String(index),
          isMain ? "1" : "0",
          sql(media.alt),
          sql(media.fit),
        ].join(", ")});`,
      );
    });

    statements.push(
      `INSERT INTO product_audit_events (id, product_id, variant_id, event_type, actor_type, actor_id, request_id, idempotency_key, before_json, after_json, reason, created_at) VALUES (${[
        sql(auditId(item)),
        sql(pid),
        sql(vid),
        sql("PRODUCT_IMPORTED"),
        sql("SYSTEM"),
        sql("catalogue-import"),
        "NULL",
        "NULL",
        "NULL",
        sql(
          JSON.stringify({
            legacyCatalogId: item.id,
            sourceBlob: EXPECTED_CATALOG_BLOB,
            publicationStatus: "ACTIVE",
            sellStatus,
            priceMinor,
            trackInventory: false,
          }),
        ),
        sql("Phase 1 deterministic legacy catalogue import"),
        sql(IMPORTED_AT),
      ].join(", ")});`,
    );
  }

  return statements.join("\n");
}
