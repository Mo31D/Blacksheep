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
