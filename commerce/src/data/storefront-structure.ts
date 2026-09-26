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
  nodePublicationStatus?: string;
  nodePublishedVersionId?: string | null;
  nodeDraftVersionId?: string | null;
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


export interface OwnerStorefrontPlacementSelection {
  primaryNodeId: string;
  additionalNodeIds: string[];
}

export interface ResolvedOwnerStorefrontPlacement {
  storefrontNodeId: string;
  isPrimary: boolean;
  position: number;
}

function normalizeStorefrontNodeId(value: unknown): string {
  return String(value ?? "").trim();
}

export async function resolveOwnerStorefrontPlacements(
  db: D1DatabaseLike,
  raw: unknown,
): Promise<ResolvedOwnerStorefrontPlacement[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("product_storefront_placement_required");
  }

  const input = raw as Record<string, unknown>;
  const primaryNodeId = normalizeStorefrontNodeId(input.primaryNodeId);
  if (!primaryNodeId) {
    throw new Error("product_storefront_primary_required");
  }

  const additionalRaw = Array.isArray(input.additionalNodeIds)
    ? input.additionalNodeIds
    : [];
  const additionalNodeIds = additionalRaw
    .map(normalizeStorefrontNodeId)
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .filter((value) => value !== primaryNodeId);

  if (additionalNodeIds.length > 24) {
    throw new Error("product_storefront_too_many_placements");
  }

  const ids = [primaryNodeId, ...additionalNodeIds];
  const placeholders = ids.map(() => "?").join(",");
  const rows = await allRows<{
    id: string;
    publicationStatus: string;
    publishedVersionId: string | null;
    draftVersionId: string | null;
  }>(
    db
      .prepare(
        "SELECT id, publication_status AS publicationStatus, " +
          "current_published_version_id AS publishedVersionId, " +
          "current_draft_version_id AS draftVersionId " +
          "FROM storefront_nodes WHERE id IN (" + placeholders + ")",
      )
      .bind(...ids),
  );

  const byId = new Map(rows.map((row) => [String(row.id), row]));
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) throw new Error("product_storefront_node_not_found");
    if (String(row.publicationStatus) === "ARCHIVED") {
      throw new Error("product_storefront_node_archived");
    }
    if (!row.publishedVersionId && !row.draftVersionId) {
      throw new Error("product_storefront_node_not_ready");
    }
  }

  return ids.map((storefrontNodeId, index) => ({
    storefrontNodeId,
    isPrimary: index === 0,
    position: index * 10,
  }));
}

export function ownerPlacementStatements(
  db: D1DatabaseLike,
  input: {
    productVersionId: string;
    placements: ResolvedOwnerStorefrontPlacement[];
    createdAt: string;
    guard?: {
      productId: string;
      resultVersion: number;
      token: string;
    };
  },
): D1PreparedStatementLike[] {
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

  for (const placement of input.placements) {
    if (input.guard) {
      statements.push(
        db
          .prepare(
            "INSERT INTO product_version_storefront_placements (" +
              "product_version_id, storefront_node_id, is_primary, position, source, created_at" +
              ") SELECT ?, ?, ?, ?, 'OWNER', ? FROM products " +
              "WHERE id = ? AND version = ? AND updated_at = ?",
          )
          .bind(
            input.productVersionId,
            placement.storefrontNodeId,
            placement.isPrimary ? 1 : 0,
            placement.position,
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
              ") VALUES (?, ?, ?, ?, 'OWNER', ?)",
          )
          .bind(
            input.productVersionId,
            placement.storefrontNodeId,
            placement.isPrimary ? 1 : 0,
            placement.position,
            input.createdAt,
          ),
      );
    }
  }

  return statements;
}

export function copyPlacementStatements(
  db: D1DatabaseLike,
  input: {
    sourceProductVersionId: string;
    targetProductVersionId: string;
    productId: string;
    resultVersion: number;
    token: string;
  },
): D1PreparedStatementLike[] {
  return [
    db
      .prepare(
        "DELETE FROM product_version_storefront_placements " +
          "WHERE product_version_id = ? AND EXISTS (" +
          "SELECT 1 FROM products WHERE id = ? AND version = ? AND updated_at = ?)",
      )
      .bind(
        input.targetProductVersionId,
        input.productId,
        input.resultVersion,
        input.token,
      ),
    db
      .prepare(
        "INSERT INTO product_version_storefront_placements (" +
          "product_version_id, storefront_node_id, is_primary, position, source, created_at" +
          ") SELECT ?, p.storefront_node_id, p.is_primary, p.position, p.source, ? " +
          "FROM product_version_storefront_placements p " +
          "WHERE p.product_version_id = ? AND EXISTS (" +
          "SELECT 1 FROM products WHERE id = ? AND version = ? AND updated_at = ?)",
      )
      .bind(
        input.targetProductVersionId,
        input.token,
        input.sourceProductVersionId,
        input.productId,
        input.resultVersion,
        input.token,
      ),
  ];
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
          "n.stable_key AS stableKey, n.publication_status AS nodePublicationStatus, " +
          "n.current_published_version_id AS nodePublishedVersionId, " +
          "n.current_draft_version_id AS nodeDraftVersionId, nv.name, nv.slug, " +
          "nv.parent_node_id AS parentNodeId, p.is_primary AS isPrimary, " +
          "p.position, p.source " +
          "FROM product_version_storefront_placements p " +
          "JOIN storefront_nodes n ON n.id = p.storefront_node_id " +
          "JOIN storefront_node_versions nv ON nv.id = COALESCE(n.current_draft_version_id, n.current_published_version_id) " +
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
    nodePublicationStatus:
      row.nodePublicationStatus == null ? undefined : String(row.nodePublicationStatus),
    nodePublishedVersionId:
      row.nodePublishedVersionId == null ? null : String(row.nodePublishedVersionId),
    nodeDraftVersionId:
      row.nodeDraftVersionId == null ? null : String(row.nodeDraftVersionId),
  }));
}


export interface AdminStorefrontNode {
  id: string;
  stableKey: string;
  publicationStatus: "DRAFT" | "ACTIVE" | "ARCHIVED";
  version: number;
  publishedVersionId: string | null;
  draftVersionId: string | null;
  effectiveVersionId: string;
  effectiveVersionNumber: number;
  hasDraft: boolean;
  name: string;
  slug: string;
  parentNodeId: string | null;
  sortOrder: number;
  showInNavigation: boolean;
  shortDescription: string | null;
  imageUrl: string | null;
  legacyPath: string | null;
  productCount: number;
  childCount: number;
}

function storefrontUid(prefix: string): string {
  return prefix + "_" + crypto.randomUUID();
}

function storefrontNow(): string {
  return new Date().toISOString();
}

function storefrontName(value: unknown): string {
  const name = String(value ?? "").trim();
  if (!name) throw new Error("storefront_name_required");
  if (name.length > 100) throw new Error("storefront_name_too_long");
  return name;
}

function storefrontNullableText(
  value: unknown,
  code: string,
  max: number,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  const result = String(value).trim();
  if (result.length > max) throw new Error(code);
  return result || null;
}

function storefrontBoolean(value: unknown, code: string): boolean {
  if (typeof value !== "boolean") throw new Error(code);
  return value;
}

function storefrontVersion(value: unknown): number {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("storefront_expected_version_invalid");
  }
  return version;
}

function storefrontSlugify(value: string): string {
  const base = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 82)
    .replace(/-+$/g, "");
  return base || "section";
}

async function uniqueAdminStorefrontSlug(
  db: D1DatabaseLike,
  name: string,
  excludeNodeId: string | null = null,
): Promise<string> {
  const base = storefrontSlugify(name);
  for (let index = 1; index <= 100; index += 1) {
    const slug = index === 1 ? base : base + "-" + index;
    const found = await db
      .prepare(
        "SELECT n.id FROM storefront_nodes n " +
          "JOIN storefront_node_versions v ON v.id = COALESCE(n.current_draft_version_id, n.current_published_version_id) " +
          "WHERE LOWER(v.slug) = LOWER(?) AND (? IS NULL OR n.id <> ?) LIMIT 1",
      )
      .bind(slug, excludeNodeId, excludeNodeId)
      .first<{ id: string }>();
    if (!found) return slug;
  }
  throw new Error("storefront_slug_unavailable");
}

async function assertAdminStorefrontParent(
  db: D1DatabaseLike,
  parentNodeId: string | null,
  nodeId: string | null = null,
): Promise<void> {
  if (!parentNodeId) return;
  if (nodeId && parentNodeId === nodeId) throw new Error("storefront_parent_invalid");
  const parent = await db
    .prepare(
      "SELECT n.id, n.publication_status AS publicationStatus, v.parent_node_id AS parentNodeId " +
        "FROM storefront_nodes n " +
        "JOIN storefront_node_versions v ON v.id = COALESCE(n.current_draft_version_id, n.current_published_version_id) " +
        "WHERE n.id = ? LIMIT 1",
    )
    .bind(parentNodeId)
    .first<Record<string, unknown>>();
  if (!parent) throw new Error("storefront_parent_not_found");
  if (String(parent.publicationStatus) === "ARCHIVED") {
    throw new Error("storefront_parent_archived");
  }
  if (parent.parentNodeId != null) throw new Error("storefront_depth_invalid");
}

async function nextAdminStorefrontSortOrder(
  db: D1DatabaseLike,
  parentNodeId: string | null,
): Promise<number> {
  const row = await db
    .prepare(
      "SELECT COALESCE(MAX(v.sort_order), 0) AS maxSort " +
        "FROM storefront_nodes n " +
        "JOIN storefront_node_versions v ON v.id = COALESCE(n.current_draft_version_id, n.current_published_version_id) " +
        "WHERE n.publication_status <> 'ARCHIVED' " +
        "AND ((? IS NULL AND v.parent_node_id IS NULL) OR v.parent_node_id = ?)",
    )
    .bind(parentNodeId, parentNodeId)
    .first<{ maxSort: number }>();
  return Number(row?.maxSort ?? 0) + 10;
}

function storefrontAuditStatement(
  db: D1DatabaseLike,
  input: {
    nodeId: string;
    eventType: "NODE_CREATED" | "NODE_UPDATED" | "NODE_MOVED" | "NODE_ARCHIVED" | "NODE_RESTORED";
    actorEmail: string;
    before: unknown;
    after: unknown;
    reason: string;
    createdAt: string;
    guard?: {
      resultVersion: number;
      token: string;
    };
  },
): D1PreparedStatementLike {
  const values = [
    storefrontUid("sae"),
    input.nodeId,
    input.eventType,
    input.actorEmail,
    input.before == null ? null : JSON.stringify(input.before),
    input.after == null ? null : JSON.stringify(input.after),
    input.reason,
    input.createdAt,
  ];

  if (input.guard) {
    return db
      .prepare(
        "INSERT INTO storefront_audit_events (" +
          "id, node_id, event_type, actor_id, before_json, after_json, reason, created_at" +
          ") SELECT ?, ?, ?, ?, ?, ?, ?, ? FROM storefront_nodes " +
          "WHERE id = ? AND version = ? AND updated_at = ?",
      )
      .bind(
        ...values,
        input.nodeId,
        input.guard.resultVersion,
        input.guard.token,
      );
  }

  return db
    .prepare(
      "INSERT INTO storefront_audit_events (" +
        "id, node_id, event_type, actor_id, before_json, after_json, reason, created_at" +
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(...values);
}

function adminStorefrontSelect(includeArchived: boolean): string {
  return (
    "SELECT n.id, n.stable_key AS stableKey, n.publication_status AS publicationStatus, " +
    "n.version, n.current_published_version_id AS publishedVersionId, " +
    "n.current_draft_version_id AS draftVersionId, " +
    "ev.id AS effectiveVersionId, ev.version_number AS effectiveVersionNumber, " +
    "CASE WHEN n.current_draft_version_id IS NOT NULL THEN 1 ELSE 0 END AS hasDraft, " +
    "ev.name, ev.slug, ev.parent_node_id AS parentNodeId, ev.sort_order AS sortOrder, " +
    "ev.show_in_navigation AS showInNavigation, ev.short_description AS shortDescription, " +
    "ev.image_url AS imageUrl, ev.legacy_path AS legacyPath, " +
    "(SELECT COUNT(DISTINCT p.id) FROM products p " +
      "WHERE p.publication_status <> 'ARCHIVED' AND EXISTS (" +
        "SELECT 1 FROM product_version_storefront_placements ps " +
        "WHERE ps.product_version_id = COALESCE(p.current_draft_version_id, p.current_published_version_id) " +
        "AND ps.storefront_node_id = n.id" +
      ")) AS productCount, " +
    "(SELECT COUNT(*) FROM storefront_nodes cn " +
      "JOIN storefront_node_versions cv ON cv.id = COALESCE(cn.current_draft_version_id, cn.current_published_version_id) " +
      "WHERE cn.publication_status <> 'ARCHIVED' AND cv.parent_node_id = n.id" +
    ") AS childCount " +
    "FROM storefront_nodes n " +
    "JOIN storefront_node_versions ev ON ev.id = COALESCE(n.current_draft_version_id, n.current_published_version_id) " +
    (includeArchived ? "" : "WHERE n.publication_status <> 'ARCHIVED' ") +
    "ORDER BY CASE WHEN ev.parent_node_id IS NULL THEN 0 ELSE 1 END, " +
    "ev.parent_node_id, ev.sort_order, ev.name COLLATE NOCASE"
  );
}

function toAdminStorefrontNode(row: Record<string, unknown>): AdminStorefrontNode {
  return {
    id: String(row.id),
    stableKey: String(row.stableKey),
    publicationStatus: String(row.publicationStatus) as AdminStorefrontNode["publicationStatus"],
    version: Number(row.version),
    publishedVersionId:
      row.publishedVersionId == null ? null : String(row.publishedVersionId),
    draftVersionId:
      row.draftVersionId == null ? null : String(row.draftVersionId),
    effectiveVersionId: String(row.effectiveVersionId),
    effectiveVersionNumber: Number(row.effectiveVersionNumber),
    hasDraft: Number(row.hasDraft) === 1,
    name: String(row.name),
    slug: String(row.slug),
    parentNodeId: row.parentNodeId == null ? null : String(row.parentNodeId),
    sortOrder: Number(row.sortOrder ?? 0),
    showInNavigation: Number(row.showInNavigation) === 1,
    shortDescription:
      row.shortDescription == null ? null : String(row.shortDescription),
    imageUrl: row.imageUrl == null ? null : String(row.imageUrl),
    legacyPath: row.legacyPath == null ? null : String(row.legacyPath),
    productCount: Number(row.productCount ?? 0),
    childCount: Number(row.childCount ?? 0),
  };
}

export async function listAdminStorefrontNodes(
  db: D1DatabaseLike,
  options: { includeArchived?: boolean } = {},
): Promise<AdminStorefrontNode[]> {
  const rows = await allRows<Record<string, unknown>>(
    db.prepare(adminStorefrontSelect(options.includeArchived === true)),
  );
  return rows.map(toAdminStorefrontNode);
}

export async function getAdminStorefrontNode(
  db: D1DatabaseLike,
  nodeId: string,
): Promise<AdminStorefrontNode | null> {
  const rows = await listAdminStorefrontNodes(db, { includeArchived: true });
  return rows.find((row) => row.id === nodeId) ?? null;
}

export interface CreateAdminStorefrontNodeInput {
  name?: unknown;
  parentNodeId?: unknown;
  showInNavigation?: unknown;
  shortDescription?: unknown;
  imageUrl?: unknown;
}

export async function createAdminStorefrontNode(
  db: D1DatabaseLike,
  raw: CreateAdminStorefrontNodeInput,
  actorEmail: string,
): Promise<{ id: string }> {
  const name = storefrontName(raw.name);
  const parentNodeId =
    raw.parentNodeId == null || raw.parentNodeId === ""
      ? null
      : String(raw.parentNodeId);
  await assertAdminStorefrontParent(db, parentNodeId);
  const slug = await uniqueAdminStorefrontSlug(db, name);
  const showInNavigation =
    raw.showInNavigation === undefined
      ? parentNodeId === null
      : storefrontBoolean(raw.showInNavigation, "storefront_navigation_invalid");
  const shortDescription = storefrontNullableText(
    raw.shortDescription,
    "storefront_description_too_long",
    500,
  );
  const imageUrl = storefrontNullableText(
    raw.imageUrl,
    "storefront_image_url_too_long",
    700,
  );
  const sortOrder = await nextAdminStorefrontSortOrder(db, parentNodeId);
  const nodeId = storefrontUid("sfn");
  const versionId = storefrontUid("sfv");
  const timestamp = storefrontNow();
  const after = {
    name,
    slug,
    parentNodeId,
    sortOrder,
    showInNavigation,
    shortDescription,
    imageUrl,
  };

  await db.batch([
    db
      .prepare(
        "INSERT INTO storefront_nodes (" +
          "id, stable_key, publication_status, current_published_version_id, current_draft_version_id, " +
          "version, created_at, updated_at, archived_at" +
          ") VALUES (?, ?, 'DRAFT', NULL, ?, 1, ?, ?, NULL)",
      )
      .bind(
        nodeId,
        "owner/" + crypto.randomUUID(),
        versionId,
        timestamp,
        timestamp,
      ),
    db
      .prepare(
        "INSERT INTO storefront_node_versions (" +
          "id, node_id, version_number, name, slug, parent_node_id, sort_order, show_in_navigation, " +
          "short_description, image_url, legacy_path, created_by, created_at, published_at, superseded_at" +
          ") VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL)",
      )
      .bind(
        versionId,
        nodeId,
        name,
        slug,
        parentNodeId,
        sortOrder,
        showInNavigation ? 1 : 0,
        shortDescription,
        imageUrl,
        actorEmail,
        timestamp,
      ),
    storefrontAuditStatement(db, {
      nodeId,
      eventType: "NODE_CREATED",
      actorEmail,
      before: null,
      after,
      reason: parentNodeId
        ? "Owner created a Storefront sub-section draft"
        : "Owner created a Storefront main-section draft",
      createdAt: timestamp,
    }),
  ]);

  return { id: nodeId };
}

export interface UpdateAdminStorefrontNodeInput {
  expectedVersion?: unknown;
  name?: unknown;
  parentNodeId?: unknown;
  showInNavigation?: unknown;
  shortDescription?: unknown;
  imageUrl?: unknown;
  sortOrder?: unknown;
}

export async function updateAdminStorefrontNode(
  db: D1DatabaseLike,
  nodeId: string,
  raw: UpdateAdminStorefrontNodeInput,
  actorEmail: string,
  auditEvent: "NODE_UPDATED" | "NODE_MOVED" = "NODE_UPDATED",
): Promise<void> {
  const expected = storefrontVersion(raw.expectedVersion);
  const current = await getAdminStorefrontNode(db, nodeId);
  if (!current) throw new Error("storefront_not_found");
  if (current.version !== expected) throw new Error("storefront_version_conflict");
  if (current.publicationStatus === "ARCHIVED") {
    throw new Error("storefront_archived");
  }

  const name =
    raw.name === undefined ? current.name : storefrontName(raw.name);
  const parentNodeId =
    raw.parentNodeId === undefined
      ? current.parentNodeId
      : raw.parentNodeId == null || raw.parentNodeId === ""
        ? null
        : String(raw.parentNodeId);
  await assertAdminStorefrontParent(db, parentNodeId, nodeId);

  const showInNavigation =
    raw.showInNavigation === undefined
      ? current.showInNavigation
      : storefrontBoolean(raw.showInNavigation, "storefront_navigation_invalid");
  const shortDescription =
    raw.shortDescription === undefined
      ? current.shortDescription
      : storefrontNullableText(
          raw.shortDescription,
          "storefront_description_too_long",
          500,
        );
  const imageUrl =
    raw.imageUrl === undefined
      ? current.imageUrl
      : storefrontNullableText(
          raw.imageUrl,
          "storefront_image_url_too_long",
          700,
        );
  const sortOrder =
    raw.sortOrder === undefined ? current.sortOrder : Number(raw.sortOrder);
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 1_000_000) {
    throw new Error("storefront_sort_order_invalid");
  }

  const slug =
    name === current.name
      ? current.slug
      : await uniqueAdminStorefrontSlug(db, name, nodeId);
  const timestamp = storefrontNow();
  const resultVersion = expected + 1;
  const before = {
    name: current.name,
    slug: current.slug,
    parentNodeId: current.parentNodeId,
    sortOrder: current.sortOrder,
    showInNavigation: current.showInNavigation,
    shortDescription: current.shortDescription,
    imageUrl: current.imageUrl,
  };
  const after = {
    name,
    slug,
    parentNodeId,
    sortOrder,
    showInNavigation,
    shortDescription,
    imageUrl,
  };

  const draftVersionId = current.draftVersionId ?? storefrontUid("sfv");
  const statements: D1PreparedStatementLike[] = [
    db
      .prepare(
        "UPDATE storefront_nodes SET current_draft_version_id = ?, version = version + 1, updated_at = ? " +
          "WHERE id = ? AND version = ? AND publication_status <> 'ARCHIVED'",
      )
      .bind(draftVersionId, timestamp, nodeId, expected),
  ];

  if (!current.draftVersionId) {
    statements.push(
      db
        .prepare(
          "INSERT INTO storefront_node_versions (" +
            "id, node_id, version_number, name, slug, parent_node_id, sort_order, show_in_navigation, " +
            "short_description, image_url, legacy_path, created_by, created_at, published_at, superseded_at" +
            ") SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL " +
            "FROM storefront_nodes WHERE id = ? AND version = ? AND updated_at = ?",
        )
        .bind(
          draftVersionId,
          nodeId,
          current.effectiveVersionNumber + 1,
          name,
          slug,
          parentNodeId,
          sortOrder,
          showInNavigation ? 1 : 0,
          shortDescription,
          imageUrl,
          current.legacyPath,
          actorEmail,
          timestamp,
          nodeId,
          resultVersion,
          timestamp,
        ),
    );
  } else {
    statements.push(
      db
        .prepare(
          "UPDATE storefront_node_versions SET name = ?, slug = ?, parent_node_id = ?, " +
            "sort_order = ?, show_in_navigation = ?, short_description = ?, image_url = ? " +
            "WHERE id = ? AND node_id = ? AND EXISTS (" +
              "SELECT 1 FROM storefront_nodes WHERE id = ? AND version = ? AND updated_at = ?" +
            ")",
        )
        .bind(
          name,
          slug,
          parentNodeId,
          sortOrder,
          showInNavigation ? 1 : 0,
          shortDescription,
          imageUrl,
          draftVersionId,
          nodeId,
          nodeId,
          resultVersion,
          timestamp,
        ),
    );
  }

  statements.push(
    storefrontAuditStatement(db, {
      nodeId,
      eventType: auditEvent,
      actorEmail,
      before,
      after,
      reason:
        auditEvent === "NODE_MOVED"
          ? "Owner reordered Storefront Structure"
          : "Owner updated Storefront Structure draft",
      createdAt: timestamp,
      guard: { resultVersion, token: timestamp },
    }),
  );

  await db.batch(statements);
  const verified = await db
    .prepare(
      "SELECT version, updated_at AS updatedAt FROM storefront_nodes WHERE id = ? LIMIT 1",
    )
    .bind(nodeId)
    .first<{ version: number; updatedAt: string }>();
  if (
    Number(verified?.version) !== resultVersion ||
    verified?.updatedAt !== timestamp
  ) {
    throw new Error("storefront_version_conflict");
  }
}

export async function moveAdminStorefrontNode(
  db: D1DatabaseLike,
  nodeId: string,
  direction: "UP" | "DOWN",
  expectedVersion: unknown,
  actorEmail: string,
): Promise<void> {
  if (direction !== "UP" && direction !== "DOWN") {
    throw new Error("storefront_move_invalid");
  }
  const current = await getAdminStorefrontNode(db, nodeId);
  if (!current) throw new Error("storefront_not_found");
  const expected = storefrontVersion(expectedVersion);
  if (current.version !== expected) throw new Error("storefront_version_conflict");
  if (current.publicationStatus === "ARCHIVED") {
    throw new Error("storefront_archived");
  }

  const nodes = (await listAdminStorefrontNodes(db)).filter(
    (node) => node.parentNodeId === current.parentNodeId,
  );
  const index = nodes.findIndex((node) => node.id === nodeId);
  if (index < 0) throw new Error("storefront_not_found");
  const targetIndex = direction === "UP" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= nodes.length) return;
  const target = nodes[targetIndex];

  await updateAdminStorefrontNode(
    db,
    current.id,
    {
      expectedVersion: current.version,
      sortOrder: target.sortOrder,
    },
    actorEmail,
    "NODE_MOVED",
  );
  await updateAdminStorefrontNode(
    db,
    target.id,
    {
      expectedVersion: target.version,
      sortOrder: current.sortOrder,
    },
    actorEmail,
    "NODE_MOVED",
  );
}

export async function archiveAdminStorefrontNode(
  db: D1DatabaseLike,
  nodeId: string,
  expectedVersion: unknown,
  actorEmail: string,
): Promise<void> {
  const expected = storefrontVersion(expectedVersion);
  const current = await getAdminStorefrontNode(db, nodeId);
  if (!current) throw new Error("storefront_not_found");
  if (current.version !== expected) throw new Error("storefront_version_conflict");
  if (current.publicationStatus === "ARCHIVED") return;
  if (current.childCount > 0) throw new Error("storefront_archive_has_children");

  const timestamp = storefrontNow();
  await db.batch([
    db
      .prepare(
        "UPDATE storefront_nodes SET publication_status = 'ARCHIVED', archived_at = ?, " +
          "version = version + 1, updated_at = ? WHERE id = ? AND version = ?",
      )
      .bind(timestamp, timestamp, nodeId, expected),
    storefrontAuditStatement(db, {
      nodeId,
      eventType: "NODE_ARCHIVED",
      actorEmail,
      before: {
        publicationStatus: current.publicationStatus,
        productCount: current.productCount,
      },
      after: { publicationStatus: "ARCHIVED" },
      reason: "Owner archived Storefront section without deleting placement history",
      createdAt: timestamp,
      guard: { resultVersion: expected + 1, token: timestamp },
    }),
  ]);
  const verified = await db
    .prepare("SELECT version, publication_status AS status, updated_at AS updatedAt FROM storefront_nodes WHERE id = ? LIMIT 1")
    .bind(nodeId)
    .first<{ version: number; status: string; updatedAt: string }>();
  if (
    Number(verified?.version) !== expected + 1 ||
    verified?.status !== "ARCHIVED" ||
    verified?.updatedAt !== timestamp
  ) {
    throw new Error("storefront_version_conflict");
  }
}

export async function restoreAdminStorefrontNode(
  db: D1DatabaseLike,
  nodeId: string,
  expectedVersion: unknown,
  actorEmail: string,
): Promise<void> {
  const expected = storefrontVersion(expectedVersion);
  const current = await getAdminStorefrontNode(db, nodeId);
  if (!current) throw new Error("storefront_not_found");
  if (current.version !== expected) throw new Error("storefront_version_conflict");
  if (current.publicationStatus !== "ARCHIVED") return;
  await assertAdminStorefrontParent(db, current.parentNodeId, nodeId);

  const nextStatus = current.publishedVersionId ? "ACTIVE" : "DRAFT";
  const timestamp = storefrontNow();
  await db.batch([
    db
      .prepare(
        "UPDATE storefront_nodes SET publication_status = ?, archived_at = NULL, " +
          "version = version + 1, updated_at = ? WHERE id = ? AND version = ?",
      )
      .bind(nextStatus, timestamp, nodeId, expected),
    storefrontAuditStatement(db, {
      nodeId,
      eventType: "NODE_RESTORED",
      actorEmail,
      before: { publicationStatus: "ARCHIVED" },
      after: { publicationStatus: nextStatus },
      reason: "Owner restored Storefront section",
      createdAt: timestamp,
      guard: { resultVersion: expected + 1, token: timestamp },
    }),
  ]);
  const verified = await db
    .prepare("SELECT version, publication_status AS status, updated_at AS updatedAt FROM storefront_nodes WHERE id = ? LIMIT 1")
    .bind(nodeId)
    .first<{ version: number; status: string; updatedAt: string }>();
  if (
    Number(verified?.version) !== expected + 1 ||
    verified?.status !== nextStatus ||
    verified?.updatedAt !== timestamp
  ) {
    throw new Error("storefront_version_conflict");
  }
}
