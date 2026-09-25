import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "./d1";

export const DEFAULT_RESERVATION_LOCATION_ID = "loc_ambleside";

interface ReservationResolutionRow {
  revisionItemId: number;
  lineNumber: number;
  catalogProductId: string;
  confirmedQuantity: number;
  productId: string | null;
  variantId: string | null;
  trackInventory: number | null;
  onHand: number | null;
  reserved: number | null;
  safetyStock: number | null;
  balanceVersion: number | null;
}

export interface ReservationLineAvailability {
  revisionItemId: number;
  lineNumber: number;
  catalogProductId: string;
  confirmedQuantity: number;
  productId: string | null;
  variantId: string | null;
  resolved: boolean;
  tracked: boolean;
  onHand: number | null;
  reserved: number | null;
  safetyStock: number | null;
  available: number | null;
  balanceVersion: number | null;
  sufficient: boolean;
}

export interface ReservationVariantRequirement {
  variantId: string;
  requiredQuantity: number;
  onHand: number;
  reserved: number;
  safetyStock: number;
  available: number;
  balanceVersion: number;
}

export interface RevisionReservationPlan {
  revisionId: string;
  locationId: string;
  lines: ReservationLineAvailability[];
  trackedLines: ReservationLineAvailability[];
  untrackedLines: ReservationLineAvailability[];
  requirements: ReservationVariantRequirement[];
}

export interface ReservationConflict {
  variantId: string;
  requiredQuantity: number;
  available: number;
}

export class ReservationAvailabilityError extends Error {
  readonly conflicts: ReservationConflict[];

  constructor(conflicts: ReservationConflict[]) {
    super("reservation_insufficient_stock");
    this.name = "ReservationAvailabilityError";
    this.conflicts = conflicts;
  }
}

async function allRows<T>(
  statement: D1PreparedStatementLike,
): Promise<T[]> {
  if (!statement.all) throw new Error("d1_all_not_supported");
  return (await statement.all<T>()).results ?? [];
}

async function requireActiveLocation(
  db: D1DatabaseLike,
  locationId: string,
): Promise<void> {
  const row = await db
    .prepare(
      "SELECT id FROM inventory_locations WHERE id = ? AND active = 1 LIMIT 1",
    )
    .bind(locationId)
    .first<{ id: string }>();
  if (!row) throw new Error("reservation_location_not_found");
}

export async function buildRevisionReservationPlan(
  db: D1DatabaseLike,
  revisionId: string,
  locationId = DEFAULT_RESERVATION_LOCATION_ID,
): Promise<RevisionReservationPlan> {
  if (!revisionId || !revisionId.trim()) {
    throw new Error("reservation_revision_required");
  }
  await requireActiveLocation(db, locationId);

  const rows = await allRows<ReservationResolutionRow>(
    db
      .prepare(
        `SELECT
          ri.id AS revisionItemId,
          ri.line_number AS lineNumber,
          ri.catalog_product_id AS catalogProductId,
          ri.confirmed_quantity AS confirmedQuantity,
          p.id AS productId,
          v.id AS variantId,
          v.track_inventory AS trackInventory,
          b.on_hand AS onHand,
          b.reserved AS reserved,
          b.safety_stock AS safetyStock,
          b.version AS balanceVersion
        FROM order_revision_items ri
        LEFT JOIN products p ON p.id = COALESCE(
          (
            SELECT legacy_match.id
            FROM products legacy_match
            WHERE legacy_match.legacy_catalog_id = ri.catalog_product_id
            LIMIT 1
          ),
          (
            SELECT uuid_match.id
            FROM products uuid_match
            WHERE uuid_match.id = ri.catalog_product_id
            LIMIT 1
          )
        )
        LEFT JOIN product_variants v
          ON v.product_id = p.id
          AND v.is_default = 1
          AND v.active = 1
        LEFT JOIN inventory_balances b
          ON b.variant_id = v.id
          AND b.location_id = ?
        WHERE ri.revision_id = ?
          AND ri.confirmed_quantity > 0
        ORDER BY ri.line_number ASC`,
      )
      .bind(locationId, revisionId),
  );

  const baseLines: ReservationLineAvailability[] = rows.map((row) => {
    const tracked = Boolean(row.variantId) && Number(row.trackInventory) === 1;
    if (tracked && row.balanceVersion === null) {
      throw new Error("reservation_tracked_balance_missing");
    }

    const onHand = tracked ? Number(row.onHand ?? 0) : null;
    const reserved = tracked ? Number(row.reserved ?? 0) : null;
    const safetyStock = tracked ? Number(row.safetyStock ?? 0) : null;
    const available =
      tracked && onHand !== null && reserved !== null && safetyStock !== null
        ? Math.max(0, onHand - reserved - safetyStock)
        : null;

    return {
      revisionItemId: Number(row.revisionItemId),
      lineNumber: Number(row.lineNumber),
      catalogProductId: row.catalogProductId,
      confirmedQuantity: Number(row.confirmedQuantity),
      productId: row.productId,
      variantId: row.variantId,
      resolved: Boolean(row.productId && row.variantId),
      tracked,
      onHand,
      reserved,
      safetyStock,
      available,
      balanceVersion: tracked ? Number(row.balanceVersion) : null,
      sufficient: true,
    };
  });

  const grouped = new Map<
    string,
    ReservationVariantRequirement
  >();

  for (const line of baseLines) {
    if (
      !line.tracked ||
      !line.variantId ||
      line.onHand === null ||
      line.reserved === null ||
      line.safetyStock === null ||
      line.available === null ||
      line.balanceVersion === null
    ) {
      continue;
    }

    const existing = grouped.get(line.variantId);
    if (existing) {
      existing.requiredQuantity += line.confirmedQuantity;
      continue;
    }

    grouped.set(line.variantId, {
      variantId: line.variantId,
      requiredQuantity: line.confirmedQuantity,
      onHand: line.onHand,
      reserved: line.reserved,
      safetyStock: line.safetyStock,
      available: line.available,
      balanceVersion: line.balanceVersion,
    });
  }

  const requirements = Array.from(grouped.values());
  const sufficientByVariant = new Map(
    requirements.map((requirement) => [
      requirement.variantId,
      requirement.available >= requirement.requiredQuantity,
    ]),
  );

  const lines = baseLines.map((line) => ({
    ...line,
    sufficient:
      !line.tracked ||
      !line.variantId ||
      sufficientByVariant.get(line.variantId) !== false,
  }));

  return {
    revisionId,
    locationId,
    lines,
    trackedLines: lines.filter((line) => line.tracked),
    untrackedLines: lines.filter((line) => !line.tracked),
    requirements,
  };
}

export function assertReservationAvailability(
  plan: RevisionReservationPlan,
): void {
  const conflicts = plan.requirements
    .filter(
      (requirement) =>
        requirement.available < requirement.requiredQuantity,
    )
    .map((requirement) => ({
      variantId: requirement.variantId,
      requiredQuantity: requirement.requiredQuantity,
      available: requirement.available,
    }));

  if (conflicts.length) {
    throw new ReservationAvailabilityError(conflicts);
  }
}


export interface ReservationMutationInput {
  orderId: string;
  actorEmail: string;
  expiresAt: string;
  revisionVersion: number;
  revisionMutationToken: string;
  idempotencyKey?: string;
  createdAt?: string;
}

export interface PreparedReservationMutation {
  reservationId: string;
  reservationMutationToken: string;
  idempotencyKey: string;
  expiresAt: string;
  statements: D1PreparedStatementLike[];
  balanceMutationTokens: Record<string, string>;
}

function uid(prefix: string): string {
  return prefix + "_" + crypto.randomUUID();
}

function requiredMutationText(
  value: string,
  code: string,
): string {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(code);
  return text;
}

export function prepareReservationMutation(
  db: D1DatabaseLike,
  plan: RevisionReservationPlan,
  input: ReservationMutationInput,
): PreparedReservationMutation {
  assertReservationAvailability(plan);

  const orderId = requiredMutationText(
    input.orderId,
    "reservation_order_required",
  );
  const actorEmail = requiredMutationText(
    input.actorEmail,
    "reservation_actor_required",
  );
  const revisionMutationToken = requiredMutationText(
    input.revisionMutationToken,
    "reservation_revision_mutation_token_required",
  );
  if (!Number.isInteger(input.revisionVersion) || input.revisionVersion < 1) {
    throw new Error("reservation_revision_version_invalid");
  }

  const expiresMs = Date.parse(input.expiresAt);
  if (!Number.isFinite(expiresMs)) {
    throw new Error("reservation_expiry_invalid");
  }

  const createdAt = input.createdAt ?? new Date().toISOString();
  const reservationId = uid("res");
  const reservationMutationToken = uid("rmut");
  const idempotencyKey =
    String(input.idempotencyKey ?? "").trim() ||
    "reservation:" + plan.revisionId + ":v" + input.revisionVersion;

  const statements: D1PreparedStatementLike[] = [];
  const balanceMutationTokens: Record<string, string> = {};

  for (const requirement of plan.requirements) {
    const balanceMutationToken = uid("imut");
    balanceMutationTokens[requirement.variantId] = balanceMutationToken;

    statements.push(
      db
        .prepare(
          `UPDATE inventory_balances
          SET reserved = reserved + ?,
              version = version + 1,
              mutation_token = ?,
              updated_at = ?
          WHERE variant_id = ?
            AND location_id = ?
            AND version = ?
            AND (on_hand - reserved - safety_stock) >= ?
            AND EXISTS (
              SELECT 1
              FROM order_revisions
              WHERE id = ?
                AND version = ?
                AND mutation_token = ?
                AND state = 'DRAFT'
            )`,
        )
        .bind(
          requirement.requiredQuantity,
          balanceMutationToken,
          createdAt,
          requirement.variantId,
          plan.locationId,
          requirement.balanceVersion,
          requirement.requiredQuantity,
          plan.revisionId,
          input.revisionVersion,
          revisionMutationToken,
        ),
    );
  }

  const guardSql = plan.requirements.length
    ? plan.requirements
        .map(
          () =>
            `EXISTS (
              SELECT 1
              FROM inventory_balances guard_balance
              WHERE guard_balance.variant_id = ?
                AND guard_balance.location_id = ?
                AND guard_balance.version = ?
                AND guard_balance.mutation_token = ?
            )`,
        )
        .join(" AND ")
    : "1 = 1";

  const guardValues: unknown[] = [];
  for (const requirement of plan.requirements) {
    guardValues.push(
      requirement.variantId,
      plan.locationId,
      requirement.balanceVersion + 1,
      balanceMutationTokens[requirement.variantId],
    );
  }

  statements.push(
    db
      .prepare(
        `INSERT INTO inventory_reservations (
          id, order_id, revision_id, location_id, state, expires_at,
          committed_at, released_at, consumed_at, release_reason,
          version, mutation_token, idempotency_key, created_by,
          created_at, updated_at
        )
        SELECT
          ?, ?, ?, ?, 'ACTIVE', ?,
          NULL, NULL, NULL, NULL,
          1,
          CASE WHEN ${guardSql} THEN ? ELSE NULL END,
          ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1
          FROM order_revisions
          WHERE id = ?
            AND version = ?
            AND mutation_token = ?
            AND state = 'DRAFT'
        )`,
      )
      .bind(
        reservationId,
        orderId,
        plan.revisionId,
        plan.locationId,
        input.expiresAt,
        ...guardValues,
        reservationMutationToken,
        idempotencyKey,
        actorEmail,
        createdAt,
        createdAt,
        plan.revisionId,
        input.revisionVersion,
        revisionMutationToken,
      ),
  );

  for (const line of plan.trackedLines) {
    if (!line.variantId) continue;
    statements.push(
      db
        .prepare(
          `INSERT INTO inventory_reservation_items (
            id, reservation_id, revision_item_id, variant_id, quantity, created_at
          )
          SELECT ?, ?, ?, ?, ?, ?
          WHERE EXISTS (
            SELECT 1
            FROM inventory_reservations
            WHERE id = ?
              AND mutation_token = ?
              AND state = 'ACTIVE'
          )`,
        )
        .bind(
          uid("ritem"),
          reservationId,
          line.revisionItemId,
          line.variantId,
          line.confirmedQuantity,
          createdAt,
          reservationId,
          reservationMutationToken,
        ),
    );
  }

  for (const requirement of plan.requirements) {
    const balanceMutationToken =
      balanceMutationTokens[requirement.variantId];
    statements.push(
      db
        .prepare(
          `INSERT INTO inventory_movements (
            id, variant_id, location_id, movement_type,
            on_hand_delta, reserved_delta, safety_stock_delta,
            reason_code, note, order_id, order_revision_id,
            reservation_id, incoming_id, batch_id, idempotency_key,
            actor_type, actor_id, created_at,
            balance_on_hand_after, balance_reserved_after, balance_safety_after
          )
          SELECT
            ?, b.variant_id, b.location_id, 'ORDER_RESERVATION',
            0, ?, 0,
            'ORDER_RESERVATION', 'Reviewed order reservation',
            ?, ?, ?, NULL, NULL, ?,
            'ADMIN', ?, ?,
            b.on_hand, b.reserved, b.safety_stock
          FROM inventory_balances b
          WHERE b.variant_id = ?
            AND b.location_id = ?
            AND b.version = ?
            AND b.mutation_token = ?
            AND EXISTS (
              SELECT 1
              FROM inventory_reservations r
              WHERE r.id = ?
                AND r.mutation_token = ?
                AND r.state = 'ACTIVE'
            )`,
        )
        .bind(
          uid("imv"),
          requirement.requiredQuantity,
          orderId,
          plan.revisionId,
          reservationId,
          "reservation:" + reservationId + ":variant:" + requirement.variantId,
          actorEmail,
          createdAt,
          requirement.variantId,
          plan.locationId,
          requirement.balanceVersion + 1,
          balanceMutationToken,
          reservationId,
          reservationMutationToken,
        ),
    );
  }

  return {
    reservationId,
    reservationMutationToken,
    idempotencyKey,
    expiresAt: input.expiresAt,
    statements,
    balanceMutationTokens,
  };
}
