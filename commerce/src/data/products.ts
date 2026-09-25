import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1";

export interface AdminProductListFilters {
  q?: string;
  publication?: string | null;
  sellStatus?: string | null;
  stock?: string | null;
  category?: string | null;
  quality?: string | null;
  sort?: string | null;
  cursor?: string | null;
  limit?: number;
}

export interface AdminProductSummary {
  id: string;
  legacyId: string | null;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  sku: string | null;
  barcode: string | null;
  priceMinor: number | null;
  currency: string;
  publicationStatus: string;
  sellStatus: string;
  onlineOrderingEnabled: boolean;
  inventory: {
    tracked: boolean;
    onHand: null;
    reserved: null;
    available: null;
    incoming: number;
  };
  qualityFlags: string[];
  version: number;
  updatedAt: string;
}

export interface AdminProductListResult {
  products: AdminProductSummary[];
  nextCursor: string | null;
  summary: {
    total: number;
    outOfStock: number;
    arrivingSoon: number;
    untracked: number;
    missingImage: number;
    missingPrice: number;
    dataWarnings: number;
  };
}

async function allRows<T>(
  statement: D1PreparedStatementLike,
): Promise<T[]> {
  if (!statement.all) throw new Error("database_all_unavailable");
  return (await statement.all<T>()).results;
}

function safeLimit(value?: number): number {
  if (!Number.isFinite(value)) return 60;
  return Math.max(1, Math.min(100, Math.floor(value ?? 60)));
}

function safeOffset(cursor?: string | null): number {
  if (!cursor) return 0;
  const parsed = Number(cursor);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function qualityFlags(row: {
  priceMinor: number | null;
  thumbnailUrl: string | null;
  hasSourceWarning: number;
  hasDraft: number;
}): string[] {
  const flags: string[] = [];
  if (row.priceMinor === null) flags.push("MISSING_PRICE");
  if (!row.thumbnailUrl) flags.push("MISSING_IMAGE");
  if (Number(row.hasSourceWarning) === 1) flags.push("SOURCE_WARNING");
  if (Number(row.hasDraft) === 1) flags.push("DRAFT_CHANGES");
  return flags;
}

function listWhere(filters: AdminProductListFilters): {
  sql: string;
  values: unknown[];
} {
  const conditions: string[] = [];
  const values: unknown[] = [];

  const q = (filters.q ?? "").trim().toLowerCase();
  if (q) {
    conditions.push(`(
      LOWER(pv.title) LIKE ? OR
      LOWER(COALESCE(v.sku, '')) LIKE ? OR
      LOWER(COALESCE(v.barcode, '')) LIKE ? OR
      LOWER(COALESCE(p.legacy_catalog_id, '')) LIKE ? OR
      LOWER(p.current_slug) LIKE ? OR
      LOWER(COALESCE(pv.brand, '')) LIKE ?
    )`);
    const like = "%" + q + "%";
    values.push(like, like, like, like, like, like);
  }

  if (filters.publication) {
    conditions.push("p.publication_status = ?");
    values.push(filters.publication);
  }

  if (filters.sellStatus) {
    conditions.push("p.sell_status = ?");
    values.push(filters.sellStatus);
  }

  if (filters.category) {
    conditions.push(`EXISTS (
      SELECT 1
      FROM product_version_categories pvc_filter
      JOIN categories c_filter ON c_filter.id = pvc_filter.category_id
      WHERE pvc_filter.product_version_id = pv.id AND c_filter.slug = ?
    )`);
    values.push(filters.category);
  }

  switch (filters.quality) {
    case "missing-image":
      conditions.push("pvm.media_id IS NULL");
      break;
    case "missing-price":
      conditions.push("v.price_minor IS NULL");
      break;
    case "source-warning":
      conditions.push(`EXISTS (
        SELECT 1 FROM product_source_records ps_filter
        WHERE ps_filter.product_id = p.id
          AND ps_filter.source_status IS NOT NULL
          AND TRIM(ps_filter.source_status) <> ''
      )`);
      break;
    case "draft":
      conditions.push("p.current_draft_version_id IS NOT NULL");
      break;
  }

  switch (filters.stock) {
    case "untracked":
      conditions.push("v.track_inventory = 0");
      break;
    case "out":
      conditions.push("p.sell_status = 'OUT_OF_STOCK'");
      break;
    case "incoming":
      conditions.push("p.sell_status = 'ARRIVING_SOON'");
      break;
    case "in-stock":
      conditions.push(
        "p.sell_status = 'AUTO' AND p.online_ordering_enabled = 1 AND v.active = 1 AND v.price_minor IS NOT NULL",
      );
      break;
    case "low":
      conditions.push("1 = 0");
      break;
  }

  return {
    sql: conditions.length ? "WHERE " + conditions.join(" AND ") : "",
    values,
  };
}

function orderBy(sort?: string | null): string {
  switch (sort) {
    case "updated":
      return "p.updated_at DESC, pv.title COLLATE NOCASE ASC";
    case "price":
      return "v.price_minor IS NULL, v.price_minor ASC, pv.title COLLATE NOCASE ASC";
    case "price-desc":
      return "v.price_minor IS NULL, v.price_minor DESC, pv.title COLLATE NOCASE ASC";
    default:
      return "pv.title COLLATE NOCASE ASC, p.id ASC";
  }
}

export async function listAdminProducts(
  db: D1DatabaseLike,
  filters: AdminProductListFilters = {},
): Promise<AdminProductListResult> {
  const limit = safeLimit(filters.limit);
  const offset = safeOffset(filters.cursor);
  const where = listWhere(filters);

  const query =
    "SELECT " +
    "p.id, p.legacy_catalog_id AS legacyId, p.current_slug AS slug, " +
    "p.publication_status AS publicationStatus, p.sell_status AS sellStatus, " +
    "p.online_ordering_enabled AS onlineOrderingEnabled, p.version, p.updated_at AS updatedAt, " +
    "p.current_draft_version_id IS NOT NULL AS hasDraft, pv.title, " +
    "v.sku, v.barcode, v.price_minor AS priceMinor, v.currency, v.track_inventory AS trackInventory, " +
    "pm.public_url AS thumbnailUrl, " +
    "EXISTS (SELECT 1 FROM product_source_records ps WHERE ps.product_id = p.id " +
    "AND ps.source_status IS NOT NULL AND TRIM(ps.source_status) <> '') AS hasSourceWarning " +
    "FROM products p " +
    "JOIN product_versions pv ON pv.id = p.current_published_version_id " +
    "JOIN product_variants v ON v.product_id = p.id AND v.is_default = 1 AND v.active = 1 " +
    "LEFT JOIN product_version_media pvm ON pvm.product_version_id = pv.id AND pvm.is_primary = 1 " +
    "LEFT JOIN product_media pm ON pm.id = pvm.media_id AND pm.deleted_at IS NULL " +
    where.sql +
    " ORDER BY " +
    orderBy(filters.sort) +
    " LIMIT ? OFFSET ?";

  const rows = await allRows<{
    id: string;
    legacyId: string | null;
    slug: string;
    publicationStatus: string;
    sellStatus: string;
    onlineOrderingEnabled: number;
    version: number;
    updatedAt: string;
    hasDraft: number;
    title: string;
    sku: string | null;
    barcode: string | null;
    priceMinor: number | null;
    currency: string;
    trackInventory: number;
    thumbnailUrl: string | null;
    hasSourceWarning: number;
  }>(
    db.prepare(query).bind(...where.values, limit + 1, offset),
  );

  const pageRows = rows.slice(0, limit);
  const products = pageRows.map((row) => ({
    id: row.id,
    legacyId: row.legacyId,
    slug: row.slug,
    title: row.title,
    thumbnailUrl: row.thumbnailUrl,
    sku: row.sku,
    barcode: row.barcode,
    priceMinor: row.priceMinor,
    currency: row.currency,
    publicationStatus: row.publicationStatus,
    sellStatus: row.sellStatus,
    onlineOrderingEnabled: Number(row.onlineOrderingEnabled) === 1,
    inventory: {
      tracked: Number(row.trackInventory) === 1,
      onHand: null,
      reserved: null,
      available: null,
      incoming: row.sellStatus === "ARRIVING_SOON" ? 1 : 0,
    },
    qualityFlags: qualityFlags(row),
    version: Number(row.version),
    updatedAt: row.updatedAt,
  }));

  const summary =
    (await db
      .prepare(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN p.sell_status = 'OUT_OF_STOCK' THEN 1 ELSE 0 END) AS outOfStock,
          SUM(CASE WHEN p.sell_status = 'ARRIVING_SOON' THEN 1 ELSE 0 END) AS arrivingSoon,
          SUM(CASE WHEN v.track_inventory = 0 THEN 1 ELSE 0 END) AS untracked,
          SUM(CASE WHEN v.price_minor IS NULL THEN 1 ELSE 0 END) AS missingPrice,
          SUM(CASE WHEN NOT EXISTS (
            SELECT 1 FROM product_version_media pvm2
            WHERE pvm2.product_version_id = p.current_published_version_id
              AND pvm2.is_primary = 1
          ) THEN 1 ELSE 0 END) AS missingImage,
          SUM(CASE WHEN EXISTS (
            SELECT 1 FROM product_source_records ps2
            WHERE ps2.product_id = p.id
              AND ps2.source_status IS NOT NULL
              AND TRIM(ps2.source_status) <> ''
          ) THEN 1 ELSE 0 END) AS dataWarnings
        FROM products p
        JOIN product_variants v
          ON v.product_id = p.id AND v.is_default = 1 AND v.active = 1
      `)
      .first<{
        total: number;
        outOfStock: number;
        arrivingSoon: number;
        untracked: number;
        missingPrice: number;
        missingImage: number;
        dataWarnings: number;
      }>()) ?? {
      total: 0,
      outOfStock: 0,
      arrivingSoon: 0,
      untracked: 0,
      missingPrice: 0,
      missingImage: 0,
      dataWarnings: 0,
    };

  return {
    products,
    nextCursor: rows.length > limit ? String(offset + limit) : null,
    summary: {
      total: Number(summary.total ?? 0),
      outOfStock: Number(summary.outOfStock ?? 0),
      arrivingSoon: Number(summary.arrivingSoon ?? 0),
      untracked: Number(summary.untracked ?? 0),
      missingImage: Number(summary.missingImage ?? 0),
      missingPrice: Number(summary.missingPrice ?? 0),
      dataWarnings: Number(summary.dataWarnings ?? 0),
    },
  };
}

export async function getAdminProductDetail(
  db: D1DatabaseLike,
  productId: string,
): Promise<Record<string, unknown> | null> {
  const core = await db
    .prepare(`
      SELECT
        p.id,
        p.legacy_catalog_id AS legacyId,
        p.current_slug AS slug,
        p.publication_status AS publicationStatus,
        p.sell_status AS sellStatus,
        p.online_ordering_enabled AS onlineOrderingEnabled,
        p.featured,
        p.version,
        p.created_at AS createdAt,
        p.updated_at AS updatedAt,
        p.current_draft_version_id AS draftVersionId,
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
        v.title AS variantTitle,
        v.sku,
        v.barcode,
        v.price_minor AS priceMinor,
        v.compare_at_price_minor AS compareAtPriceMinor,
        v.currency,
        v.track_inventory AS trackInventory,
        v.low_stock_threshold AS lowStockThreshold,
        v.version AS variantVersion
      FROM products p
      JOIN product_versions pv ON pv.id = p.current_published_version_id
      JOIN product_variants v
        ON v.product_id = p.id AND v.is_default = 1 AND v.active = 1
      WHERE p.id = ?
      LIMIT 1
    `)
    .bind(productId)
    .first<Record<string, unknown>>();

  if (!core) return null;

  const [categories, media, attributes, sources, history] = await Promise.all([
    allRows<Record<string, unknown>>(
      db
        .prepare(`
          SELECT c.id, c.slug, c.name, pvc.is_primary AS isPrimary, pvc.position
          FROM product_version_categories pvc
          JOIN categories c ON c.id = pvc.category_id
          WHERE pvc.product_version_id = ?
          ORDER BY pvc.position, c.name
        `)
        .bind(core.publishedVersionId),
    ),
    allRows<Record<string, unknown>>(
      db
        .prepare(`
          SELECT pm.id, pm.storage_provider AS storageProvider,
                 pm.storage_key AS storageKey, pm.public_url AS publicUrl,
                 pm.mime_type AS mimeType, pm.width, pm.height,
                 pvm.position, pvm.is_primary AS isPrimary,
                 pvm.alt_text AS altText, pvm.display_fit AS displayFit
          FROM product_version_media pvm
          JOIN product_media pm ON pm.id = pvm.media_id
          WHERE pvm.product_version_id = ? AND pm.deleted_at IS NULL
          ORDER BY pvm.position
        `)
        .bind(core.publishedVersionId),
    ),
    allRows<Record<string, unknown>>(
      db
        .prepare(`
          SELECT attribute_key AS attributeKey, label, value_text AS valueText,
                 value_json AS valueJson, visibility, position
          FROM product_attributes
          WHERE product_version_id = ?
          ORDER BY position, label
        `)
        .bind(core.publishedVersionId),
    ),
    allRows<Record<string, unknown>>(
      db
        .prepare(`
          SELECT id, source_type AS sourceType, source_name AS sourceName,
                 source_url AS sourceUrl, supplier_url AS supplierUrl,
                 external_product_code AS externalProductCode,
                 confidence, source_status AS sourceStatus,
                 notes, verified_at AS verifiedAt
          FROM product_source_records
          WHERE product_id = ?
          ORDER BY source_type, created_at
        `)
        .bind(productId),
    ),
    allRows<Record<string, unknown>>(
      db
        .prepare(`
          SELECT id, event_type AS eventType, actor_type AS actorType,
                 actor_id AS actorId, reason, created_at AS createdAt
          FROM product_audit_events
          WHERE product_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT 20
        `)
        .bind(productId),
    ),
  ]);

  const priceMinor =
    core.priceMinor === null || core.priceMinor === undefined
      ? null
      : Number(core.priceMinor);
  const quality: string[] = [];
  if (priceMinor === null) quality.push("MISSING_PRICE");
  if (media.length === 0) quality.push("MISSING_IMAGE");
  if (sources.some((source) => Boolean(source.sourceStatus))) {
    quality.push("SOURCE_WARNING");
  }
  if (core.draftVersionId) quality.push("DRAFT_CHANGES");

  return {
    ...core,
    onlineOrderingEnabled: Number(core.onlineOrderingEnabled) === 1,
    featured: Number(core.featured) === 1,
    trackInventory: Number(core.trackInventory) === 1,
    priceMinor,
    categories: categories.map((row) => ({
      ...row,
      isPrimary: Number(row.isPrimary) === 1,
    })),
    media: media.map((row) => ({
      ...row,
      isPrimary: Number(row.isPrimary) === 1,
    })),
    attributes: attributes.map((row) => {
      let value: unknown = row.valueText ?? null;
      if (row.valueJson) {
        try {
          value = JSON.parse(String(row.valueJson));
        } catch {
          value = row.valueJson;
        }
      }
      return {
        key: row.attributeKey,
        label: row.label,
        value,
        visibility: row.visibility,
      };
    }),
    sources,
    history,
    qualityFlags: quality,
    inventory: {
      tracked: Number(core.trackInventory) === 1,
      onHand: null,
      reserved: null,
      available: null,
      incoming: core.sellStatus === "ARRIVING_SOON" ? null : 0,
    },
  };
}
