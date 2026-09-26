import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "./d1";
import {
  bulkInventoryCount,
  getInventorySnapshot,
} from "./inventory";

const DEFAULT_LOCATION_ID = "loc_ambleside";
const MAX_STOCKTAKE_ITEMS = 500;
const MAX_QUANTITY = 1_000_000;

type StocktakeScopeType =
  | "ENTIRE_SHOP"
  | "STOREFRONT_NODE"
  | "BRAND_RANGE"
  | "CATEGORY"
  | "CUSTOM";

type StocktakeStatus =
  | "IN_PROGRESS"
  | "REVIEW"
  | "COMPLETED"
  | "CANCELLED";

type StocktakeItemStatus =
  | "PENDING"
  | "COUNTED"
  | "SKIPPED"
  | "APPLIED"
  | "UNCHANGED"
  | "CONFLICT";

function uid(prefix: string): string {
  return prefix + "_" + crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function requiredText(value: unknown, code: string, max = 180): string {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(code + "_required");
  if (result.length > max) throw new Error(code + "_too_long");
  return result;
}

function integer(
  value: unknown,
  code: string,
  options: { min?: number; max?: number } = {},
): number {
  const n = Number(value);
  const min = options.min ?? 0;
  const max = options.max ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(code + "_invalid");
  }
  return n;
}

async function allRows<T>(
  statement: D1PreparedStatementLike,
): Promise<T[]> {
  if (!statement.all) throw new Error("database_all_unavailable");
  return (await statement.all<T>()).results;
}

function scopeType(value: unknown): StocktakeScopeType {
  const type = String(value ?? "").trim().toUpperCase();
  if (
    type !== "ENTIRE_SHOP" &&
    type !== "STOREFRONT_NODE" &&
    type !== "BRAND_RANGE" &&
    type !== "CATEGORY" &&
    type !== "CUSTOM"
  ) {
    throw new Error("stocktake_scope_type_invalid");
  }
  return type;
}

async function requireLocation(
  db: D1DatabaseLike,
  locationId: string,
): Promise<void> {
  const row = await db
    .prepare(
      "SELECT id FROM inventory_locations WHERE id = ? AND active = 1 LIMIT 1",
    )
    .bind(locationId)
    .first<{ id: string }>();
  if (!row) throw new Error("stocktake_location_not_found");
}

async function resolveScope(
  db: D1DatabaseLike,
  raw: {
    scopeType?: unknown;
    scopeRefId?: unknown;
    customVariantIds?: unknown;
  },
): Promise<{
  type: StocktakeScopeType;
  refId: string | null;
  label: string;
  sql: string;
  values: unknown[];
}> {
  const type = scopeType(raw.scopeType);

  if (type === "ENTIRE_SHOP") {
    return {
      type,
      refId: null,
      label: "Entire shop",
      sql: "",
      values: [],
    };
  }

  if (type === "STOREFRONT_NODE") {
    const refId = requiredText(
      raw.scopeRefId,
      "stocktake_scope_ref",
      180,
    );
    const row = await db
      .prepare(
        "SELECT ev.name FROM storefront_nodes n " +
          "JOIN storefront_node_versions ev ON ev.id = COALESCE(n.current_draft_version_id, n.current_published_version_id) " +
          "WHERE n.id = ? AND n.publication_status <> 'ARCHIVED' LIMIT 1",
      )
      .bind(refId)
      .first<{ name: string }>();
    if (!row) throw new Error("stocktake_scope_not_found");
    return {
      type,
      refId,
      label: String(row.name),
      sql:
        " AND EXISTS (" +
        "SELECT 1 FROM product_version_storefront_placements ps " +
        "WHERE ps.product_version_id = pv.id AND (" +
          "ps.storefront_node_id = ? OR EXISTS (" +
            "SELECT 1 FROM storefront_nodes child " +
            "JOIN storefront_node_versions cev ON cev.id = COALESCE(child.current_draft_version_id, child.current_published_version_id) " +
            "WHERE child.id = ps.storefront_node_id AND cev.parent_node_id = ?" +
          ")" +
        "))",
      values: [refId, refId],
    };
  }

  if (type === "BRAND_RANGE" || type === "CATEGORY") {
    const refId = requiredText(
      raw.scopeRefId,
      "stocktake_scope_ref",
      180,
    );
    const row = await db
      .prepare(
        "SELECT name, category_type AS categoryType FROM categories " +
          "WHERE id = ? AND active = 1 LIMIT 1",
      )
      .bind(refId)
      .first<{ name: string; categoryType: string }>();
    if (!row) throw new Error("stocktake_scope_not_found");
    if (
      type === "BRAND_RANGE" &&
      String(row.categoryType) !== "BRAND_RANGE"
    ) {
      throw new Error("stocktake_scope_type_mismatch");
    }
    if (
      type === "CATEGORY" &&
      String(row.categoryType) === "BRAND_RANGE"
    ) {
      throw new Error("stocktake_scope_type_mismatch");
    }
    return {
      type,
      refId,
      label: String(row.name),
      sql:
        " AND EXISTS (" +
        "SELECT 1 FROM product_version_categories pvc " +
        "JOIN categories c ON c.id = pvc.category_id " +
        "WHERE pvc.product_version_id = pv.id AND c.id = ? AND c.active = 1)",
      values: [refId],
    };
  }

  if (!Array.isArray(raw.customVariantIds)) {
    throw new Error("stocktake_custom_items_required");
  }
  const ids = raw.customVariantIds
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
  if (!ids.length || ids.length > MAX_STOCKTAKE_ITEMS) {
    throw new Error("stocktake_custom_items_invalid");
  }
  return {
    type,
    refId: null,
    label: "Custom selection",
    sql: " AND v.id IN (" + ids.map(() => "?").join(",") + ")",
    values: ids,
  };
}

const stocktakeFromSql =
  " FROM product_variants v " +
  "JOIN products p ON p.id = v.product_id " +
  "JOIN product_versions pv ON pv.id = COALESCE(p.current_draft_version_id, p.current_published_version_id) " +
  "LEFT JOIN inventory_balances b ON b.variant_id = v.id AND b.location_id = ? " +
  "WHERE v.active = 1 AND p.publication_status <> 'ARCHIVED'";

export interface CreateStocktakeSessionInput {
  locationId?: unknown;
  scopeType?: unknown;
  scopeRefId?: unknown;
  customVariantIds?: unknown;
}

async function countScope(
  db: D1DatabaseLike,
  locationId: string,
  scope: Awaited<ReturnType<typeof resolveScope>>,
): Promise<number> {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS count" +
        stocktakeFromSql +
        scope.sql,
    )
    .bind(locationId, ...scope.values)
    .first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export async function previewStocktakeScope(
  db: D1DatabaseLike,
  raw: CreateStocktakeSessionInput,
) {
  const locationId =
    String(raw.locationId ?? "").trim() || DEFAULT_LOCATION_ID;
  await requireLocation(db, locationId);
  const scope = await resolveScope(db, raw);
  const totalItems = await countScope(db, locationId, scope);
  if (totalItems > MAX_STOCKTAKE_ITEMS) {
    throw new Error("stocktake_scope_too_large");
  }
  return {
    locationId,
    scopeType: scope.type,
    scopeRefId: scope.refId,
    scopeLabel: scope.label,
    totalItems,
  };
}

export async function createStocktakeSession(
  db: D1DatabaseLike,
  raw: CreateStocktakeSessionInput,
  actorEmail: string,
) {
  const locationId =
    String(raw.locationId ?? "").trim() || DEFAULT_LOCATION_ID;
  await requireLocation(db, locationId);
  const scope = await resolveScope(db, raw);

  const total = await countScope(db, locationId, scope);
  if (total < 1) throw new Error("stocktake_scope_empty");
  if (total > MAX_STOCKTAKE_ITEMS) {
    throw new Error("stocktake_scope_too_large");
  }

  const sessionId = uid("stk");
  const timestamp = now();

  await db.batch([
    db
      .prepare(
        "INSERT INTO stocktake_sessions (" +
          "id, location_id, scope_type, scope_ref_id, scope_label, status, " +
          "total_items, counted_items, skipped_items, conflict_items, current_position, " +
          "created_by, created_at, updated_at, completed_at, version" +
          ") VALUES (?, ?, ?, ?, ?, 'IN_PROGRESS', ?, 0, 0, 0, 0, ?, ?, ?, NULL, 1)",
      )
      .bind(
        sessionId,
        locationId,
        scope.type,
        scope.refId,
        scope.label,
        total,
        actorEmail,
        timestamp,
        timestamp,
      ),
    db
      .prepare(
        "INSERT INTO stocktake_session_items (" +
          "session_id, variant_id, product_id, position, title_snapshot, sku_snapshot, " +
          "thumbnail_url_snapshot, tracked_snapshot, system_on_hand_snapshot, available_snapshot, " +
          "expected_balance_version, variant_version_snapshot, counted_on_hand, item_status, " +
          "conflict_code, saved_at, applied_at, version" +
          ") " +
          "SELECT ?, v.id, v.product_id, " +
          "ROW_NUMBER() OVER (ORDER BY pv.title COLLATE NOCASE, v.id) - 1, " +
          "pv.title, v.sku, " +
          "(SELECT pm.public_url FROM product_version_media pvm " +
            "JOIN product_media pm ON pm.id = pvm.media_id " +
            "WHERE pvm.product_version_id = pv.id AND pvm.is_primary = 1 " +
            "AND pm.deleted_at IS NULL LIMIT 1), " +
          "v.track_inventory, " +
          "CASE WHEN v.track_inventory = 1 THEN COALESCE(b.on_hand,0) ELSE NULL END, " +
          "CASE WHEN v.track_inventory = 1 THEN MAX(0, COALESCE(b.on_hand,0)-COALESCE(b.reserved,0)-COALESCE(b.safety_stock,0)) ELSE NULL END, " +
          "CASE WHEN v.track_inventory = 1 THEN b.version ELSE NULL END, " +
          "v.version, NULL, 'PENDING', NULL, NULL, NULL, 1" +
          stocktakeFromSql +
          scope.sql +
          " ORDER BY pv.title COLLATE NOCASE, v.id",
      )
      .bind(sessionId, locationId, ...scope.values),
  ]);

  return getStocktakeSession(db, sessionId);
}

interface SessionRow {
  id: string;
  locationId: string;
  scopeType: StocktakeScopeType;
  scopeRefId: string | null;
  scopeLabel: string;
  status: StocktakeStatus;
  totalItems: number;
  countedItems: number;
  skippedItems: number;
  conflictItems: number;
  currentPosition: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  version: number;
}

interface SessionItemRow {
  sessionId: string;
  variantId: string;
  productId: string;
  position: number;
  title: string;
  sku: string | null;
  thumbnailUrl: string | null;
  trackedSnapshot: number;
  systemOnHandSnapshot: number | null;
  availableSnapshot: number | null;
  expectedBalanceVersion: number | null;
  variantVersionSnapshot: number;
  countedOnHand: number | null;
  itemStatus: StocktakeItemStatus;
  conflictCode: string | null;
  savedAt: string | null;
  appliedAt: string | null;
  version: number;
  currentTracked: number;
  currentOnHand: number | null;
  currentReserved: number | null;
  currentSafetyStock: number | null;
  currentBalanceVersion: number | null;
  currentVariantVersion: number;
}

function sessionSelect(): string {
  return (
    "SELECT id, location_id AS locationId, scope_type AS scopeType, " +
    "scope_ref_id AS scopeRefId, scope_label AS scopeLabel, status, " +
    "total_items AS totalItems, counted_items AS countedItems, " +
    "skipped_items AS skippedItems, conflict_items AS conflictItems, " +
    "current_position AS currentPosition, created_by AS createdBy, " +
    "created_at AS createdAt, updated_at AS updatedAt, " +
    "completed_at AS completedAt, version FROM stocktake_sessions"
  );
}

export async function listOpenStocktakeSessions(
  db: D1DatabaseLike,
  locationId = DEFAULT_LOCATION_ID,
): Promise<SessionRow[]> {
  return allRows<SessionRow>(
    db
      .prepare(
        sessionSelect() +
          " WHERE location_id = ? AND status IN ('IN_PROGRESS','REVIEW') " +
          "ORDER BY updated_at DESC LIMIT 20",
      )
      .bind(locationId),
  );
}

export async function getStocktakeSession(
  db: D1DatabaseLike,
  sessionId: string,
) {
  const session = await db
    .prepare(sessionSelect() + " WHERE id = ? LIMIT 1")
    .bind(sessionId)
    .first<SessionRow>();
  if (!session) throw new Error("stocktake_not_found");

  const items = await allRows<SessionItemRow>(
    db
      .prepare(
        "SELECT i.session_id AS sessionId, i.variant_id AS variantId, " +
          "i.product_id AS productId, i.position, i.title_snapshot AS title, " +
          "i.sku_snapshot AS sku, i.thumbnail_url_snapshot AS thumbnailUrl, " +
          "i.tracked_snapshot AS trackedSnapshot, " +
          "i.system_on_hand_snapshot AS systemOnHandSnapshot, " +
          "i.available_snapshot AS availableSnapshot, " +
          "i.expected_balance_version AS expectedBalanceVersion, " +
          "i.variant_version_snapshot AS variantVersionSnapshot, " +
          "i.counted_on_hand AS countedOnHand, i.item_status AS itemStatus, " +
          "i.conflict_code AS conflictCode, i.saved_at AS savedAt, " +
          "i.applied_at AS appliedAt, i.version, " +
          "v.track_inventory AS currentTracked, b.on_hand AS currentOnHand, " +
          "b.reserved AS currentReserved, b.safety_stock AS currentSafetyStock, " +
          "b.version AS currentBalanceVersion, v.version AS currentVariantVersion " +
          "FROM stocktake_session_items i " +
          "JOIN product_variants v ON v.id = i.variant_id " +
          "LEFT JOIN inventory_balances b ON b.variant_id = i.variant_id " +
            "AND b.location_id = ? " +
          "WHERE i.session_id = ? ORDER BY i.position",
      )
      .bind(session.locationId, sessionId),
  );

  return {
    session: {
      ...session,
      totalItems: Number(session.totalItems),
      countedItems: Number(session.countedItems),
      skippedItems: Number(session.skippedItems),
      conflictItems: Number(session.conflictItems),
      currentPosition: Number(session.currentPosition),
      version: Number(session.version),
    },
    items: items.map((item) => ({
      ...item,
      position: Number(item.position),
      trackedSnapshot: Number(item.trackedSnapshot) === 1,
      variantVersionSnapshot: Number(item.variantVersionSnapshot),
      itemStatus: String(item.itemStatus) as StocktakeItemStatus,
      version: Number(item.version),
      currentTracked: Number(item.currentTracked) === 1,
      currentVariantVersion: Number(item.currentVariantVersion),
      currentAvailable:
        Number(item.currentTracked) === 1
          ? Math.max(
              0,
              Number(item.currentOnHand ?? 0) -
                Number(item.currentReserved ?? 0) -
                Number(item.currentSafetyStock ?? 0),
            )
          : null,
    })),
  };
}

export interface SaveStocktakeItemInput {
  expectedItemVersion?: unknown;
  countedOnHand?: unknown;
  action?: unknown;
  nextPosition?: unknown;
}

export async function saveStocktakeItem(
  db: D1DatabaseLike,
  sessionId: string,
  variantId: string,
  raw: SaveStocktakeItemInput,
) {
  const session = await db
    .prepare(sessionSelect() + " WHERE id = ? LIMIT 1")
    .bind(sessionId)
    .first<SessionRow>();
  if (!session) throw new Error("stocktake_not_found");
  if (session.status !== "IN_PROGRESS" && session.status !== "REVIEW") {
    throw new Error("stocktake_not_editable");
  }

  const item = await db
    .prepare(
      "SELECT position, item_status AS itemStatus, version " +
        "FROM stocktake_session_items WHERE session_id = ? AND variant_id = ? LIMIT 1",
    )
    .bind(sessionId, variantId)
    .first<{ position: number; itemStatus: StocktakeItemStatus; version: number }>();
  if (!item) throw new Error("stocktake_item_not_found");

  const expectedItemVersion = integer(
    raw.expectedItemVersion,
    "stocktake_item_version",
    { min: 1 },
  );
  if (Number(item.version) !== expectedItemVersion) {
    throw new Error("stocktake_item_version_conflict");
  }

  const action = String(raw.action ?? "COUNT").trim().toUpperCase();
  if (action !== "COUNT" && action !== "SKIP") {
    throw new Error("stocktake_item_action_invalid");
  }
  const countedOnHand =
    action === "COUNT"
      ? integer(raw.countedOnHand, "stocktake_count", {
          min: 0,
          max: MAX_QUANTITY,
        })
      : null;

  let baseline:
    | {
        tracked: boolean;
        onHand: number | null;
        available: number | null;
        balanceVersion: number | null;
        variantVersion: number;
      }
    | null = null;

  if (item.itemStatus === "CONFLICT" && action === "COUNT") {
    const current = await getInventorySnapshot(
      db,
      variantId,
      session.locationId,
    );
    if (!current) throw new Error("stocktake_item_not_found");
    baseline = {
      tracked: current.tracked,
      onHand: current.onHand,
      available: current.available,
      balanceVersion: current.balanceVersion,
      variantVersion: current.variantVersion,
    };
  }

  const timestamp = now();
  const nextPosition =
    raw.nextPosition === undefined
      ? Number(item.position) + 1
      : integer(raw.nextPosition, "stocktake_position", {
          min: 0,
          max: Math.max(0, Number(session.totalItems) - 1),
        });
  const nextItemVersion = expectedItemVersion + 1;

  const itemSql = baseline
    ? "UPDATE stocktake_session_items SET counted_on_hand = ?, item_status = ?, " +
      "conflict_code = NULL, tracked_snapshot = ?, system_on_hand_snapshot = ?, " +
      "available_snapshot = ?, expected_balance_version = ?, variant_version_snapshot = ?, " +
      "saved_at = ?, applied_at = NULL, version = version + 1 " +
      "WHERE session_id = ? AND variant_id = ? AND version = ? " +
      "AND EXISTS (SELECT 1 FROM stocktake_sessions s WHERE s.id = ? " +
      "AND s.status IN ('IN_PROGRESS','REVIEW'))"
    : "UPDATE stocktake_session_items SET counted_on_hand = ?, item_status = ?, " +
      "conflict_code = NULL, saved_at = ?, applied_at = NULL, version = version + 1 " +
      "WHERE session_id = ? AND variant_id = ? AND version = ? " +
      "AND EXISTS (SELECT 1 FROM stocktake_sessions s WHERE s.id = ? " +
      "AND s.status IN ('IN_PROGRESS','REVIEW'))";

  const itemStatement = baseline
    ? db
        .prepare(itemSql)
        .bind(
          countedOnHand,
          action === "COUNT" ? "COUNTED" : "SKIPPED",
          baseline.tracked ? 1 : 0,
          baseline.onHand,
          baseline.available,
          baseline.balanceVersion,
          baseline.variantVersion,
          timestamp,
          sessionId,
          variantId,
          expectedItemVersion,
          sessionId,
        )
    : db
        .prepare(itemSql)
        .bind(
          countedOnHand,
          action === "COUNT" ? "COUNTED" : "SKIPPED",
          timestamp,
          sessionId,
          variantId,
          expectedItemVersion,
          sessionId,
        );

  await db.batch([
    itemStatement,
    db
      .prepare(
        "UPDATE stocktake_sessions SET " +
          "counted_items = (SELECT COUNT(*) FROM stocktake_session_items WHERE session_id = ? AND item_status = 'COUNTED'), " +
          "skipped_items = (SELECT COUNT(*) FROM stocktake_session_items WHERE session_id = ? AND item_status = 'SKIPPED'), " +
          "conflict_items = (SELECT COUNT(*) FROM stocktake_session_items WHERE session_id = ? AND item_status = 'CONFLICT'), " +
          "current_position = ?, updated_at = ?, version = version + 1 " +
          "WHERE id = ? AND status IN ('IN_PROGRESS','REVIEW') AND EXISTS (" +
          "SELECT 1 FROM stocktake_session_items WHERE session_id = ? AND variant_id = ? " +
          "AND version = ? AND saved_at = ?)",
      )
      .bind(
        sessionId,
        sessionId,
        sessionId,
        nextPosition,
        timestamp,
        sessionId,
        sessionId,
        variantId,
        nextItemVersion,
        timestamp,
      ),
  ]);

  const verified = await db
    .prepare(
      "SELECT version, item_status AS itemStatus, saved_at AS savedAt " +
        "FROM stocktake_session_items WHERE session_id = ? AND variant_id = ? LIMIT 1",
    )
    .bind(sessionId, variantId)
    .first<{ version: number; itemStatus: string; savedAt: string | null }>();

  if (
    Number(verified?.version) !== nextItemVersion ||
    verified?.savedAt !== timestamp
  ) {
    throw new Error("stocktake_item_version_conflict");
  }

  return getStocktakeSession(db, sessionId);
}

export async function finalizeStocktakeSession(
  db: D1DatabaseLike,
  sessionId: string,
  actorEmail: string,
) {
  const detail = await getStocktakeSession(db, sessionId);
  const session = detail.session;
  if (session.status !== "IN_PROGRESS" && session.status !== "REVIEW") {
    throw new Error("stocktake_not_finalizable");
  }

  const counted = detail.items.filter(
    (item) => item.itemStatus === "COUNTED",
  );
  if (!counted.length) throw new Error("stocktake_no_counts");

  const preflightConflicts: Array<{ variantId: string; code: string }> = [];
  const safe: Array<{
    variantId: string;
    countedOnHand: number;
    expectedBalanceVersion: number | null;
  }> = [];

  for (const item of counted) {
    const current = await getInventorySnapshot(
      db,
      item.variantId,
      session.locationId,
    );
    if (!current) {
      preflightConflicts.push({
        variantId: item.variantId,
        code: "inventory_variant_not_found",
      });
      continue;
    }

    if (item.trackedSnapshot) {
      if (
        !current.tracked ||
        current.balanceVersion == null ||
        Number(current.balanceVersion) !==
          Number(item.expectedBalanceVersion)
      ) {
        preflightConflicts.push({
          variantId: item.variantId,
          code: "inventory_concurrency_conflict",
        });
        continue;
      }
    } else if (current.tracked) {
      preflightConflicts.push({
        variantId: item.variantId,
        code: "inventory_already_tracked",
      });
      continue;
    }

    safe.push({
      variantId: item.variantId,
      countedOnHand: Number(item.countedOnHand),
      expectedBalanceVersion: item.expectedBalanceVersion,
    });
  }

  const result = safe.length
    ? await bulkInventoryCount(
        db,
        {
          locationId: session.locationId,
          reason: "Stocktake — " + session.scopeLabel,
          idempotencyKey:
            "stocktake:" + session.id + ":finalize:" + session.version,
          items: safe,
        },
        actorEmail,
      )
    : { batchId: uid("ibatch"), success: [], unchanged: [], conflicts: [] };

  const conflicts = [...preflightConflicts, ...result.conflicts];
  const successIds = new Set(result.success.map((row) => row.variantId));
  const unchangedIds = new Set(result.unchanged.map((row) => row.variantId));
  const conflictById = new Map(
    conflicts.map((row) => [row.variantId, row.code]),
  );
  const timestamp = now();
  const statements: D1PreparedStatementLike[] = [];

  for (const item of counted) {
    const conflictCode = conflictById.get(item.variantId);
    const nextStatus: StocktakeItemStatus = conflictCode
      ? "CONFLICT"
      : successIds.has(item.variantId)
        ? "APPLIED"
        : unchangedIds.has(item.variantId)
          ? "UNCHANGED"
          : "CONFLICT";
    const finalConflict =
      nextStatus === "CONFLICT"
        ? conflictCode ?? "inventory_bulk_item_failed"
        : null;
    statements.push(
      db
        .prepare(
          "UPDATE stocktake_session_items SET item_status = ?, conflict_code = ?, " +
            "applied_at = ?, version = version + 1 " +
            "WHERE session_id = ? AND variant_id = ? AND item_status = 'COUNTED' " +
            "AND EXISTS (SELECT 1 FROM stocktake_sessions s WHERE s.id = ? " +
            "AND s.version = ? AND s.status IN ('IN_PROGRESS','REVIEW'))",
        )
        .bind(
          nextStatus,
          finalConflict,
          nextStatus === "CONFLICT" ? null : timestamp,
          sessionId,
          item.variantId,
          sessionId,
          session.version,
        ),
    );
  }

  const nextSessionStatus: StocktakeStatus =
    conflicts.length > 0 ? "REVIEW" : "COMPLETED";
  statements.push(
    db
      .prepare(
        "UPDATE stocktake_sessions SET status = ?, " +
          "counted_items = (SELECT COUNT(*) FROM stocktake_session_items WHERE session_id = ? AND item_status IN ('APPLIED','UNCHANGED')), " +
          "skipped_items = (SELECT COUNT(*) FROM stocktake_session_items WHERE session_id = ? AND item_status = 'SKIPPED'), " +
          "conflict_items = (SELECT COUNT(*) FROM stocktake_session_items WHERE session_id = ? AND item_status = 'CONFLICT'), " +
          "updated_at = ?, completed_at = ?, version = version + 1 " +
          "WHERE id = ? AND version = ? AND status IN ('IN_PROGRESS','REVIEW')",
      )
      .bind(
        nextSessionStatus,
        sessionId,
        sessionId,
        sessionId,
        timestamp,
        nextSessionStatus === "COMPLETED" ? timestamp : null,
        sessionId,
        session.version,
      ),
  );

  await db.batch(statements);

  return {
    ...(await getStocktakeSession(db, sessionId)),
    result: {
      batchId: result.batchId,
      success: result.success,
      unchanged: result.unchanged,
      conflicts,
    },
  };
}

export async function cancelStocktakeSession(
  db: D1DatabaseLike,
  sessionId: string,
  expectedVersion: unknown,
) {
  const version = integer(
    expectedVersion,
    "stocktake_session_version",
    { min: 1 },
  );
  const timestamp = now();
  await db
    .prepare(
      "UPDATE stocktake_sessions SET status = 'CANCELLED', updated_at = ?, " +
        "version = version + 1 WHERE id = ? AND version = ? " +
        "AND status IN ('IN_PROGRESS','REVIEW')",
    )
    .bind(timestamp, sessionId, version)
    .run?.();

  const session = await db
    .prepare(sessionSelect() + " WHERE id = ? LIMIT 1")
    .bind(sessionId)
    .first<SessionRow>();
  if (!session) throw new Error("stocktake_not_found");
  if (session.status !== "CANCELLED") {
    throw new Error("stocktake_session_version_conflict");
  }
  return { session };
}
