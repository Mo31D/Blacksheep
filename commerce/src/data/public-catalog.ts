import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "./d1";

export type PublicCommerceStatus =
  | "available"
  | "arriving-soon"
  | "out-of-stock"
  | "not-for-sale";

export type PublicCommerceNonPurchasableReason =
  | "arriving_soon"
  | "out_of_stock"
  | "not_for_sale"
  | "online_ordering_disabled"
  | "price_unavailable"
  | null;

interface PublicCommerceRow {
  productId: string;
  legacyId: string | null;
  slug: string;
  publicationStatus: string;
  sellStatus: string;
  onlineOrderingEnabled: number;
  productUpdatedAt: string;
  publishedVersionId: string;
  publishedVersionNumber: number;
  title: string;
  shortDescription: string;
  brand: string | null;
  productType: string;
  primaryCategory: string | null;
  variantId: string;
  sku: string | null;
  priceMinor: number | null;
  currency: string;
  trackInventory: number;
  onHand: number | null;
  reserved: number | null;
  safetyStock: number | null;
  balanceVersion: number | null;
  primaryImageUrl: string | null;
}

export interface PublicCommerceProduct {
  id: string;
  productId: string;
  slug: string;
  name: string;
  shortDescription: string;
  brand: string | null;
  type: string;
  primaryCategory: string | null;
  sku: string | null;
  priceMinor: number | null;
  currency: "GBP";
  status: PublicCommerceStatus;
  purchasable: boolean;
  nonPurchasableReason: PublicCommerceNonPurchasableReason;
  inventory: {
    tracked: boolean;
    available: number | null;
  };
  primaryImageUrl: string | null;
  publishedVersionId: string;
  publishedVersionNumber: number;
  updatedAt: string;
}

function safeLimit(value: number | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(1, Math.min(200, Math.floor(parsed)));
}

async function allRows<T>(
  statement: D1PreparedStatementLike,
): Promise<T[]> {
  if (!statement.all) throw new Error("d1_all_not_supported");
  return (await statement.all<T>()).results ?? [];
}

export function toPublicCommerceProduct(
  row: PublicCommerceRow,
): PublicCommerceProduct {
  const tracked = Number(row.trackInventory) === 1;
  const onHand = tracked ? Number(row.onHand ?? 0) : null;
  const reserved = tracked ? Number(row.reserved ?? 0) : null;
  const safetyStock = tracked ? Number(row.safetyStock ?? 0) : null;
  const available =
    tracked &&
    onHand !== null &&
    reserved !== null &&
    safetyStock !== null
      ? Math.max(0, onHand - reserved - safetyStock)
      : null;

  const onlineOrderingEnabled =
    Number(row.onlineOrderingEnabled) === 1;
  const priceMinor =
    row.priceMinor === null || row.priceMinor === undefined
      ? null
      : Number(row.priceMinor);

  let status: PublicCommerceStatus = "available";
  let reason: PublicCommerceNonPurchasableReason = null;

  if (row.sellStatus === "ARRIVING_SOON") {
    status = "arriving-soon";
    reason = "arriving_soon";
  } else if (row.sellStatus === "OUT_OF_STOCK") {
    status = "out-of-stock";
    reason = "out_of_stock";
  } else if (row.sellStatus === "NOT_FOR_SALE") {
    status = "not-for-sale";
    reason = "not_for_sale";
  } else if (priceMinor === null) {
    reason = "price_unavailable";
  } else if (!onlineOrderingEnabled) {
    reason = "online_ordering_disabled";
  } else if (tracked && (available === null || available <= 0)) {
    status = "out-of-stock";
    reason = "out_of_stock";
  }

  return {
    id: row.legacyId || row.productId,
    productId: row.productId,
    slug: row.slug,
    name: row.title,
    shortDescription: row.shortDescription,
    brand: row.brand,
    type: row.productType,
    primaryCategory: row.primaryCategory,
    sku: row.sku,
    priceMinor,
    currency: "GBP",
    status,
    purchasable: reason === null,
    nonPurchasableReason: reason,
    inventory: {
      tracked,
      available,
    },
    primaryImageUrl: row.primaryImageUrl,
    publishedVersionId: row.publishedVersionId,
    publishedVersionNumber: Number(row.publishedVersionNumber),
    updatedAt: row.productUpdatedAt,
  };
}

const PUBLIC_PRODUCT_SELECT = `
  SELECT
    p.id AS productId,
    p.legacy_catalog_id AS legacyId,
    p.current_slug AS slug,
    p.publication_status AS publicationStatus,
    p.sell_status AS sellStatus,
    p.online_ordering_enabled AS onlineOrderingEnabled,
    p.updated_at AS productUpdatedAt,
    pv.id AS publishedVersionId,
    pv.version_number AS publishedVersionNumber,
    pv.title,
    pv.short_description AS shortDescription,
    pv.brand,
    pv.product_type AS productType,
    (
      SELECT c.slug
      FROM product_version_categories pvc
      JOIN categories c ON c.id = pvc.category_id
      WHERE pvc.product_version_id = pv.id
        AND c.active = 1
      ORDER BY pvc.is_primary DESC, pvc.position ASC, c.slug ASC
      LIMIT 1
    ) AS primaryCategory,
    v.id AS variantId,
    v.sku,
    v.price_minor AS priceMinor,
    v.currency,
    v.track_inventory AS trackInventory,
    ib.on_hand AS onHand,
    ib.reserved,
    ib.safety_stock AS safetyStock,
    ib.version AS balanceVersion,
    (
      SELECT pm.public_url
      FROM product_version_media pvm
      JOIN product_media pm ON pm.id = pvm.media_id
      WHERE pvm.product_version_id = pv.id
        AND pvm.is_primary = 1
        AND pm.deleted_at IS NULL
      ORDER BY pvm.position ASC
      LIMIT 1
    ) AS primaryImageUrl
  FROM products p
  JOIN product_versions pv
    ON pv.id = p.current_published_version_id
  JOIN product_variants v
    ON v.product_id = p.id
   AND v.is_default = 1
   AND v.active = 1
  LEFT JOIN inventory_balances ib
    ON ib.variant_id = v.id
   AND ib.location_id = 'loc_ambleside'
`;

export async function listPublicCommerceProducts(
  db: D1DatabaseLike,
  options: {
    query?: string;
    limit?: number;
    cursor?: number;
  } = {},
): Promise<{
  products: PublicCommerceProduct[];
  nextCursor: number | null;
}> {
  const query = String(options.query ?? "").trim().toLowerCase();
  const limit = safeLimit(options.limit);
  const cursor = Math.max(0, Math.floor(Number(options.cursor) || 0));

  const filters = [
    "p.publication_status = 'ACTIVE'",
    "p.current_published_version_id IS NOT NULL",
  ];
  const values: unknown[] = [];

  if (query) {
    filters.push(
      "(LOWER(pv.title) LIKE ? OR LOWER(p.current_slug) LIKE ? OR LOWER(COALESCE(p.legacy_catalog_id,'')) LIKE ? OR LOWER(COALESCE(v.sku,'')) LIKE ?)",
    );
    const like = "%" + query + "%";
    values.push(like, like, like, like);
  }

  const rows = await allRows<PublicCommerceRow>(
    db
      .prepare(
        PUBLIC_PRODUCT_SELECT +
          " WHERE " +
          filters.join(" AND ") +
          " ORDER BY pv.title COLLATE NOCASE ASC, p.id ASC LIMIT ? OFFSET ?",
      )
      .bind(...values, limit + 1, cursor),
  );

  return {
    products: rows.slice(0, limit).map(toPublicCommerceProduct),
    nextCursor:
      rows.length > limit ? cursor + limit : null,
  };
}

export async function getPublicCommerceProduct(
  db: D1DatabaseLike,
  publicId: string,
): Promise<PublicCommerceProduct | null> {
  const id = String(publicId ?? "").trim();
  if (!id) return null;

  const row = await db
    .prepare(
      PUBLIC_PRODUCT_SELECT +
        ` WHERE p.publication_status = 'ACTIVE'
          AND p.current_published_version_id IS NOT NULL
          AND (p.legacy_catalog_id = ? OR p.id = ?)
        LIMIT 1`,
    )
    .bind(id, id)
    .first<PublicCommerceRow>();

  return row ? toPublicCommerceProduct(row) : null;
}
