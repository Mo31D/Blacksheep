import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "./d1";

export const LEGACY_ROOT_NODE_BY_PRODUCT_TYPE: Readonly<Record<string, string>> = {
  gifts: "sfn_gifts",
  icecream: "sfn_icecream",
  romneys: "sfn_romneys",
  hawkshead: "sfn_hawkshead",
};

export const LEGACY_CATEGORY_NODE_BY_SLUG: Readonly<Record<string, string>> = {
  "peter-rabbit": "sfn_gifts_peter_rabbit",
  "highland-cows": "sfn_gifts_highland_cows",
  mugs: "sfn_gifts_mugs",
  "soft-toys": "sfn_gifts_soft_toys",
  cards: "sfn_gifts_cards",
  seasonal: "sfn_gifts_seasonal",
  "keyrings-badges": "sfn_gifts_keyrings_badges",
  "home-gifts": "sfn_gifts_home_gifts",
  "toys-games": "sfn_gifts_toys_games",
  romneys: "sfn_romneys",
  "local-food": "sfn_romneys",
  "mint-cake": "sfn_romneys_mint_cake",
  fudge: "sfn_romneys_fudge",
  biscuits: "sfn_romneys_biscuits",
  sweets: "sfn_romneys_sweets",
  "gift-boxes": "sfn_romneys_gift_boxes",
  icecream: "sfn_icecream",
  hawkshead: "sfn_hawkshead",
  "chutneys-pickles": "sfn_hawkshead_chutneys_pickles",
  "jams-preserves": "sfn_hawkshead_jams_preserves",
  honey: "sfn_hawkshead_honey",
  mustard: "sfn_hawkshead_mustard",
  "savoury-sauces": "sfn_hawkshead_savoury_sauces",
};

export interface CompatibilityStorefrontPlacement {
  storefrontNodeId: string;
  isPrimary: boolean;
  position: number;
}

export interface StorefrontNodeSnapshot {
  id: string;
  stableKey: string;
  name: string;
  slug: string;
  parentNodeId: string | null;
  sortOrder: number;
  showInNavigation: boolean;
  shortDescription: string | null;
  imageUrl: string | null;
  legacyPath: string | null;
  publishedVersionId: string;
}

export interface ProductVersionStorefrontPlacement {
  storefrontNodeId: string;
  stableKey: string;
  name: string;
  slug: string;
  parentNodeId: string | null;
  isPrimary: boolean;
  position: number;
  source: "LEGACY_BACKFILL" | "LEGACY_COMPAT" | "OWNER";
}

async function allRows<T>(
  statement: D1PreparedStatementLike,
): Promise<T[]> {
  if (!statement.all) throw new Error("database_all_unavailable");
  return (await statement.all<T>()).results;
}

function normalized(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function compatibilityStorefrontPlacements(
  productType: string,
  categorySlugs: string[],
  primaryCategorySlug?: string | null,
): CompatibilityStorefrontPlacement[] {
  const rootNodeId =
    LEGACY_ROOT_NODE_BY_PRODUCT_TYPE[normalized(productType)] ?? null;
  const categoryNodeIds: string[] = [];

  for (const rawSlug of categorySlugs) {
    const nodeId = LEGACY_CATEGORY_NODE_BY_SLUG[normalized(rawSlug)];
    if (nodeId && !categoryNodeIds.includes(nodeId)) {
      categoryNodeIds.push(nodeId);
    }
  }

  const mappedPrimary = primaryCategorySlug
    ? LEGACY_CATEGORY_NODE_BY_SLUG[normalized(primaryCategorySlug)] ?? null
    : null;
  const primaryNodeId = mappedPrimary ?? rootNodeId ?? categoryNodeIds[0] ?? null;
  if (!primaryNodeId) return [];

  const orderedNodeIds = [
    primaryNodeId,
    ...categoryNodeIds.filter((nodeId) => nodeId !== primaryNodeId),
  ];

  return orderedNodeIds.map((storefrontNodeId, index) => ({
    storefrontNodeId,
    isPrimary: index === 0,
    position: index * 10,
  }));
}

export async function categorySlugsForIds(
  db: D1DatabaseLike,
  categoryIds: string[],
): Promise<string[]> {
  if (!categoryIds.length) return [];
  const uniqueIds = [...new Set(categoryIds)];
  const placeholders = uniqueIds.map(() => "?").join(",");
  const rows = await allRows<{ id: string; slug: string }>(
    db
      .prepare(
        "SELECT id, slug FROM categories WHERE id IN (" + placeholders + ")",
      )
      .bind(...uniqueIds),
  );
  const byId = new Map(rows.map((row) => [String(row.id), String(row.slug)]));
  return categoryIds
    .map((id) => byId.get(id))
    .filter((slug): slug is string => Boolean(slug));
}

export function compatibilityPlacementStatements(
  db: D1DatabaseLike,
  input: {
    productVersionId: string;
    productType: string;
    categorySlugs: string[];
    primaryCategorySlug?: string | null;
    source?: "LEGACY_BACKFILL" | "LEGACY_COMPAT";
    createdAt: string;
    guard?: {
      productId: string;
      resultVersion: number;
      token: string;
    };
  },
): D1PreparedStatementLike[] {
  const placements = compatibilityStorefrontPlacements(
    input.productType,
    input.categorySlugs,
    input.primaryCategorySlug,
  );
  const source = input.source ?? "LEGACY_COMPAT";
  const statements: D1PreparedStatementLike[] = [];

  if (input.guard) {
    statements.push(
      db
        .prepare(
          "DELETE FROM product_version_storefront_placements " +
            "WHERE product_version_id = ? AND EXISTS (" +
            "SELECT 1 FROM products WHERE id = ? AND version = ? AND updated_at = ?)",
        )
        .bind(
          input.productVersionId,
          input.guard.productId,
          input.guard.resultVersion,
          input.guard.token,
        ),
    );
  } else {
    statements.push(
      db
        .prepare(
          "DELETE FROM product_version_storefront_placements WHERE product_version_id = ?",
        )
        .bind(input.productVersionId),
    );
  }

  for (const placement of placements) {
    if (input.guard) {
      statements.push(
        db
          .prepare(
            "INSERT INTO product_version_storefront_placements (" +
              "product_version_id, storefront_node_id, is_primary, position, source, created_at" +
              ") SELECT ?, ?, ?, ?, ?, ? FROM products " +
              "WHERE id = ? AND version = ? AND updated_at = ?",
          )
          .bind(
            input.productVersionId,
            placement.storefrontNodeId,
            placement.isPrimary ? 1 : 0,
            placement.position,
            source,
            input.createdAt,
            input.guard.productId,
            input.guard.resultVersion,
            input.guard.token,
          ),
      );
    } else {
      statements.push(
        db
          .prepare(
            "INSERT INTO product_version_storefront_placements (" +
              "product_version_id, storefront_node_id, is_primary, position, source, created_at" +
              ") VALUES (?, ?, ?, ?, ?, ?)",
          )
          .bind(
            input.productVersionId,
            placement.storefrontNodeId,
            placement.isPrimary ? 1 : 0,
            placement.position,
            source,
            input.createdAt,
          ),
      );
    }
  }

  return statements;
}

export async function listPublishedStorefrontNodes(
  db: D1DatabaseLike,
): Promise<StorefrontNodeSnapshot[]> {
  const rows = await allRows<Record<string, unknown>>(
    db.prepare(
      "SELECT n.id, n.stable_key AS stableKey, nv.name, nv.slug, " +
        "nv.parent_node_id AS parentNodeId, nv.sort_order AS sortOrder, " +
        "nv.show_in_navigation AS showInNavigation, " +
        "nv.short_description AS shortDescription, nv.image_url AS imageUrl, " +
        "nv.legacy_path AS legacyPath, nv.id AS publishedVersionId " +
        "FROM storefront_nodes n " +
        "JOIN storefront_node_versions nv ON nv.id = n.current_published_version_id " +
        "WHERE n.publication_status = 'ACTIVE' " +
        "ORDER BY CASE WHEN nv.parent_node_id IS NULL THEN 0 ELSE 1 END, " +
        "nv.parent_node_id, nv.sort_order, nv.name COLLATE NOCASE",
    ),
  );

  return rows.map((row) => ({
    id: String(row.id),
    stableKey: String(row.stableKey),
    name: String(row.name),
    slug: String(row.slug),
    parentNodeId: row.parentNodeId == null ? null : String(row.parentNodeId),
    sortOrder: Number(row.sortOrder ?? 0),
    showInNavigation: Number(row.showInNavigation) === 1,
    shortDescription:
      row.shortDescription == null ? null : String(row.shortDescription),
    imageUrl: row.imageUrl == null ? null : String(row.imageUrl),
    legacyPath: row.legacyPath == null ? null : String(row.legacyPath),
    publishedVersionId: String(row.publishedVersionId),
  }));
}

export async function getProductVersionStorefrontPlacements(
  db: D1DatabaseLike,
  productVersionId: string,
): Promise<ProductVersionStorefrontPlacement[]> {
  const rows = await allRows<Record<string, unknown>>(
    db
      .prepare(
        "SELECT p.storefront_node_id AS storefrontNodeId, " +
          "n.stable_key AS stableKey, nv.name, nv.slug, " +
          "nv.parent_node_id AS parentNodeId, p.is_primary AS isPrimary, " +
          "p.position, p.source " +
          "FROM product_version_storefront_placements p " +
          "JOIN storefront_nodes n ON n.id = p.storefront_node_id " +
          "JOIN storefront_node_versions nv ON nv.id = n.current_published_version_id " +
          "WHERE p.product_version_id = ? " +
          "ORDER BY p.is_primary DESC, p.position, nv.name COLLATE NOCASE",
      )
      .bind(productVersionId),
  );

  return rows.map((row) => ({
    storefrontNodeId: String(row.storefrontNodeId),
    stableKey: String(row.stableKey),
    name: String(row.name),
    slug: String(row.slug),
    parentNodeId: row.parentNodeId == null ? null : String(row.parentNodeId),
    isPrimary: Number(row.isPrimary) === 1,
    position: Number(row.position ?? 0),
    source: String(row.source) as ProductVersionStorefrontPlacement["source"],
  }));
}
