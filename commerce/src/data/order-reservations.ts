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



export function rebaseReservationPlanAfterRelease(
  plan: RevisionReservationPlan,
  releasePlan: ActiveReservationReleasePlan | null,
): RevisionReservationPlan {
  if (!releasePlan || releasePlan.locationId !== plan.locationId) {
    return plan;
  }

  const releasedByVariant = new Map(
    releasePlan.requirements.map((requirement) => [
      requirement.variantId,
      requirement,
    ]),
  );

  const requirements = plan.requirements.map((requirement) => {
    const released = releasedByVariant.get(requirement.variantId);
    if (!released) return requirement;

    if (released.balanceVersion !== requirement.balanceVersion) {
      throw new Error("reservation_supersede_balance_version_mismatch");
    }

    const nextReserved = Math.max(
      0,
      requirement.reserved - released.quantity,
    );
    const nextAvailable = Math.max(
      0,
      requirement.onHand - nextReserved - requirement.safetyStock,
    );

    return {
      ...requirement,
      reserved: nextReserved,
      available: nextAvailable,
      balanceVersion: requirement.balanceVersion + 1,
    };
  });

  const sufficientByVariant = new Map(
    requirements.map((requirement) => [
      requirement.variantId,
      requirement.available >= requirement.requiredQuantity,
    ]),
  );

  const lines = plan.lines.map((line) => {
    if (!line.tracked || !line.variantId) return line;
    const released = releasedByVariant.get(line.variantId);
    const rebasedRequirement = requirements.find(
      (requirement) => requirement.variantId === line.variantId,
    );
    return {
      ...line,
      reserved:
        released && line.reserved !== null
          ? Math.max(0, line.reserved - released.quantity)
          : line.reserved,
      available: rebasedRequirement?.available ?? line.available,
      balanceVersion:
        rebasedRequirement?.balanceVersion ?? line.balanceVersion,
      sufficient:
        sufficientByVariant.get(line.variantId) !== false,
    };
  });

  return {
    ...plan,
    lines,
    trackedLines: lines.filter((line) => line.tracked),
    untrackedLines: lines.filter((line) => !line.tracked),
    requirements,
  };
}


export interface RevisionReservationAdminView {
  reservation: null | {
    id: string;
    state: string;
    expiresAt: string;
    committedAt: string | null;
    releasedAt: string | null;
    consumedAt: string | null;
    returnedAt: string | null;
    releaseReason: string | null;
  };
  lines: Array<
    ReservationLineAvailability & {
      reservationQuantity: number;
    }
  >;
}

export async function getRevisionReservationAdminView(
  db: D1DatabaseLike,
  revisionId: string,
  locationId = DEFAULT_RESERVATION_LOCATION_ID,
): Promise<RevisionReservationAdminView> {
  const plan = await buildRevisionReservationPlan(
    db,
    revisionId,
    locationId,
  );

  const reservation = await db
    .prepare(
      `SELECT
        id,
        state,
        expires_at AS expiresAt,
        committed_at AS committedAt,
        released_at AS releasedAt,
        consumed_at AS consumedAt,
        returned_at AS returnedAt,
        release_reason AS releaseReason
      FROM inventory_reservations
      WHERE revision_id = ?
      LIMIT 1`,
    )
    .bind(revisionId)
    .first<{
      id: string;
      state: string;
      expiresAt: string;
      committedAt: string | null;
      releasedAt: string | null;
      consumedAt: string | null;
      returnedAt: string | null;
      releaseReason: string | null;
    }>();

  const itemRows = reservation
    ? await allRows<{ revisionItemId: number; quantity: number }>(
        db
          .prepare(
            `SELECT
              revision_item_id AS revisionItemId,
              quantity
            FROM inventory_reservation_items
            WHERE reservation_id = ?
            ORDER BY id`,
          )
          .bind(reservation.id),
      )
    : [];

  const quantityByItem = new Map(
    itemRows.map((row) => [
      Number(row.revisionItemId),
      Number(row.quantity),
    ]),
  );

  return {
    reservation: reservation ?? null,
    lines: plan.lines.map((line) => ({
      ...line,
      reservationQuantity:
        quantityByItem.get(line.revisionItemId) ?? 0,
    })),
  };
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
            ?, ?, ?,
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


interface ReservationHoldRow {
  id: string;
  orderId: string;
  revisionId: string;
  locationId: string;
  state: "ACTIVE" | "COMMITTED";
  expiresAt: string;
  version: number;
  mutationToken: string;
}

interface ReservationReleaseRequirementRow {
  variantId: string;
  quantity: number;
  onHand: number | null;
  reserved: number | null;
  safetyStock: number | null;
  balanceVersion: number | null;
}

export interface ReservationReleaseRequirement {
  variantId: string;
  quantity: number;
  onHand: number;
  reserved: number;
  safetyStock: number;
  balanceVersion: number;
}

export interface ActiveReservationReleasePlan {
  reservationId: string;
  orderId: string;
  revisionId: string;
  locationId: string;
  expiresAt: string;
  version: number;
  mutationToken: string;
  requirements: ReservationReleaseRequirement[];
}

export interface ReservationExternalGuard {
  revisionId: string;
  version: number;
  mutationToken: string;
  state: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED";
}

export interface ReservationOrderGuard {
  orderId: string;
  status: string;
  paymentStatus: string;
  updatedAt: string;
}

export interface ReservationReleaseInput {
  actorEmail: string;
  actorType?: "ADMIN" | "CUSTOMER" | "SYSTEM";
  reason: string;
  sourceState?: "ACTIVE" | "COMMITTED";
  terminalState?: "RELEASED" | "EXPIRED";
  createdAt?: string;
  externalGuard?: ReservationExternalGuard;
  externalOrderGuard?: ReservationOrderGuard;
}

export interface PreparedReservationRelease {
  reservationId: string;
  releaseMutationToken: string;
  statements: D1PreparedStatementLike[];
  balanceMutationTokens: Record<string, string>;
}

async function activeReservationRowForRevision(
  db: D1DatabaseLike,
  revisionId: string,
): Promise<ReservationHoldRow | null> {
  return db
    .prepare(
      `SELECT
        id,
        order_id AS orderId,
        revision_id AS revisionId,
        location_id AS locationId,
        state,
        expires_at AS expiresAt,
        version,
        mutation_token AS mutationToken
      FROM inventory_reservations
      WHERE revision_id = ?
        AND state = 'ACTIVE'
      LIMIT 1`,
    )
    .bind(revisionId)
    .first<ReservationHoldRow>();
}

async function buildReleasePlanFromRow(
  db: D1DatabaseLike,
  reservation: ReservationHoldRow,
): Promise<ActiveReservationReleasePlan> {
  const rows = await allRows<ReservationReleaseRequirementRow>(
    db
      .prepare(
        `SELECT
          i.variant_id AS variantId,
          SUM(i.quantity) AS quantity,
          b.on_hand AS onHand,
          b.reserved AS reserved,
          b.safety_stock AS safetyStock,
          b.version AS balanceVersion
        FROM inventory_reservation_items i
        LEFT JOIN inventory_balances b
          ON b.variant_id = i.variant_id
          AND b.location_id = ?
        WHERE i.reservation_id = ?
        GROUP BY
          i.variant_id,
          b.on_hand,
          b.reserved,
          b.safety_stock,
          b.version
        ORDER BY i.variant_id`,
      )
      .bind(reservation.locationId, reservation.id),
  );

  const requirements = rows.map((row) => {
    if (
      row.balanceVersion === null ||
      row.onHand === null ||
      row.reserved === null ||
      row.safetyStock === null
    ) {
      throw new Error("reservation_release_balance_missing");
    }
    const quantity = Number(row.quantity);
    const reserved = Number(row.reserved);
    if (!Number.isInteger(quantity) || quantity <= 0 || reserved < quantity) {
      throw new Error("reservation_release_balance_invalid");
    }
    return {
      variantId: row.variantId,
      quantity,
      onHand: Number(row.onHand),
      reserved,
      safetyStock: Number(row.safetyStock),
      balanceVersion: Number(row.balanceVersion),
    };
  });

  return {
    reservationId: reservation.id,
    orderId: reservation.orderId,
    revisionId: reservation.revisionId,
    locationId: reservation.locationId,
    expiresAt: reservation.expiresAt,
    version: Number(reservation.version),
    mutationToken: reservation.mutationToken,
    requirements,
  };
}

export async function getActiveReservationReleasePlan(
  db: D1DatabaseLike,
  revisionId: string,
): Promise<ActiveReservationReleasePlan | null> {
  const reservation = await activeReservationRowForRevision(db, revisionId);
  return reservation ? buildReleasePlanFromRow(db, reservation) : null;
}

export async function getCommittedReservationPlan(
  db: D1DatabaseLike,
  revisionId: string,
): Promise<ActiveReservationReleasePlan | null> {
  const reservation = await db
    .prepare(
      `SELECT
        id,
        order_id AS orderId,
        revision_id AS revisionId,
        location_id AS locationId,
        state,
        expires_at AS expiresAt,
        version,
        mutation_token AS mutationToken
      FROM inventory_reservations
      WHERE revision_id = ?
        AND state = 'COMMITTED'
      LIMIT 1`,
    )
    .bind(revisionId)
    .first<ReservationHoldRow>();
  return reservation ? buildReleasePlanFromRow(db, reservation) : null;
}

export async function getSupersededReservationReleasePlan(
  db: D1DatabaseLike,
  orderId: string,
  excludeRevisionId: string,
): Promise<ActiveReservationReleasePlan | null> {
  const rows = await allRows<ReservationHoldRow>(
    db
      .prepare(
        `SELECT
          id,
          order_id AS orderId,
          revision_id AS revisionId,
          location_id AS locationId,
          state,
          expires_at AS expiresAt,
          version,
          mutation_token AS mutationToken
        FROM inventory_reservations
        WHERE order_id = ?
          AND revision_id <> ?
          AND state = 'ACTIVE'
        ORDER BY created_at DESC
        LIMIT 2`,
      )
      .bind(orderId, excludeRevisionId),
  );
  if (rows.length > 1) {
    throw new Error("reservation_multiple_active_for_order");
  }
  return rows[0] ? buildReleasePlanFromRow(db, rows[0]) : null;
}

function externalGuardSql(
  guard: ReservationExternalGuard | undefined,
): string {
  return guard
    ? `EXISTS (
        SELECT 1
        FROM order_revisions external_revision_guard
        WHERE external_revision_guard.id = ?
          AND external_revision_guard.version = ?
          AND external_revision_guard.mutation_token = ?
          AND external_revision_guard.state = ?
      )`
    : "1 = 1";
}

function externalGuardValues(
  guard: ReservationExternalGuard | undefined,
): unknown[] {
  return guard
    ? [
        guard.revisionId,
        guard.version,
        guard.mutationToken,
        guard.state,
      ]
    : [];
}

function orderGuardSql(
  guard: ReservationOrderGuard | undefined,
): string {
  return guard
    ? `EXISTS (
        SELECT 1
        FROM orders external_order_guard
        WHERE external_order_guard.id = ?
          AND external_order_guard.status = ?
          AND external_order_guard.payment_status = ?
          AND external_order_guard.updated_at = ?
      )`
    : "1 = 1";
}

function orderGuardValues(
  guard: ReservationOrderGuard | undefined,
): unknown[] {
  return guard
    ? [guard.orderId, guard.status, guard.paymentStatus, guard.updatedAt]
    : [];
}

export function prepareReservationReleaseMutation(
  db: D1DatabaseLike,
  plan: ActiveReservationReleasePlan,
  input: ReservationReleaseInput,
): PreparedReservationRelease {
  const actorEmail = requiredMutationText(
    input.actorEmail,
    "reservation_actor_required",
  );
  const actorType = input.actorType ?? "ADMIN";
  const sourceState = input.sourceState ?? "ACTIVE";
  const terminalState = input.terminalState ?? "RELEASED";
  const reason = requiredMutationText(
    input.reason,
    "reservation_release_reason_required",
  );
  if (reason.length > 240) {
    throw new Error("reservation_release_reason_too_long");
  }

  const createdAt = input.createdAt ?? new Date().toISOString();
  const releaseMutationToken = uid("rmut");
  const balanceMutationTokens: Record<string, string> = {};
  const statements: D1PreparedStatementLike[] = [];
  const extSql = externalGuardSql(input.externalGuard);
  const extValues = externalGuardValues(input.externalGuard);
  const orderSql = orderGuardSql(input.externalOrderGuard);
  const orderValues = orderGuardValues(input.externalOrderGuard);

  for (const requirement of plan.requirements) {
    const balanceMutationToken = uid("imut");
    balanceMutationTokens[requirement.variantId] = balanceMutationToken;
    statements.push(
      db
        .prepare(
          `UPDATE inventory_balances
          SET reserved = reserved - ?,
              version = version + 1,
              mutation_token = ?,
              updated_at = ?
          WHERE variant_id = ?
            AND location_id = ?
            AND version = ?
            AND reserved >= ?
            AND EXISTS (
              SELECT 1
              FROM inventory_reservations reservation_guard
              WHERE reservation_guard.id = ?
                AND reservation_guard.version = ?
                AND reservation_guard.mutation_token = ?
                AND reservation_guard.state = ?
            )
            AND ${extSql}
            AND ${orderSql}`,
        )
        .bind(
          requirement.quantity,
          balanceMutationToken,
          createdAt,
          requirement.variantId,
          plan.locationId,
          requirement.balanceVersion,
          requirement.quantity,
          plan.reservationId,
          plan.version,
          plan.mutationToken,
          sourceState,
          ...extValues,
          ...orderValues,
        ),
    );
  }

  const balanceGuardSql = plan.requirements.length
    ? plan.requirements
        .map(
          () =>
            `EXISTS (
              SELECT 1
              FROM inventory_balances release_balance_guard
              WHERE release_balance_guard.variant_id = ?
                AND release_balance_guard.location_id = ?
                AND release_balance_guard.version = ?
                AND release_balance_guard.mutation_token = ?
            )`,
        )
        .join(" AND ")
    : "1 = 1";
  const balanceGuardValues: unknown[] = [];
  for (const requirement of plan.requirements) {
    balanceGuardValues.push(
      requirement.variantId,
      plan.locationId,
      requirement.balanceVersion + 1,
      balanceMutationTokens[requirement.variantId],
    );
  }

  statements.push(
    db
      .prepare(
        `UPDATE inventory_reservations
        SET state = ?,
            released_at = ?,
            release_reason = ?,
            version = version + 1,
            mutation_token = CASE
              WHEN state = ?
                AND version = ?
                AND mutation_token = ?
                AND ${balanceGuardSql}
                AND ${extSql}
                AND ${orderSql}
              THEN ?
              ELSE NULL
            END,
            updated_at = ?
        WHERE id = ?`,
      )
      .bind(
        terminalState,
        createdAt,
        reason,
        sourceState,
        plan.version,
        plan.mutationToken,
        ...balanceGuardValues,
        ...extValues,
        ...orderValues,
        releaseMutationToken,
        createdAt,
        plan.reservationId,
      ),
  );

  for (const requirement of plan.requirements) {
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
            ?, b.variant_id, b.location_id, 'RESERVATION_RELEASE',
            0, ?, 0,
            'RESERVATION_RELEASE', ?,
            ?, ?, ?, NULL, NULL, ?,
            ?, ?, ?,
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
                AND r.state = ?
                AND r.mutation_token = ?
            )`,
        )
        .bind(
          uid("imv"),
          -requirement.quantity,
          reason,
          plan.orderId,
          plan.revisionId,
          plan.reservationId,
          "reservation-release:" +
            plan.reservationId +
            ":v" +
            plan.version +
            ":variant:" +
            requirement.variantId,
          actorType,
          actorEmail,
          createdAt,
          requirement.variantId,
          plan.locationId,
          requirement.balanceVersion + 1,
          balanceMutationTokens[requirement.variantId],
          plan.reservationId,
          terminalState,
          releaseMutationToken,
        ),
    );
  }

  return {
    reservationId: plan.reservationId,
    releaseMutationToken,
    statements,
    balanceMutationTokens,
  };
}



export interface ReservationCommitInput {
  actorEmail: string;
  createdAt?: string;
  externalOrderGuard: ReservationOrderGuard;
}

export interface PreparedReservationCommit {
  reservationId: string;
  commitMutationToken: string;
  statements: D1PreparedStatementLike[];
}

export function prepareReservationCommitMutation(
  db: D1DatabaseLike,
  plan: ActiveReservationReleasePlan,
  input: ReservationCommitInput,
): PreparedReservationCommit {
  requiredMutationText(input.actorEmail, "reservation_actor_required");
  const createdAt = input.createdAt ?? new Date().toISOString();
  const commitMutationToken = uid("rmut");
  const orderSql = orderGuardSql(input.externalOrderGuard);
  const orderValues = orderGuardValues(input.externalOrderGuard);

  const statement = db
    .prepare(
      `UPDATE inventory_reservations
      SET state = 'COMMITTED',
          committed_at = ?,
          version = version + 1,
          mutation_token = CASE
            WHEN state = 'ACTIVE'
              AND version = ?
              AND mutation_token = ?
              AND ${orderSql}
            THEN ?
            ELSE NULL
          END,
          updated_at = ?
      WHERE id = ?`,
    )
    .bind(
      createdAt,
      plan.version,
      plan.mutationToken,
      ...orderValues,
      commitMutationToken,
      createdAt,
      plan.reservationId,
    );

  return {
    reservationId: plan.reservationId,
    commitMutationToken,
    statements: [statement],
  };
}

export interface ReservationConsumeInput {
  actorEmail: string;
  createdAt?: string;
  externalOrderGuard: ReservationOrderGuard;
}

export interface PreparedReservationConsume {
  reservationId: string;
  consumeMutationToken: string;
  statements: D1PreparedStatementLike[];
  balanceMutationTokens: Record<string, string>;
}

export function prepareReservationConsumeMutation(
  db: D1DatabaseLike,
  plan: ActiveReservationReleasePlan,
  input: ReservationConsumeInput,
): PreparedReservationConsume {
  const actorEmail = requiredMutationText(
    input.actorEmail,
    "reservation_actor_required",
  );
  const createdAt = input.createdAt ?? new Date().toISOString();
  const consumeMutationToken = uid("rmut");
  const balanceMutationTokens: Record<string, string> = {};
  const statements: D1PreparedStatementLike[] = [];
  const orderSql = orderGuardSql(input.externalOrderGuard);
  const orderValues = orderGuardValues(input.externalOrderGuard);

  for (const requirement of plan.requirements) {
    const balanceMutationToken = uid("imut");
    balanceMutationTokens[requirement.variantId] = balanceMutationToken;
    statements.push(
      db
        .prepare(
          `UPDATE inventory_balances
          SET on_hand = on_hand - ?,
              reserved = reserved - ?,
              version = version + 1,
              mutation_token = ?,
              updated_at = ?
          WHERE variant_id = ?
            AND location_id = ?
            AND version = ?
            AND on_hand >= ?
            AND reserved >= ?
            AND EXISTS (
              SELECT 1
              FROM inventory_reservations reservation_guard
              WHERE reservation_guard.id = ?
                AND reservation_guard.version = ?
                AND reservation_guard.mutation_token = ?
                AND reservation_guard.state = 'COMMITTED'
            )
            AND ${orderSql}`,
        )
        .bind(
          requirement.quantity,
          requirement.quantity,
          balanceMutationToken,
          createdAt,
          requirement.variantId,
          plan.locationId,
          requirement.balanceVersion,
          requirement.quantity,
          requirement.quantity,
          plan.reservationId,
          plan.version,
          plan.mutationToken,
          ...orderValues,
        ),
    );
  }

  const balanceGuardSql = plan.requirements.length
    ? plan.requirements
        .map(
          () =>
            `EXISTS (
              SELECT 1
              FROM inventory_balances consume_balance_guard
              WHERE consume_balance_guard.variant_id = ?
                AND consume_balance_guard.location_id = ?
                AND consume_balance_guard.version = ?
                AND consume_balance_guard.mutation_token = ?
            )`,
        )
        .join(" AND ")
    : "1 = 1";
  const balanceGuardValues: unknown[] = [];
  for (const requirement of plan.requirements) {
    balanceGuardValues.push(
      requirement.variantId,
      plan.locationId,
      requirement.balanceVersion + 1,
      balanceMutationTokens[requirement.variantId],
    );
  }

  statements.push(
    db
      .prepare(
        `UPDATE inventory_reservations
        SET state = 'CONSUMED',
            consumed_at = ?,
            version = version + 1,
            mutation_token = CASE
              WHEN state = 'COMMITTED'
                AND version = ?
                AND mutation_token = ?
                AND ${balanceGuardSql}
                AND ${orderSql}
              THEN ?
              ELSE NULL
            END,
            updated_at = ?
        WHERE id = ?`,
      )
      .bind(
        createdAt,
        plan.version,
        plan.mutationToken,
        ...balanceGuardValues,
        ...orderValues,
        consumeMutationToken,
        createdAt,
        plan.reservationId,
      ),
  );

  for (const requirement of plan.requirements) {
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
            ?, b.variant_id, b.location_id, 'SALE',
            ?, ?, 0,
            'SALE', 'Order fulfilled',
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
                AND r.state = 'CONSUMED'
                AND r.mutation_token = ?
            )`,
        )
        .bind(
          uid("imv"),
          -requirement.quantity,
          -requirement.quantity,
          plan.orderId,
          plan.revisionId,
          plan.reservationId,
          "reservation-consume:" +
            plan.reservationId +
            ":v" +
            plan.version +
            ":variant:" +
            requirement.variantId,
          actorEmail,
          createdAt,
          requirement.variantId,
          plan.locationId,
          requirement.balanceVersion + 1,
          balanceMutationTokens[requirement.variantId],
          plan.reservationId,
          consumeMutationToken,
        ),
    );
  }

  return {
    reservationId: plan.reservationId,
    consumeMutationToken,
    statements,
    balanceMutationTokens,
  };
}


interface ConsumedReservationReturnRow {
  reservationId: string;
  orderId: string;
  revisionId: string;
  locationId: string;
  expiresAt: string;
  version: number;
  mutationToken: string;
  returnedAt: string | null;
  paymentStatus: string;
  orderUpdatedAt: string;
}

export interface ReturnToStockResult {
  reservationId: string;
  returnedAt: string;
  idempotentReplay: boolean;
}

async function buildConsumedReturnPlan(
  db: D1DatabaseLike,
  row: ConsumedReservationReturnRow,
): Promise<ActiveReservationReleasePlan> {
  const rows = await allRows<ReservationReleaseRequirementRow>(
    db
      .prepare(
        `SELECT
          i.variant_id AS variantId,
          SUM(i.quantity) AS quantity,
          b.on_hand AS onHand,
          b.reserved AS reserved,
          b.safety_stock AS safetyStock,
          b.version AS balanceVersion
        FROM inventory_reservation_items i
        LEFT JOIN inventory_balances b
          ON b.variant_id = i.variant_id
          AND b.location_id = ?
        WHERE i.reservation_id = ?
        GROUP BY
          i.variant_id,
          b.on_hand,
          b.reserved,
          b.safety_stock,
          b.version
        ORDER BY i.variant_id`,
      )
      .bind(row.locationId, row.reservationId),
  );

  const requirements = rows.map((item) => {
    if (
      item.balanceVersion === null ||
      item.onHand === null ||
      item.reserved === null ||
      item.safetyStock === null
    ) {
      throw new Error("return_to_stock_balance_missing");
    }
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("return_to_stock_quantity_invalid");
    }
    return {
      variantId: item.variantId,
      quantity,
      onHand: Number(item.onHand),
      reserved: Number(item.reserved),
      safetyStock: Number(item.safetyStock),
      balanceVersion: Number(item.balanceVersion),
    };
  });

  return {
    reservationId: row.reservationId,
    orderId: row.orderId,
    revisionId: row.revisionId,
    locationId: row.locationId,
    expiresAt: row.expiresAt,
    version: row.version,
    mutationToken: row.mutationToken,
    requirements,
  };
}

export async function returnConsumedReservationToStock(
  db: D1DatabaseLike,
  orderReference: string,
  actorEmail: string,
): Promise<ReturnToStockResult> {
  requiredMutationText(actorEmail, "reservation_actor_required");

  const row = await db
    .prepare(
      `SELECT
        r.id AS reservationId,
        r.order_id AS orderId,
        r.revision_id AS revisionId,
        r.location_id AS locationId,
        r.expires_at AS expiresAt,
        r.version,
        r.mutation_token AS mutationToken,
        r.returned_at AS returnedAt,
        o.payment_status AS paymentStatus,
        o.updated_at AS orderUpdatedAt
      FROM inventory_reservations r
      INNER JOIN orders o ON o.id = r.order_id
      WHERE o.public_reference = ?
        AND r.state = 'CONSUMED'
      ORDER BY r.consumed_at DESC
      LIMIT 1`,
    )
    .bind(orderReference)
    .first<ConsumedReservationReturnRow>();

  if (!row) throw new Error("return_to_stock_not_available");
  if (row.paymentStatus !== "REFUNDED") {
    throw new Error("return_to_stock_requires_refund");
  }
  if (row.returnedAt) {
    return {
      reservationId: row.reservationId,
      returnedAt: row.returnedAt,
      idempotentReplay: true,
    };
  }

  const plan = await buildConsumedReturnPlan(db, row);
  const now = new Date().toISOString();
  const returnMutationToken = uid("rmut");
  const balanceMutationTokens: Record<string, string> = {};
  const statements: D1PreparedStatementLike[] = [];

  for (const requirement of plan.requirements) {
    const balanceMutationToken = uid("imut");
    balanceMutationTokens[requirement.variantId] = balanceMutationToken;
    statements.push(
      db
        .prepare(
          `UPDATE inventory_balances
          SET on_hand = on_hand + ?,
              version = version + 1,
              mutation_token = ?,
              updated_at = ?
          WHERE variant_id = ?
            AND location_id = ?
            AND version = ?
            AND EXISTS (
              SELECT 1
              FROM inventory_reservations reservation_guard
              WHERE reservation_guard.id = ?
                AND reservation_guard.state = 'CONSUMED'
                AND reservation_guard.returned_at IS NULL
                AND reservation_guard.version = ?
                AND reservation_guard.mutation_token = ?
            )
            AND EXISTS (
              SELECT 1
              FROM orders order_guard
              WHERE order_guard.id = ?
                AND order_guard.payment_status = 'REFUNDED'
                AND order_guard.updated_at = ?
            )`,
        )
        .bind(
          requirement.quantity,
          balanceMutationToken,
          now,
          requirement.variantId,
          plan.locationId,
          requirement.balanceVersion,
          plan.reservationId,
          plan.version,
          plan.mutationToken,
          plan.orderId,
          row.orderUpdatedAt,
        ),
    );
  }

  const balanceGuardSql = plan.requirements.length
    ? plan.requirements
        .map(
          () =>
            `EXISTS (
              SELECT 1
              FROM inventory_balances return_balance_guard
              WHERE return_balance_guard.variant_id = ?
                AND return_balance_guard.location_id = ?
                AND return_balance_guard.version = ?
                AND return_balance_guard.mutation_token = ?
            )`,
        )
        .join(" AND ")
    : "1 = 1";
  const balanceGuardValues: unknown[] = [];
  for (const requirement of plan.requirements) {
    balanceGuardValues.push(
      requirement.variantId,
      plan.locationId,
      requirement.balanceVersion + 1,
      balanceMutationTokens[requirement.variantId],
    );
  }

  statements.push(
    db
      .prepare(
        `UPDATE inventory_reservations
        SET returned_at = ?,
            version = version + 1,
            mutation_token = CASE
              WHEN state = 'CONSUMED'
                AND returned_at IS NULL
                AND version = ?
                AND mutation_token = ?
                AND ${balanceGuardSql}
                AND EXISTS (
                  SELECT 1
                  FROM orders order_guard
                  WHERE order_guard.id = ?
                    AND order_guard.payment_status = 'REFUNDED'
                    AND order_guard.updated_at = ?
                )
              THEN ?
              ELSE NULL
            END,
            updated_at = ?
        WHERE id = ?`,
      )
      .bind(
        now,
        plan.version,
        plan.mutationToken,
        ...balanceGuardValues,
        plan.orderId,
        row.orderUpdatedAt,
        returnMutationToken,
        now,
        plan.reservationId,
      ),
  );

  for (const requirement of plan.requirements) {
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
            ?, b.variant_id, b.location_id, 'RETURN',
            ?, 0, 0,
            'CUSTOMER_RETURN', 'Refunded order returned to stock',
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
                AND r.state = 'CONSUMED'
                AND r.returned_at = ?
                AND r.mutation_token = ?
            )`,
        )
        .bind(
          uid("imv"),
          requirement.quantity,
          plan.orderId,
          plan.revisionId,
          plan.reservationId,
          "reservation-return:" +
            plan.reservationId +
            ":variant:" +
            requirement.variantId,
          actorEmail,
          now,
          requirement.variantId,
          plan.locationId,
          requirement.balanceVersion + 1,
          balanceMutationTokens[requirement.variantId],
          plan.reservationId,
          now,
          returnMutationToken,
        ),
    );
  }

  statements.push(
    db
      .prepare(
        `INSERT INTO order_events (
          order_id, event_type, from_status, to_status,
          actor_type, actor_id, note, metadata_json, created_at
        )
        SELECT ?, 'INVENTORY_RETURNED_TO_STOCK', NULL, NULL,
          'admin', ?, NULL, ?, ?
        WHERE EXISTS (
          SELECT 1
          FROM inventory_reservations
          WHERE id = ?
            AND returned_at = ?
            AND mutation_token = ?
        )`,
      )
      .bind(
        plan.orderId,
        actorEmail,
        JSON.stringify({
          reservationId: plan.reservationId,
          revisionId: plan.revisionId,
        }),
        now,
        plan.reservationId,
        now,
        returnMutationToken,
      ),
  );

  try {
    await db.batch(statements);
  } catch (cause) {
    const latest = await db
      .prepare(
        "SELECT returned_at AS returnedAt FROM inventory_reservations WHERE id = ? LIMIT 1",
      )
      .bind(plan.reservationId)
      .first<{ returnedAt: string | null }>();
    if (latest?.returnedAt) {
      return {
        reservationId: plan.reservationId,
        returnedAt: latest.returnedAt,
        idempotentReplay: true,
      };
    }
    throw cause;
  }

  const latest = await db
    .prepare(
      "SELECT returned_at AS returnedAt FROM inventory_reservations WHERE id = ? LIMIT 1",
    )
    .bind(plan.reservationId)
    .first<{ returnedAt: string | null }>();

  if (!latest?.returnedAt) {
    throw new Error("return_to_stock_conflict");
  }

  return {
    reservationId: plan.reservationId,
    returnedAt: latest.returnedAt,
    idempotentReplay: false,
  };
}

interface ExpiredReservationCandidate extends ReservationHoldRow {
  revisionVersion: number;
  revisionState: "SENT" | "ACCEPTED";
}

export interface ExpireReservationsOptions {
  now?: string;
  limit?: number;
}

export async function expireDueReservations(
  db: D1DatabaseLike,
  options: ExpireReservationsOptions = {},
): Promise<{ expired: number; skipped: number }> {
  const timestamp = options.now ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new Error("reservation_expiry_timestamp_invalid");
  }
  const limit = Math.max(1, Math.min(100, Number(options.limit) || 50));

  const candidates = await allRows<ExpiredReservationCandidate>(
    db
      .prepare(
        `SELECT
          r.id,
          r.order_id AS orderId,
          r.revision_id AS revisionId,
          r.location_id AS locationId,
          r.state,
          r.expires_at AS expiresAt,
          r.version,
          r.mutation_token AS mutationToken,
          rev.version AS revisionVersion,
          rev.state AS revisionState
        FROM inventory_reservations r
        INNER JOIN order_revisions rev ON rev.id = r.revision_id
        WHERE r.state = 'ACTIVE'
          AND r.expires_at <= ?
          AND rev.state IN ('SENT','ACCEPTED')
        ORDER BY r.expires_at ASC, r.id ASC
        LIMIT ?`,
      )
      .bind(timestamp, limit),
  );

  let expired = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const plan = await buildReleasePlanFromRow(db, candidate);
    const nextRevisionVersion = Number(candidate.revisionVersion) + 1;
    const revisionMutationToken = uid("rmut");
    const statements: D1PreparedStatementLike[] = [
      db
        .prepare(
          `UPDATE order_revisions
          SET state = 'EXPIRED',
              version = ?,
              mutation_token = ?
          WHERE id = ?
            AND version = ?
            AND state = ?`,
        )
        .bind(
          nextRevisionVersion,
          revisionMutationToken,
          candidate.revisionId,
          candidate.revisionVersion,
          candidate.revisionState,
        ),
    ];

    const release = prepareReservationReleaseMutation(db, plan, {
      actorEmail: "reservation-expiry",
      actorType: "SYSTEM",
      reason: "Reservation expired",
      terminalState: "EXPIRED",
      createdAt: timestamp,
      externalGuard: {
        revisionId: candidate.revisionId,
        version: nextRevisionVersion,
        mutationToken: revisionMutationToken,
        state: "EXPIRED",
      },
    });
    statements.push(...release.statements);

    statements.push(
      db
        .prepare(
          `UPDATE orders
          SET status = 'UNDER_REVIEW',
              payment_status = CASE
                WHEN payment_status = 'PAYMENT_REQUESTED' THEN 'UNPAID'
                ELSE payment_status
              END,
              payment_request_url = CASE
                WHEN payment_status = 'PAYMENT_REQUESTED' THEN NULL
                ELSE payment_request_url
              END,
              payment_reference = CASE
                WHEN payment_status = 'PAYMENT_REQUESTED' THEN NULL
                ELSE payment_reference
              END,
              updated_at = ?
          WHERE id = ?
            AND payment_status IN ('UNPAID','PAYMENT_REQUESTED')
            AND EXISTS (
              SELECT 1
              FROM order_revisions
              WHERE id = ?
                AND version = ?
                AND mutation_token = ?
                AND state = 'EXPIRED'
            )`,
        )
        .bind(
          timestamp,
          candidate.orderId,
          candidate.revisionId,
          nextRevisionVersion,
          revisionMutationToken,
        ),
      db
        .prepare(
          `UPDATE customer_review_tokens
          SET revoked_at = COALESCE(revoked_at, ?)
          WHERE revision_id = ?
            AND EXISTS (
              SELECT 1
              FROM order_revisions
              WHERE id = ?
                AND version = ?
                AND mutation_token = ?
                AND state = 'EXPIRED'
            )`,
        )
        .bind(
          timestamp,
          candidate.revisionId,
          candidate.revisionId,
          nextRevisionVersion,
          revisionMutationToken,
        ),
      db
        .prepare(
          `INSERT INTO order_events (
            order_id, event_type, from_status, to_status,
            actor_type, actor_id, note, metadata_json, created_at
          )
          SELECT ?, 'ORDER_REVISION_EXPIRED', NULL, 'UNDER_REVIEW',
            'system', 'reservation-expiry', NULL, ?, ?
          WHERE EXISTS (
            SELECT 1
            FROM order_revisions
            WHERE id = ?
              AND version = ?
              AND mutation_token = ?
              AND state = 'EXPIRED'
          )`,
        )
        .bind(
          candidate.orderId,
          JSON.stringify({
            revisionId: candidate.revisionId,
            reservationId: candidate.id,
            expiresAt: candidate.expiresAt,
          }),
          timestamp,
          candidate.revisionId,
          nextRevisionVersion,
          revisionMutationToken,
        ),
    );

    try {
      await db.batch(statements);
    } catch (cause) {
      const latest = await db
        .prepare(
          "SELECT state FROM inventory_reservations WHERE id = ? LIMIT 1",
        )
        .bind(candidate.id)
        .first<{ state: string }>();
      if (latest && latest.state !== "ACTIVE") {
        skipped += 1;
        continue;
      }
      throw cause;
    }

    const latest = await db
      .prepare(
        "SELECT state FROM inventory_reservations WHERE id = ? LIMIT 1",
      )
      .bind(candidate.id)
      .first<{ state: string }>();

    if (latest?.state === "EXPIRED") {
      expired += 1;
    } else if (latest && latest.state !== "ACTIVE") {
      skipped += 1;
    } else {
      throw new Error("reservation_expiry_conflict");
    }
  }

  return { expired, skipped };
}
