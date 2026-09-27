import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "./d1";

export type HomepageMerchandisingMode =
  | "NEW_ARRIVALS"
  | "FEATURED_PRODUCTS"
  | "SELECTED_COLLECTION";

export type HomepageModuleKey =
  | "HERO"
  | "COLLECTIONS"
  | "PRODUCT_RAIL"
  | "LOCAL_FAVOURITES"
  | "VISIT_SHOP";

export interface HomepageModuleSetting {
  key: HomepageModuleKey;
  enabled: boolean;
  position: number;
}

export interface HomepageMerchandisingProduct {
  productId: string;
  title: string;
  slug: string;
  legacyId: string | null;
  priceMinor: number | null;
  primaryImageUrl: string | null;
  position: number;
}

export interface HomepageMerchandisingSnapshot {
  id: string;
  version: number;
  publishedVersionId: string | null;
  draftVersionId: string | null;
  effectiveVersionId: string;
  effectiveVersionNumber: number;
  hasDraft: boolean;
  enabled: boolean;
  mode: HomepageMerchandisingMode;
  productLimit: number;
  heading: string | null;
  selectedStorefrontNodeId: string | null;
  selectedStorefrontNodeName: string | null;
  featuredProducts: HomepageMerchandisingProduct[];
  modules: HomepageModuleSetting[];
}

export interface HomepageMerchandisingPreview {
  config: HomepageMerchandisingSnapshot;
  products: HomepageMerchandisingProduct[];
}

export interface SaveHomepageMerchandisingDraftInput {
  expectedVersion: unknown;
  enabled?: unknown;
  mode?: unknown;
  productLimit?: unknown;
  heading?: unknown;
  selectedStorefrontNodeId?: unknown;
  featuredProductIds?: unknown;
  modules?: unknown;
}

const MERCHANDISING_ID = "home_product_rail";
const MODES = new Set<HomepageMerchandisingMode>([
  "NEW_ARRIVALS",
  "FEATURED_PRODUCTS",
  "SELECTED_COLLECTION",
]);

const HOMEPAGE_MODULE_KEYS: HomepageModuleKey[] = [
  "HERO",
  "PRODUCT_RAIL",
  "COLLECTIONS",
  "LOCAL_FAVOURITES",
  "VISIT_SHOP",
];

async function allRows<T>(
  statement: D1PreparedStatementLike,
): Promise<T[]> {
  if (!statement.all) throw new Error("database_all_unavailable");
  return (await statement.all<T>()).results;
}

function uid(prefix: string): string {
  return prefix + "_" + crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function expectedVersion(value: unknown): number {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("homepage_expected_version_invalid");
  }
  return version;
}

function booleanValue(
  value: unknown,
  fallback: boolean,
): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    throw new Error("homepage_enabled_invalid");
  }
  return value;
}

function modeValue(
  value: unknown,
  fallback: HomepageMerchandisingMode,
): HomepageMerchandisingMode {
  if (value === undefined) return fallback;
  const mode = String(value) as HomepageMerchandisingMode;
  if (!MODES.has(mode)) throw new Error("homepage_mode_invalid");
  return mode;
}

function limitValue(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error("homepage_product_limit_invalid");
  }
  return limit;
}

function headingValue(
  value: unknown,
  fallback: string | null,
): string | null {
  if (value === undefined) return fallback;
  if (value === null || value === "") return null;
  const heading = String(value).trim();
  if (heading.length > 120) throw new Error("homepage_heading_too_long");
  return heading || null;
}

function nullableId(
  value: unknown,
  fallback: string | null,
): string | null {
  if (value === undefined) return fallback;
  if (value === null || value === "") return null;
  const id = String(value).trim();
  if (!id || id.length > 160) throw new Error("homepage_reference_invalid");
  return id;
}

function featuredIds(
  value: unknown,
  fallback: string[],
): string[] {
  if (value === undefined) return fallback;
  if (!Array.isArray(value)) throw new Error("homepage_featured_products_invalid");
  const ids = value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length || unique.length > 20) {
    throw new Error("homepage_featured_products_invalid");
  }
  return unique;
}

function moduleSettings(
  value: unknown,
  fallback: HomepageModuleSetting[],
): HomepageModuleSetting[] {
  if (value === undefined) return fallback;
  if (!Array.isArray(value)) throw new Error("homepage_modules_invalid");
  if (value.length !== HOMEPAGE_MODULE_KEYS.length) {
    throw new Error("homepage_modules_invalid");
  }

  const seen = new Set<string>();
  const result = value.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("homepage_modules_invalid");
    }
    const row = raw as Record<string, unknown>;
    const key = String(row.key ?? "") as HomepageModuleKey;
    if (!HOMEPAGE_MODULE_KEYS.includes(key) || seen.has(key)) {
      throw new Error("homepage_modules_invalid");
    }
    seen.add(key);
    if (typeof row.enabled !== "boolean") {
      throw new Error("homepage_modules_invalid");
    }
    return {
      key,
      enabled: row.enabled,
      position: (index + 1) * 10,
    };
  });

  if (HOMEPAGE_MODULE_KEYS.some((key) => !seen.has(key))) {
    throw new Error("homepage_modules_invalid");
  }
  return result;
}

async function selectedModules(
  db: D1DatabaseLike,
  versionId: string,
): Promise<HomepageModuleSetting[]> {
  const rows = await allRows<{
    moduleKey: string;
    enabled: number;
    position: number;
  }>(
    db
      .prepare(
        "SELECT module_key AS moduleKey, enabled, position " +
          "FROM homepage_merchandising_modules WHERE version_id = ? " +
          "ORDER BY position, module_key",
      )
      .bind(versionId),
  );

  if (!rows.length) {
    return HOMEPAGE_MODULE_KEYS.map((key, index) => ({
      key,
      enabled: true,
      position: (index + 1) * 10,
    }));
  }

  return rows.map((row) => ({
    key: String(row.moduleKey) as HomepageModuleKey,
    enabled: Number(row.enabled) === 1,
    position: Number(row.position),
  }));
}

async function selectedProducts(
  db: D1DatabaseLike,
  versionId: string,
  publishedOnly = false,
): Promise<HomepageMerchandisingProduct[]> {
  const versionJoin = publishedOnly
    ? "p.current_published_version_id"
    : "COALESCE(p.current_draft_version_id, p.current_published_version_id)";
  return allRows<HomepageMerchandisingProduct>(
    db
      .prepare(
        "SELECT hp.product_id AS productId, pv.title, p.current_slug AS slug, " +
          "p.legacy_catalog_id AS legacyId, v.price_minor AS priceMinor, " +
          "pm.public_url AS primaryImageUrl, hp.position " +
          "FROM homepage_merchandising_products hp " +
          "JOIN products p ON p.id = hp.product_id " +
          "JOIN product_versions pv ON pv.id = " + versionJoin + " " +
          "LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_default = 1 AND v.active = 1 " +
          "LEFT JOIN product_version_media pvm ON pvm.product_version_id = pv.id AND pvm.is_primary = 1 " +
          "LEFT JOIN product_media pm ON pm.id = pvm.media_id AND pm.deleted_at IS NULL " +
          "WHERE hp.version_id = ? " +
          (publishedOnly
            ? "AND p.publication_status = 'ACTIVE' AND p.current_published_version_id IS NOT NULL "
            : "AND p.publication_status <> 'ARCHIVED' ") +
          "ORDER BY hp.position, pv.title COLLATE NOCASE",
      )
      .bind(versionId),
  );
}

async function loadSnapshot(
  db: D1DatabaseLike,
  publishedOnly = false,
): Promise<HomepageMerchandisingSnapshot> {
  const versionExpr = publishedOnly
    ? "hm.current_published_version_id"
    : "COALESCE(hm.current_draft_version_id, hm.current_published_version_id)";
  const row = await db
    .prepare(
      "SELECT hm.id, hm.version, hm.current_published_version_id AS publishedVersionId, " +
        "hm.current_draft_version_id AS draftVersionId, hv.id AS effectiveVersionId, " +
        "hv.version_number AS effectiveVersionNumber, hv.enabled, hv.mode, " +
        "hv.product_limit AS productLimit, hv.heading, " +
        "hv.selected_storefront_node_id AS selectedStorefrontNodeId, " +
        "snv.name AS selectedStorefrontNodeName " +
        "FROM homepage_merchandising hm " +
        "JOIN homepage_merchandising_versions hv ON hv.id = " + versionExpr + " " +
        "LEFT JOIN storefront_nodes sn ON sn.id = hv.selected_storefront_node_id " +
        "LEFT JOIN storefront_node_versions snv ON snv.id = " +
          (publishedOnly
            ? "sn.current_published_version_id "
            : "COALESCE(sn.current_draft_version_id, sn.current_published_version_id) ") +
        "WHERE hm.id = ? LIMIT 1",
    )
    .bind(MERCHANDISING_ID)
    .first<Record<string, unknown>>();

  if (!row) throw new Error("homepage_merchandising_not_found");
  const effectiveVersionId = String(row.effectiveVersionId);
  const [featuredProducts, modules] = await Promise.all([
    selectedProducts(
      db,
      effectiveVersionId,
      publishedOnly,
    ),
    selectedModules(db, effectiveVersionId),
  ]);

  return {
    id: String(row.id),
    version: Number(row.version),
    publishedVersionId:
      row.publishedVersionId == null ? null : String(row.publishedVersionId),
    draftVersionId:
      row.draftVersionId == null ? null : String(row.draftVersionId),
    effectiveVersionId,
    effectiveVersionNumber: Number(row.effectiveVersionNumber),
    hasDraft: row.draftVersionId != null,
    enabled: Number(row.enabled) === 1,
    mode: String(row.mode) as HomepageMerchandisingMode,
    productLimit: Number(row.productLimit),
    heading: row.heading == null ? null : String(row.heading),
    selectedStorefrontNodeId:
      row.selectedStorefrontNodeId == null
        ? null
        : String(row.selectedStorefrontNodeId),
    selectedStorefrontNodeName:
      row.selectedStorefrontNodeName == null
        ? null
        : String(row.selectedStorefrontNodeName),
    featuredProducts,
    modules,
  };
}

export async function getAdminHomepageMerchandising(
  db: D1DatabaseLike,
): Promise<HomepageMerchandisingSnapshot> {
  return loadSnapshot(db, false);
}

export async function getPublishedHomepageMerchandising(
  db: D1DatabaseLike,
): Promise<HomepageMerchandisingSnapshot> {
  return loadSnapshot(db, true);
}

async function assertStorefrontNodeAvailable(
  db: D1DatabaseLike,
  nodeId: string | null,
  requirePublished: boolean,
): Promise<void> {
  if (!nodeId) return;
  const row = await db
    .prepare(
      "SELECT publication_status AS publicationStatus, " +
        "current_published_version_id AS publishedVersionId, " +
        "current_draft_version_id AS draftVersionId " +
        "FROM storefront_nodes WHERE id = ? LIMIT 1",
    )
    .bind(nodeId)
    .first<{
      publicationStatus: string;
      publishedVersionId: string | null;
      draftVersionId: string | null;
    }>();
  if (!row) throw new Error("homepage_collection_not_found");
  if (row.publicationStatus === "ARCHIVED") {
    throw new Error("homepage_collection_archived");
  }
  if (
    requirePublished &&
    (row.publicationStatus !== "ACTIVE" || !row.publishedVersionId)
  ) {
    throw new Error("homepage_collection_not_live");
  }
  if (!requirePublished && !row.publishedVersionId && !row.draftVersionId) {
    throw new Error("homepage_collection_not_ready");
  }
}

async function assertProductsAvailable(
  db: D1DatabaseLike,
  productIds: string[],
  requirePublished: boolean,
): Promise<void> {
  if (!productIds.length) return;
  const placeholders = productIds.map(() => "?").join(",");
  const rows = await allRows<{
    id: string;
    publicationStatus: string;
    publishedVersionId: string | null;
  }>(
    db
      .prepare(
        "SELECT id, publication_status AS publicationStatus, " +
          "current_published_version_id AS publishedVersionId " +
          "FROM products WHERE id IN (" + placeholders + ")",
      )
      .bind(...productIds),
  );
  if (rows.length !== productIds.length) {
    throw new Error("homepage_featured_product_not_found");
  }
  if (rows.some((row) => row.publicationStatus === "ARCHIVED")) {
    throw new Error("homepage_featured_product_archived");
  }
  if (
    requirePublished &&
    rows.some(
      (row) =>
        row.publicationStatus !== "ACTIVE" || !row.publishedVersionId,
    )
  ) {
    throw new Error("homepage_featured_product_not_live");
  }
}

function auditStatement(
  db: D1DatabaseLike,
  input: {
    eventType: "DRAFT_SAVED" | "PUBLISHED";
    actorEmail: string;
    before: unknown;
    after: unknown;
    createdAt: string;
    resultVersion: number;
  },
): D1PreparedStatementLike {
  return db
    .prepare(
      "INSERT INTO homepage_merchandising_audit_events (" +
        "id, merchandising_id, event_type, actor_id, before_json, after_json, created_at" +
        ") SELECT ?, ?, ?, ?, ?, ?, ? FROM homepage_merchandising " +
        "WHERE id = ? AND version = ? AND updated_at = ?",
    )
    .bind(
      uid("hma"),
      MERCHANDISING_ID,
      input.eventType,
      input.actorEmail,
      input.before == null ? null : JSON.stringify(input.before),
      input.after == null ? null : JSON.stringify(input.after),
      input.createdAt,
      MERCHANDISING_ID,
      input.resultVersion,
      input.createdAt,
    );
}

export async function saveAdminHomepageMerchandisingDraft(
  db: D1DatabaseLike,
  raw: SaveHomepageMerchandisingDraftInput,
  actorEmail: string,
): Promise<void> {
  const current = await getAdminHomepageMerchandising(db);
  const expected = expectedVersion(raw.expectedVersion);
  if (current.version !== expected) {
    throw new Error("homepage_version_conflict");
  }

  const enabled = booleanValue(raw.enabled, current.enabled);
  const mode = modeValue(raw.mode, current.mode);
  const productLimit = limitValue(raw.productLimit, current.productLimit);
  const heading = headingValue(raw.heading, current.heading);
  const selectedStorefrontNodeId = nullableId(
    raw.selectedStorefrontNodeId,
    current.selectedStorefrontNodeId,
  );
  const featuredProductIds = featuredIds(
    raw.featuredProductIds,
    current.featuredProducts.map((product) => product.productId),
  );
  const modules = moduleSettings(raw.modules, current.modules);

  if (mode === "SELECTED_COLLECTION" && !selectedStorefrontNodeId) {
    throw new Error("homepage_collection_required");
  }
  await assertStorefrontNodeAvailable(
    db,
    selectedStorefrontNodeId,
    false,
  );
  await assertProductsAvailable(db, featuredProductIds, false);

  const createdAt = now();
  const resultVersion = expected + 1;
  const versionNumber = current.effectiveVersionNumber + 1;
  const draftId = uid("hmv");
  const next = {
    enabled,
    mode,
    productLimit,
    heading,
    selectedStorefrontNodeId,
    featuredProductIds,
    modules,
  };

  const statements: D1PreparedStatementLike[] = [
    db
      .prepare(
        "UPDATE homepage_merchandising SET current_draft_version_id = ?, " +
          "version = version + 1, updated_at = ? " +
          "WHERE id = ? AND version = ?",
      )
      .bind(draftId, createdAt, MERCHANDISING_ID, expected),
    db
      .prepare(
        "INSERT INTO homepage_merchandising_versions (" +
          "id, merchandising_id, version_number, enabled, mode, product_limit, heading, " +
          "selected_storefront_node_id, created_by, created_at, published_at, superseded_at" +
          ") SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL " +
          "FROM homepage_merchandising WHERE id = ? AND version = ? AND updated_at = ?",
      )
      .bind(
        draftId,
        MERCHANDISING_ID,
        versionNumber,
        enabled ? 1 : 0,
        mode,
        productLimit,
        heading,
        selectedStorefrontNodeId,
        actorEmail,
        createdAt,
        MERCHANDISING_ID,
        resultVersion,
        createdAt,
      ),
  ];

  featuredProductIds.forEach((productId, index) => {
    statements.push(
      db
        .prepare(
          "INSERT INTO homepage_merchandising_products (version_id, product_id, position) " +
            "SELECT ?, ?, ? FROM homepage_merchandising " +
            "WHERE id = ? AND version = ? AND updated_at = ?",
        )
        .bind(
          draftId,
          productId,
          index * 10,
          MERCHANDISING_ID,
          resultVersion,
          createdAt,
        ),
    );
  });

  modules.forEach((module) => {
    statements.push(
      db
        .prepare(
          "INSERT INTO homepage_merchandising_modules (" +
            "version_id, module_key, enabled, position" +
            ") SELECT ?, ?, ?, ? FROM homepage_merchandising " +
            "WHERE id = ? AND version = ? AND updated_at = ?",
        )
        .bind(
          draftId,
          module.key,
          module.enabled ? 1 : 0,
          module.position,
          MERCHANDISING_ID,
          resultVersion,
          createdAt,
        ),
    );
  });

  statements.push(
    auditStatement(db, {
      eventType: "DRAFT_SAVED",
      actorEmail,
      before: {
        enabled: current.enabled,
        mode: current.mode,
        productLimit: current.productLimit,
        heading: current.heading,
        selectedStorefrontNodeId: current.selectedStorefrontNodeId,
        featuredProductIds: current.featuredProducts.map(
          (product) => product.productId,
        ),
        modules: current.modules,
      },
      after: next,
      createdAt,
      resultVersion,
    }),
  );

  await db.batch(statements);

  const verified = await db
    .prepare(
      "SELECT current_draft_version_id AS draftVersionId, version, updated_at AS updatedAt " +
        "FROM homepage_merchandising WHERE id = ? LIMIT 1",
    )
    .bind(MERCHANDISING_ID)
    .first<{
      draftVersionId: string | null;
      version: number;
      updatedAt: string;
    }>();
  if (
    verified?.draftVersionId !== draftId ||
    Number(verified?.version) !== resultVersion ||
    verified?.updatedAt !== createdAt
  ) {
    throw new Error("homepage_version_conflict");
  }
}

export async function publishAdminHomepageMerchandising(
  db: D1DatabaseLike,
  expectedRaw: unknown,
  actorEmail: string,
): Promise<void> {
  const current = await getAdminHomepageMerchandising(db);
  const expected = expectedVersion(expectedRaw);
  if (current.version !== expected) {
    throw new Error("homepage_version_conflict");
  }
  if (!current.draftVersionId) throw new Error("homepage_no_draft");

  if (current.enabled && current.mode === "FEATURED_PRODUCTS") {
    if (!current.featuredProducts.length) {
      throw new Error("homepage_featured_products_required");
    }
    await assertProductsAvailable(
      db,
      current.featuredProducts.map((product) => product.productId),
      true,
    );
  }
  if (current.enabled && current.mode === "SELECTED_COLLECTION") {
    if (!current.selectedStorefrontNodeId) {
      throw new Error("homepage_collection_required");
    }
    await assertStorefrontNodeAvailable(
      db,
      current.selectedStorefrontNodeId,
      true,
    );
  }

  const createdAt = now();
  const resultVersion = expected + 1;
  const statements: D1PreparedStatementLike[] = [
    db
      .prepare(
        "UPDATE homepage_merchandising SET " +
          "current_published_version_id = current_draft_version_id, " +
          "current_draft_version_id = NULL, version = version + 1, updated_at = ? " +
          "WHERE id = ? AND version = ? AND current_draft_version_id = ?",
      )
      .bind(
        createdAt,
        MERCHANDISING_ID,
        expected,
        current.draftVersionId,
      ),
  ];

  if (current.publishedVersionId) {
    statements.push(
      db
        .prepare(
          "UPDATE homepage_merchandising_versions SET superseded_at = ? " +
            "WHERE id = ? AND EXISTS (" +
            "SELECT 1 FROM homepage_merchandising WHERE id = ? AND version = ? AND updated_at = ?)",
        )
        .bind(
          createdAt,
          current.publishedVersionId,
          MERCHANDISING_ID,
          resultVersion,
          createdAt,
        ),
    );
  }

  statements.push(
    db
      .prepare(
        "UPDATE homepage_merchandising_versions SET published_at = ?, superseded_at = NULL " +
          "WHERE id = ? AND EXISTS (" +
          "SELECT 1 FROM homepage_merchandising WHERE id = ? AND version = ? AND updated_at = ?)",
      )
      .bind(
        createdAt,
        current.draftVersionId,
        MERCHANDISING_ID,
        resultVersion,
        createdAt,
      ),
    auditStatement(db, {
      eventType: "PUBLISHED",
      actorEmail,
      before: { publishedVersionId: current.publishedVersionId },
      after: { publishedVersionId: current.draftVersionId },
      createdAt,
      resultVersion,
    }),
  );

  await db.batch(statements);

  const verified = await db
    .prepare(
      "SELECT current_published_version_id AS publishedVersionId, " +
        "current_draft_version_id AS draftVersionId, version, updated_at AS updatedAt " +
        "FROM homepage_merchandising WHERE id = ? LIMIT 1",
    )
    .bind(MERCHANDISING_ID)
    .first<{
      publishedVersionId: string | null;
      draftVersionId: string | null;
      version: number;
      updatedAt: string;
    }>();
  if (
    verified?.publishedVersionId !== current.draftVersionId ||
    verified?.draftVersionId !== null ||
    Number(verified?.version) !== resultVersion ||
    verified?.updatedAt !== createdAt
  ) {
    throw new Error("homepage_version_conflict");
  }
}

async function previewNewArrivals(
  db: D1DatabaseLike,
  limit: number,
): Promise<HomepageMerchandisingProduct[]> {
  return allRows<HomepageMerchandisingProduct>(
    db
      .prepare(
        "SELECT p.id AS productId, pv.title, p.current_slug AS slug, " +
          "p.legacy_catalog_id AS legacyId, v.price_minor AS priceMinor, " +
          "pm.public_url AS primaryImageUrl, 0 AS position " +
          "FROM products p " +
          "JOIN product_versions pv ON pv.id = p.current_published_version_id " +
          "LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_default = 1 AND v.active = 1 " +
          "LEFT JOIN product_version_media pvm ON pvm.product_version_id = pv.id AND pvm.is_primary = 1 " +
          "LEFT JOIN product_media pm ON pm.id = pvm.media_id AND pm.deleted_at IS NULL " +
          "WHERE p.publication_status = 'ACTIVE' AND p.current_published_version_id IS NOT NULL " +
          "ORDER BY pv.published_at DESC, p.updated_at DESC, pv.title COLLATE NOCASE LIMIT ?",
      )
      .bind(limit),
  );
}

async function previewCollection(
  db: D1DatabaseLike,
  nodeId: string,
  limit: number,
): Promise<HomepageMerchandisingProduct[]> {
  return allRows<HomepageMerchandisingProduct>(
    db
      .prepare(
        "SELECT DISTINCT p.id AS productId, pv.title, p.current_slug AS slug, " +
          "p.legacy_catalog_id AS legacyId, v.price_minor AS priceMinor, " +
          "pm.public_url AS primaryImageUrl, 0 AS position " +
          "FROM products p " +
          "JOIN product_versions pv ON pv.id = p.current_published_version_id " +
          "JOIN product_version_storefront_placements ps ON ps.product_version_id = pv.id " +
          "LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_default = 1 AND v.active = 1 " +
          "LEFT JOIN product_version_media pvm ON pvm.product_version_id = pv.id AND pvm.is_primary = 1 " +
          "LEFT JOIN product_media pm ON pm.id = pvm.media_id AND pm.deleted_at IS NULL " +
          "WHERE p.publication_status = 'ACTIVE' AND p.current_published_version_id IS NOT NULL " +
          "AND (ps.storefront_node_id = ? OR ps.storefront_node_id IN (" +
            "SELECT cn.id FROM storefront_nodes cn " +
            "JOIN storefront_node_versions cv ON cv.id = cn.current_published_version_id " +
            "WHERE cn.publication_status = 'ACTIVE' AND cv.parent_node_id = ?" +
          ")) ORDER BY pv.title COLLATE NOCASE LIMIT ?",
      )
      .bind(nodeId, nodeId, limit),
  );
}

export async function previewAdminHomepageMerchandising(
  db: D1DatabaseLike,
): Promise<HomepageMerchandisingPreview> {
  const config = await getAdminHomepageMerchandising(db);
  let products: HomepageMerchandisingProduct[] = [];
  if (config.enabled) {
    if (config.mode === "FEATURED_PRODUCTS") {
      products = (
        await selectedProducts(db, config.effectiveVersionId, true)
      ).slice(0, config.productLimit);
    } else if (config.mode === "SELECTED_COLLECTION") {
      if (config.selectedStorefrontNodeId) {
        products = await previewCollection(
          db,
          config.selectedStorefrontNodeId,
          config.productLimit,
        );
      }
    } else {
      products = await previewNewArrivals(db, config.productLimit);
    }
  }
  return { config, products };
}

export async function getPublishedHomepageMerchandisingPreview(
  db: D1DatabaseLike,
): Promise<HomepageMerchandisingPreview> {
  const config = await getPublishedHomepageMerchandising(db);
  let products: HomepageMerchandisingProduct[] = [];
  if (config.enabled) {
    if (config.mode === "FEATURED_PRODUCTS") {
      products = (
        await selectedProducts(db, config.effectiveVersionId, true)
      ).slice(0, config.productLimit);
    } else if (config.mode === "SELECTED_COLLECTION") {
      if (config.selectedStorefrontNodeId) {
        products = await previewCollection(
          db,
          config.selectedStorefrontNodeId,
          config.productLimit,
        );
      }
    } else {
      products = await previewNewArrivals(db, config.productLimit);
    }
  }
  return { config, products };
}
