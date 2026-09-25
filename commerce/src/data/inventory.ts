
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "./d1";

const DEFAULT_LOCATION_ID = "loc_ambleside";
const MAX_QUANTITY = 1_000_000;
const MAX_BULK_COUNT = 250;

const ADJUSTMENT_REASONS = new Set([
  "RESTOCK",
  "COUNT_CORRECTION",
  "DAMAGE",
  "LOSS",
  "RETURN",
  "FOUND",
  "OTHER",
]);

const q = (...parts: string[]) => parts.join(" ");

function uid(prefix: string): string {
  return prefix + "_" + crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function integer(
  value: unknown,
  name: string,
  options: { min?: number; max?: number; allowZero?: boolean } = {},
): number {
  const number = Number(value);
  const min = options.min ?? 0;
  const max = options.max ?? MAX_QUANTITY;
  if (
    !Number.isInteger(number) ||
    number < min ||
    number > max ||
    (options.allowZero === false && number === 0)
  ) {
    throw new Error("inventory_" + name + "_invalid");
  }
  return number;
}

function requiredText(value: unknown, name: string, max = 240): string {
  const result = String(value ?? "").trim();
  if (!result) throw new Error("inventory_" + name + "_required");
  if (result.length > max) throw new Error("inventory_" + name + "_too_long");
  return result;
}

function optionalText(value: unknown, name: string, max = 500): string | null {
  if (value === undefined || value === null || value === "") return null;
  const result = String(value).trim();
  if (result.length > max) throw new Error("inventory_" + name + "_too_long");
  return result || null;
}

function idempotencyKey(value: unknown): string {
  const key = requiredText(value, "idempotency_key", 160);
  if (key.length < 8 || !/^[A-Za-z0-9:_\-.]+$/.test(key)) {
    throw new Error("inventory_idempotency_key_invalid");
  }
  return key;
}

function available(onHand: number, reserved: number, safetyStock: number): number {
  return Math.max(0, onHand - reserved - safetyStock);
}

async function allRows<T>(
  statement: D1PreparedStatementLike,
): Promise<T[]> {
  if (!statement.all) throw new Error("database_all_unavailable");
  return (await statement.all<T>()).results;
}

async function requireActiveLocation(
  db: D1DatabaseLike,
  locationId: string,
): Promise<{ id: string; code: string; name: string }> {
  const row = await db
    .prepare(
      "SELECT id, code, name FROM inventory_locations WHERE id = ? AND active = 1 LIMIT 1",
    )
    .bind(locationId)
    .first<{ id: string; code: string; name: string }>();
  if (!row) throw new Error("inventory_location_not_found");
  return row;
}

interface VariantInventoryRow {
  variantId: string;
  productId: string;
  title: string;
  sku: string | null;
  trackInventory: number;
  lowStockThreshold: number | null;
  variantVersion: number;
  variantUpdatedAt: string;
  publicationStatus: string;
  sellStatus: string;
  onHand: number | null;
  reserved: number | null;
  safetyStock: number | null;
  balanceVersion: number | null;
  balanceUpdatedAt: string | null;
  incoming: number;
}

async function variantInventoryRow(
  db: D1DatabaseLike,
  variantId: string,
  locationId: string,
): Promise<VariantInventoryRow | null> {
  return db
    .prepare(
      q(
        "SELECT v.id AS variantId, v.product_id AS productId,",
        "pv.title, v.sku, v.track_inventory AS trackInventory,",
        "v.low_stock_threshold AS lowStockThreshold, v.version AS variantVersion,",
        "v.updated_at AS variantUpdatedAt, p.publication_status AS publicationStatus,",
        "p.sell_status AS sellStatus, b.on_hand AS onHand, b.reserved,",
        "b.safety_stock AS safetyStock, b.version AS balanceVersion,",
        "b.updated_at AS balanceUpdatedAt,",
        "COALESCE((",
        "SELECT SUM(ii.expected_quantity - ii.received_quantity)",
        "FROM inventory_incoming ii",
        "WHERE ii.variant_id = v.id AND ii.location_id = ?",
        "AND ii.status IN ('OPEN','PARTIAL')",
        "), 0) AS incoming",
        "FROM product_variants v",
        "JOIN products p ON p.id = v.product_id",
        "JOIN product_versions pv",
        "ON pv.id = COALESCE(p.current_draft_version_id, p.current_published_version_id)",
        "LEFT JOIN inventory_balances b",
        "ON b.variant_id = v.id AND b.location_id = ?",
        "WHERE v.id = ? AND v.active = 1 LIMIT 1",
      ),
    )
    .bind(locationId, locationId, variantId)
    .first<VariantInventoryRow>();
}

export interface InventorySnapshot {
  variantId: string;
  productId: string;
  locationId: string;
  title: string;
  sku: string | null;
  tracked: boolean;
  onHand: number | null;
  reserved: number | null;
  safetyStock: number | null;
  available: number | null;
  incoming: number;
  lowStockThreshold: number | null;
  low: boolean;
  out: boolean;
  balanceVersion: number | null;
  variantVersion: number;
  updatedAt: string;
}

function toSnapshot(
  row: VariantInventoryRow,
  locationId: string,
): InventorySnapshot {
  const tracked = Number(row.trackInventory) === 1;
  const onHand = tracked ? Number(row.onHand ?? 0) : null;
  const reserved = tracked ? Number(row.reserved ?? 0) : null;
  const safetyStock = tracked ? Number(row.safetyStock ?? 0) : null;
  const availableQuantity =
    tracked && onHand !== null && reserved !== null && safetyStock !== null
      ? available(onHand, reserved, safetyStock)
      : null;
  const threshold =
    row.lowStockThreshold === null ? null : Number(row.lowStockThreshold);
  return {
    variantId: row.variantId,
    productId: row.productId,
    locationId,
    title: row.title,
    sku: row.sku,
    tracked,
    onHand,
    reserved,
    safetyStock,
    available: availableQuantity,
    incoming: Number(row.incoming ?? 0),
    low:
      tracked &&
      availableQuantity !== null &&
      availableQuantity > 0 &&
      threshold !== null &&
      availableQuantity <= threshold,
    out: tracked && availableQuantity !== null && availableQuantity <= 0,
    lowStockThreshold: threshold,
    balanceVersion:
      row.balanceVersion === null ? null : Number(row.balanceVersion),
    variantVersion: Number(row.variantVersion),
    updatedAt:
      row.balanceUpdatedAt ?? row.variantUpdatedAt,
  };
}

export async function getInventorySnapshot(
  db: D1DatabaseLike,
  variantId: string,
  locationId = DEFAULT_LOCATION_ID,
): Promise<InventorySnapshot | null> {
  const row = await variantInventoryRow(db, variantId, locationId);
  return row ? toSnapshot(row, locationId) : null;
}

export async function listInventoryLocations(
  db: D1DatabaseLike,
): Promise<Array<{ id: string; code: string; name: string }>> {
  return allRows(
    db.prepare(
      "SELECT id, code, name FROM inventory_locations WHERE active = 1 ORDER BY name COLLATE NOCASE",
    ),
  );
}

export interface InventoryListFilters {
  q?: string;
  category?: string | null;
  state?: string | null;
  locationId?: string | null;
  cursor?: string | null;
  limit?: number;
}

export async function listAdminInventory(
  db: D1DatabaseLike,
  filters: InventoryListFilters = {},
): Promise<{
  items: Array<
    InventorySnapshot & {
      thumbnailUrl: string | null;
      productSlug: string;
      publicationStatus: string;
      sellStatus: string;
    }
  >;
  summary: {
    total: number;
    tracked: number;
    untracked: number;
    low: number;
    out: number;
    incoming: number;
  };
  nextCursor: string | null;
  location: { id: string; code: string; name: string };
}> {
  const locationId = filters.locationId || DEFAULT_LOCATION_ID;
  const location = await requireActiveLocation(db, locationId);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 60));
  const offset = Math.max(0, Number(filters.cursor) || 0);
  const conditions = ["p.publication_status <> 'ARCHIVED'", "v.active = 1"];
  const values: unknown[] = [];

  const search = String(filters.q ?? "").trim().toLowerCase();
  if (search) {
    conditions.push(
      "(LOWER(pv.title) LIKE ? OR LOWER(COALESCE(v.sku,'')) LIKE ? OR LOWER(COALESCE(v.barcode,'')) LIKE ? OR LOWER(COALESCE(p.legacy_catalog_id,'')) LIKE ?)",
    );
    const like = "%" + search + "%";
    values.push(like, like, like, like);
  }

  if (filters.category) {
    conditions.push(
      "EXISTS (SELECT 1 FROM product_version_categories pvc JOIN categories c ON c.id = pvc.category_id WHERE pvc.product_version_id = pv.id AND c.slug = ?)",
    );
    values.push(filters.category);
  }

  const availableSql =
    "MAX(0, COALESCE(b.on_hand,0) - COALESCE(b.reserved,0) - COALESCE(b.safety_stock,0))";
  const incomingSql =
    "COALESCE((SELECT SUM(ii.expected_quantity - ii.received_quantity) FROM inventory_incoming ii WHERE ii.variant_id = v.id AND ii.location_id = ? AND ii.status IN ('OPEN','PARTIAL')),0)";

  switch (filters.state) {
    case "tracked":
      conditions.push("v.track_inventory = 1");
      break;
    case "untracked":
      conditions.push("v.track_inventory = 0");
      break;
    case "low":
      conditions.push(
        "v.track_inventory = 1 AND v.low_stock_threshold IS NOT NULL AND " +
          availableSql +
          " > 0 AND " +
          availableSql +
          " <= v.low_stock_threshold",
      );
      break;
    case "out":
      conditions.push("v.track_inventory = 1 AND " + availableSql + " <= 0");
      break;
    case "incoming":
      conditions.push(
        "EXISTS (SELECT 1 FROM inventory_incoming ii_state WHERE ii_state.variant_id = v.id AND ii_state.location_id = ? AND ii_state.status IN ('OPEN','PARTIAL') AND ii_state.expected_quantity > ii_state.received_quantity)",
      );
      values.push(locationId);
      break;
    case "discrepancies":
      conditions.push("v.track_inventory = 1 AND b.variant_id IS NULL");
      break;
  }

  const where = "WHERE " + conditions.join(" AND ");
  const selectSql = q(
    "SELECT v.id AS variantId, v.product_id AS productId, p.current_slug AS productSlug,",
    "p.publication_status AS publicationStatus, p.sell_status AS sellStatus,",
    "pv.title, v.sku, v.track_inventory AS trackInventory,",
    "v.low_stock_threshold AS lowStockThreshold, v.version AS variantVersion,",
    "v.updated_at AS variantUpdatedAt, b.on_hand AS onHand, b.reserved,",
    "b.safety_stock AS safetyStock, b.version AS balanceVersion,",
    "b.updated_at AS balanceUpdatedAt, pm.public_url AS thumbnailUrl,",
    incomingSql + " AS incoming",
    "FROM product_variants v",
    "JOIN products p ON p.id = v.product_id",
    "JOIN product_versions pv",
    "ON pv.id = COALESCE(p.current_draft_version_id, p.current_published_version_id)",
    "LEFT JOIN inventory_balances b",
    "ON b.variant_id = v.id AND b.location_id = ?",
    "LEFT JOIN product_version_media pvm",
    "ON pvm.product_version_id = pv.id AND pvm.is_primary = 1",
    "LEFT JOIN product_media pm ON pm.id = pvm.media_id AND pm.deleted_at IS NULL",
    where,
    "ORDER BY pv.title COLLATE NOCASE, v.id",
    "LIMIT ? OFFSET ?",
  );

  const queryValues = [locationId, locationId, ...values, limit + 1, offset];
  const rows = await allRows<
    VariantInventoryRow & {
      thumbnailUrl: string | null;
      productSlug: string;
    }
  >(db.prepare(selectSql).bind(...queryValues));

  const page = rows.slice(0, limit).map((row) => ({
    ...toSnapshot(row, locationId),
    thumbnailUrl: row.thumbnailUrl,
    productSlug: row.productSlug,
    publicationStatus: row.publicationStatus,
    sellStatus: row.sellStatus,
  }));

  const summaryRow = await db
    .prepare(
      q(
        "SELECT COUNT(*) AS total,",
        "SUM(CASE WHEN v.track_inventory = 1 THEN 1 ELSE 0 END) AS tracked,",
        "SUM(CASE WHEN v.track_inventory = 0 THEN 1 ELSE 0 END) AS untracked,",
        "SUM(CASE WHEN v.track_inventory = 1 AND v.low_stock_threshold IS NOT NULL",
        "AND MAX(0, COALESCE(b.on_hand,0)-COALESCE(b.reserved,0)-COALESCE(b.safety_stock,0)) > 0",
        "AND MAX(0, COALESCE(b.on_hand,0)-COALESCE(b.reserved,0)-COALESCE(b.safety_stock,0)) <= v.low_stock_threshold",
        "THEN 1 ELSE 0 END) AS low,",
        "SUM(CASE WHEN v.track_inventory = 1",
        "AND MAX(0, COALESCE(b.on_hand,0)-COALESCE(b.reserved,0)-COALESCE(b.safety_stock,0)) <= 0",
        "THEN 1 ELSE 0 END) AS out,",
        "SUM(CASE WHEN EXISTS (",
        "SELECT 1 FROM inventory_incoming ii WHERE ii.variant_id=v.id AND ii.location_id=?",
        "AND ii.status IN ('OPEN','PARTIAL') AND ii.expected_quantity > ii.received_quantity",
        ") THEN 1 ELSE 0 END) AS incoming",
        "FROM product_variants v",
        "JOIN products p ON p.id=v.product_id",
        "LEFT JOIN inventory_balances b ON b.variant_id=v.id AND b.location_id=?",
        "WHERE v.active=1 AND p.publication_status <> 'ARCHIVED'",
      ),
    )
    .bind(locationId, locationId)
    .first<{
      total: number;
      tracked: number;
      untracked: number;
      low: number;
      out: number;
      incoming: number;
    }>();

  return {
    items: page,
    summary: {
      total: Number(summaryRow?.total ?? 0),
      tracked: Number(summaryRow?.tracked ?? 0),
      untracked: Number(summaryRow?.untracked ?? 0),
      low: Number(summaryRow?.low ?? 0),
      out: Number(summaryRow?.out ?? 0),
      incoming: Number(summaryRow?.incoming ?? 0),
    },
    nextCursor: rows.length > limit ? String(offset + limit) : null,
    location,
  };
}

interface ExistingMovement {
  id: string;
  variantId: string;
  locationId: string;
  movementType: string;
  onHandDelta: number;
  reasonCode: string;
  balanceOnHandAfter: number;
  balanceReservedAfter: number;
  balanceSafetyAfter: number;
}

async function movementByKey(
  db: D1DatabaseLike,
  key: string,
): Promise<ExistingMovement | null> {
  return db
    .prepare(
      q(
        "SELECT id, variant_id AS variantId, location_id AS locationId,",
        "movement_type AS movementType, on_hand_delta AS onHandDelta,",
        "reason_code AS reasonCode, balance_on_hand_after AS balanceOnHandAfter,",
        "balance_reserved_after AS balanceReservedAfter,",
        "balance_safety_after AS balanceSafetyAfter",
        "FROM inventory_movements WHERE idempotency_key = ? LIMIT 1",
      ),
    )
    .bind(key)
    .first<ExistingMovement>();
}

async function replaySnapshot(
  db: D1DatabaseLike,
  movement: ExistingMovement,
): Promise<{ snapshot: InventorySnapshot; movementId: string; replayed: true }> {
  const row = await variantInventoryRow(
    db,
    movement.variantId,
    movement.locationId,
  );
  if (!row) throw new Error("inventory_variant_not_found");
  const current = toSnapshot(row, movement.locationId);
  return {
    snapshot: {
      ...current,
      onHand: Number(movement.balanceOnHandAfter),
      reserved: Number(movement.balanceReservedAfter),
      safetyStock: Number(movement.balanceSafetyAfter),
      available: available(
        Number(movement.balanceOnHandAfter),
        Number(movement.balanceReservedAfter),
        Number(movement.balanceSafetyAfter),
      ),
    },
    movementId: movement.id,
    replayed: true,
  };
}

export interface InitialCountInput {
  variantId: unknown;
  locationId?: unknown;
  quantity: unknown;
  reason: unknown;
  idempotencyKey: unknown;
  batchId?: string | null;
}

export async function initialInventoryCount(
  db: D1DatabaseLike,
  raw: InitialCountInput,
  actorEmail: string,
): Promise<{
  snapshot: InventorySnapshot;
  movementId: string;
  replayed: boolean;
}> {
  const variantId = requiredText(raw.variantId, "variant_id", 160);
  const locationId =
    optionalText(raw.locationId, "location_id", 160) ?? DEFAULT_LOCATION_ID;
  const quantity = integer(raw.quantity, "quantity");
  const reason = requiredText(raw.reason, "reason", 240);
  const key = idempotencyKey(raw.idempotencyKey);

  const duplicate = await movementByKey(db, key);
  if (duplicate) {
    if (
      duplicate.variantId !== variantId ||
      duplicate.locationId !== locationId ||
      duplicate.movementType !== "INITIAL_COUNT"
    ) {
      throw new Error("inventory_idempotency_conflict");
    }
    return replaySnapshot(db, duplicate);
  }

  await requireActiveLocation(db, locationId);
  const row = await variantInventoryRow(db, variantId, locationId);
  if (!row) throw new Error("inventory_variant_not_found");
  if (row.publicationStatus === "ARCHIVED") {
    throw new Error("inventory_product_archived");
  }
  if (Number(row.trackInventory) === 1) {
    throw new Error("inventory_already_tracked");
  }
  if (row.balanceVersion !== null) {
    throw new Error("inventory_balance_exists");
  }

  const timestamp = now();
  const movementId = uid("imv");
  const nextVariantVersion = Number(row.variantVersion) + 1;

  try {
    await db.batch([
      db
        .prepare(
          q(
            "UPDATE product_variants",
            "SET track_inventory = 1, version = version + 1, updated_at = ?",
            "WHERE id = ? AND track_inventory = 0 AND version = ?",
          ),
        )
        .bind(timestamp, variantId, row.variantVersion),
      db
        .prepare(
          q(
            "INSERT INTO inventory_balances (",
            "variant_id, location_id, on_hand, reserved, safety_stock, version, updated_at",
            ") SELECT ?, ?, ?, 0, 0, 1, ?",
            "FROM product_variants WHERE id = ? AND version = ? AND updated_at = ?",
          ),
        )
        .bind(
          variantId,
          locationId,
          quantity,
          timestamp,
          variantId,
          nextVariantVersion,
          timestamp,
        ),
      db
        .prepare(
          q(
            "INSERT INTO inventory_movements (",
            "id, variant_id, location_id, movement_type, on_hand_delta, reserved_delta,",
            "safety_stock_delta, reason_code, note, order_id, order_revision_id,",
            "reservation_id, incoming_id, batch_id, idempotency_key, actor_type, actor_id,",
            "created_at, balance_on_hand_after, balance_reserved_after, balance_safety_after",
            ") SELECT ?, ?, ?, 'INITIAL_COUNT', ?, 0, 0, 'INITIAL_COUNT', ?,",
            "NULL, NULL, NULL, NULL, ?, ?, 'ADMIN', ?, ?, ?, 0, 0",
            "FROM inventory_balances b",
            "WHERE b.variant_id = ? AND b.location_id = ? AND b.version = 1 AND b.updated_at = ?",
          ),
        )
        .bind(
          movementId,
          variantId,
          locationId,
          quantity,
          reason,
          raw.batchId ?? null,
          key,
          actorEmail,
          timestamp,
          quantity,
          variantId,
          locationId,
          timestamp,
        ),
    ]);
  } catch (cause) {
    const replay = await movementByKey(db, key);
    if (replay) return replaySnapshot(db, replay);
    throw cause;
  }

  const verified = await variantInventoryRow(db, variantId, locationId);
  if (
    !verified ||
    Number(verified.trackInventory) !== 1 ||
    Number(verified.balanceVersion) !== 1 ||
    verified.balanceUpdatedAt !== timestamp
  ) {
    throw new Error("inventory_concurrency_conflict");
  }

  return {
    snapshot: toSnapshot(verified, locationId),
    movementId,
    replayed: false,
  };
}

function adjustmentMovementType(
  reasonCode: string,
  delta: number,
): string {
  if (reasonCode === "DAMAGE") {
    if (delta >= 0) throw new Error("inventory_adjustment_sign_invalid");
    return "DAMAGE";
  }
  if (reasonCode === "LOSS") {
    if (delta >= 0) throw new Error("inventory_adjustment_sign_invalid");
    return "LOSS";
  }
  if (reasonCode === "RETURN") {
    if (delta <= 0) throw new Error("inventory_adjustment_sign_invalid");
    return "RETURN";
  }
  if (reasonCode === "RESTOCK" || reasonCode === "FOUND") {
    if (delta <= 0) throw new Error("inventory_adjustment_sign_invalid");
  }
  return "MANUAL_ADJUSTMENT";
}

export interface InventoryAdjustmentInput {
  variantId: unknown;
  locationId?: unknown;
  delta: unknown;
  reasonCode: unknown;
  note?: unknown;
  expectedBalanceVersion: unknown;
  idempotencyKey: unknown;
  batchId?: string | null;
}

export async function adjustInventory(
  db: D1DatabaseLike,
  raw: InventoryAdjustmentInput,
  actorEmail: string,
): Promise<{
  snapshot: InventorySnapshot;
  movementId: string;
  replayed: boolean;
}> {
  const variantId = requiredText(raw.variantId, "variant_id", 160);
  const locationId =
    optionalText(raw.locationId, "location_id", 160) ?? DEFAULT_LOCATION_ID;
  const delta = integer(raw.delta, "delta", {
    min: -MAX_QUANTITY,
    max: MAX_QUANTITY,
    allowZero: false,
  });
  const reasonCode = requiredText(raw.reasonCode, "reason_code", 80);
  if (!ADJUSTMENT_REASONS.has(reasonCode)) {
    throw new Error("inventory_reason_code_invalid");
  }
  const movementType = adjustmentMovementType(reasonCode, delta);
  const note = optionalText(raw.note, "note");
  const expectedBalanceVersion = integer(
    raw.expectedBalanceVersion,
    "expected_balance_version",
    { min: 1, max: Number.MAX_SAFE_INTEGER },
  );
  const key = idempotencyKey(raw.idempotencyKey);

  const duplicate = await movementByKey(db, key);
  if (duplicate) {
    if (
      duplicate.variantId !== variantId ||
      duplicate.locationId !== locationId
    ) {
      throw new Error("inventory_idempotency_conflict");
    }
    return replaySnapshot(db, duplicate);
  }

  await requireActiveLocation(db, locationId);
  const row = await variantInventoryRow(db, variantId, locationId);
  if (!row) throw new Error("inventory_variant_not_found");
  if (Number(row.trackInventory) !== 1 || row.balanceVersion === null) {
    throw new Error("inventory_not_tracked");
  }
  if (Number(row.balanceVersion) !== expectedBalanceVersion) {
    throw new Error("inventory_balance_version_conflict");
  }

  const currentOnHand = Number(row.onHand ?? 0);
  const currentReserved = Number(row.reserved ?? 0);
  const currentSafety = Number(row.safetyStock ?? 0);
  const nextOnHand = currentOnHand + delta;
  if (nextOnHand < 0) throw new Error("inventory_negative_on_hand");

  const timestamp = now();
  const movementId = uid("imv");
  const nextBalanceVersion = expectedBalanceVersion + 1;

  try {
    await db.batch([
      db
        .prepare(
          q(
            "UPDATE inventory_balances",
            "SET on_hand = ?, version = version + 1, updated_at = ?",
            "WHERE variant_id = ? AND location_id = ? AND version = ?",
          ),
        )
        .bind(
          nextOnHand,
          timestamp,
          variantId,
          locationId,
          expectedBalanceVersion,
        ),
      db
        .prepare(
          q(
            "INSERT INTO inventory_movements (",
            "id, variant_id, location_id, movement_type, on_hand_delta, reserved_delta,",
            "safety_stock_delta, reason_code, note, order_id, order_revision_id,",
            "reservation_id, incoming_id, batch_id, idempotency_key, actor_type, actor_id,",
            "created_at, balance_on_hand_after, balance_reserved_after, balance_safety_after",
            ") SELECT ?, ?, ?, ?, ?, 0, 0, ?, ?, NULL, NULL, NULL, NULL, ?, ?,",
            "'ADMIN', ?, ?, b.on_hand, b.reserved, b.safety_stock",
            "FROM inventory_balances b",
            "WHERE b.variant_id = ? AND b.location_id = ? AND b.version = ? AND b.updated_at = ?",
          ),
        )
        .bind(
          movementId,
          variantId,
          locationId,
          movementType,
          delta,
          reasonCode,
          note,
          raw.batchId ?? null,
          key,
          actorEmail,
          timestamp,
          variantId,
          locationId,
          nextBalanceVersion,
          timestamp,
        ),
    ]);
  } catch (cause) {
    const replay = await movementByKey(db, key);
    if (replay) return replaySnapshot(db, replay);
    throw cause;
  }

  const verified = await variantInventoryRow(db, variantId, locationId);
  if (
    !verified ||
    Number(verified.balanceVersion) !== nextBalanceVersion ||
    verified.balanceUpdatedAt !== timestamp
  ) {
    throw new Error("inventory_balance_version_conflict");
  }

  return {
    snapshot: toSnapshot(verified, locationId),
    movementId,
    replayed: false,
  };
}

export interface PhysicalCountInput {
  variantId: unknown;
  locationId?: unknown;
  countedOnHand: unknown;
  reason: unknown;
  expectedBalanceVersion: unknown;
  idempotencyKey: unknown;
  batchId?: string | null;
}

export async function physicalInventoryCount(
  db: D1DatabaseLike,
  raw: PhysicalCountInput,
  actorEmail: string,
): Promise<{
  snapshot: InventorySnapshot;
  movementId: string;
  replayed: boolean;
}> {
  const variantId = requiredText(raw.variantId, "variant_id", 160);
  const locationId =
    optionalText(raw.locationId, "location_id", 160) ?? DEFAULT_LOCATION_ID;
  const countedOnHand = integer(raw.countedOnHand, "counted_on_hand");
  const reason = requiredText(raw.reason, "reason", 240);
  const expectedBalanceVersion = integer(
    raw.expectedBalanceVersion,
    "expected_balance_version",
    { min: 1, max: Number.MAX_SAFE_INTEGER },
  );
  const key = idempotencyKey(raw.idempotencyKey);

  const duplicate = await movementByKey(db, key);
  if (duplicate) {
    if (
      duplicate.variantId !== variantId ||
      duplicate.locationId !== locationId
    ) {
      throw new Error("inventory_idempotency_conflict");
    }
    return replaySnapshot(db, duplicate);
  }

  await requireActiveLocation(db, locationId);
  const row = await variantInventoryRow(db, variantId, locationId);
  if (!row) throw new Error("inventory_variant_not_found");
  if (Number(row.trackInventory) !== 1 || row.balanceVersion === null) {
    throw new Error("inventory_not_tracked");
  }
  if (Number(row.balanceVersion) !== expectedBalanceVersion) {
    throw new Error("inventory_balance_version_conflict");
  }

  const currentOnHand = Number(row.onHand ?? 0);
  const currentReserved = Number(row.reserved ?? 0);
  const currentSafety = Number(row.safetyStock ?? 0);
  const delta = countedOnHand - currentOnHand;
  const timestamp = now();
  const movementId = uid("imv");
  const nextBalanceVersion = expectedBalanceVersion + 1;

  try {
    await db.batch([
      db
        .prepare(
          q(
            "UPDATE inventory_balances",
            "SET on_hand = ?, version = version + 1, updated_at = ?",
            "WHERE variant_id = ? AND location_id = ? AND version = ?",
          ),
        )
        .bind(
          countedOnHand,
          timestamp,
          variantId,
          locationId,
          expectedBalanceVersion,
        ),
      db
        .prepare(
          q(
            "INSERT INTO inventory_movements (",
            "id, variant_id, location_id, movement_type, on_hand_delta, reserved_delta,",
            "safety_stock_delta, reason_code, note, order_id, order_revision_id,",
            "reservation_id, incoming_id, batch_id, idempotency_key, actor_type, actor_id,",
            "created_at, balance_on_hand_after, balance_reserved_after, balance_safety_after",
            ") SELECT ?, ?, ?, 'CORRECTION', ?, 0, 0, 'PHYSICAL_COUNT', ?,",
            "NULL, NULL, NULL, NULL, ?, ?, 'ADMIN', ?, ?, b.on_hand, b.reserved, b.safety_stock",
            "FROM inventory_balances b",
            "WHERE b.variant_id = ? AND b.location_id = ? AND b.version = ? AND b.updated_at = ?",
          ),
        )
        .bind(
          movementId,
          variantId,
          locationId,
          delta,
          reason,
          raw.batchId ?? null,
          key,
          actorEmail,
          timestamp,
          variantId,
          locationId,
          nextBalanceVersion,
          timestamp,
        ),
    ]);
  } catch (cause) {
    const replay = await movementByKey(db, key);
    if (replay) return replaySnapshot(db, replay);
    throw cause;
  }

  const verified = await variantInventoryRow(db, variantId, locationId);
  if (
    !verified ||
    Number(verified.balanceVersion) !== nextBalanceVersion ||
    verified.balanceUpdatedAt !== timestamp
  ) {
    throw new Error("inventory_balance_version_conflict");
  }

  return {
    snapshot: toSnapshot(verified, locationId),
    movementId,
    replayed: false,
  };
}

export async function listInventoryHistory(
  db: D1DatabaseLike,
  variantId: string,
  options: {
    locationId?: string | null;
    cursor?: string | null;
    limit?: number;
  } = {},
): Promise<{
  movements: Array<Record<string, unknown>>;
  nextCursor: string | null;
}> {
  const locationId = options.locationId || DEFAULT_LOCATION_ID;
  const limit = Math.max(1, Math.min(100, Number(options.limit) || 40));
  const offset = Math.max(0, Number(options.cursor) || 0);
  const rows = await allRows<Record<string, unknown>>(
    db
      .prepare(
        q(
          "SELECT id, movement_type AS movementType, on_hand_delta AS onHandDelta,",
          "reserved_delta AS reservedDelta, safety_stock_delta AS safetyStockDelta,",
          "reason_code AS reasonCode, note, batch_id AS batchId, actor_type AS actorType,",
          "actor_id AS actorId, created_at AS createdAt,",
          "balance_on_hand_after AS onHandAfter,",
          "balance_reserved_after AS reservedAfter,",
          "balance_safety_after AS safetyStockAfter",
          "FROM inventory_movements",
          "WHERE variant_id = ? AND location_id = ?",
          "ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
        ),
      )
      .bind(variantId, locationId, limit + 1, offset),
  );
  return {
    movements: rows.slice(0, limit),
    nextCursor: rows.length > limit ? String(offset + limit) : null,
  };
}

export interface BulkCountInput {
  locationId?: unknown;
  reason: unknown;
  idempotencyKey: unknown;
  items: unknown;
}

export async function bulkInventoryCount(
  db: D1DatabaseLike,
  raw: BulkCountInput,
  actorEmail: string,
): Promise<{
  batchId: string;
  success: Array<{ variantId: string; snapshot: InventorySnapshot }>;
  conflicts: Array<{ variantId: string; code: string }>;
  unchanged: Array<{ variantId: string; snapshot: InventorySnapshot }>;
}> {
  const locationId =
    optionalText(raw.locationId, "location_id", 160) ?? DEFAULT_LOCATION_ID;
  const reason = requiredText(raw.reason, "reason", 240);
  const baseKey = idempotencyKey(raw.idempotencyKey);
  if (!Array.isArray(raw.items) || raw.items.length < 1 || raw.items.length > MAX_BULK_COUNT) {
    throw new Error("inventory_bulk_items_invalid");
  }
  await requireActiveLocation(db, locationId);

  const batchId = uid("ibatch");
  const success: Array<{ variantId: string; snapshot: InventorySnapshot }> = [];
  const conflicts: Array<{ variantId: string; code: string }> = [];
  const unchanged: Array<{ variantId: string; snapshot: InventorySnapshot }> = [];

  const seen = new Set<string>();
  for (const item of raw.items) {
    const record =
      item && typeof item === "object" && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {};
    let variantId = "";
    try {
      variantId = requiredText(record.variantId, "variant_id", 160);
      if (seen.has(variantId)) throw new Error("inventory_bulk_duplicate_variant");
      seen.add(variantId);
      const countedOnHand = integer(record.countedOnHand, "counted_on_hand");
      const snapshot = await getInventorySnapshot(db, variantId, locationId);
      if (!snapshot) throw new Error("inventory_variant_not_found");

      if (snapshot.tracked && snapshot.onHand === countedOnHand) {
        unchanged.push({ variantId, snapshot });
        continue;
      }

      const childKey = baseKey + ":" + variantId + ":" + locationId;
      if (!snapshot.tracked) {
        const result = await initialInventoryCount(
          db,
          {
            variantId,
            locationId,
            quantity: countedOnHand,
            reason,
            idempotencyKey: childKey,
            batchId,
          },
          actorEmail,
        );
        success.push({ variantId, snapshot: result.snapshot });
      } else {
        const expectedBalanceVersion =
          record.expectedBalanceVersion ?? snapshot.balanceVersion;
        const result = await physicalInventoryCount(
          db,
          {
            variantId,
            locationId,
            countedOnHand,
            reason,
            expectedBalanceVersion,
            idempotencyKey: childKey,
            batchId,
          },
          actorEmail,
        );
        success.push({ variantId, snapshot: result.snapshot });
      }
    } catch (cause) {
      conflicts.push({
        variantId: variantId || String((item as Record<string, unknown>)?.variantId ?? ""),
        code: cause instanceof Error ? cause.message : "inventory_bulk_item_failed",
      });
    }
  }

  return { batchId, success, conflicts, unchanged };
}
