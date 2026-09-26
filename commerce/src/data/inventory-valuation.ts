import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1";

export const DEFAULT_VAT_RATE_BASIS_POINTS = 2000;
export const DEFAULT_RETAIL_MULTIPLIER = 2;
export const DEFAULT_VALUATION_LOCATION_ID = "loc_ambleside";

function uid(prefix: string): string {
  return prefix + "_" + crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

async function allRows<T>(statement: D1PreparedStatementLike): Promise<T[]> {
  if (!statement.all) throw new Error("database_all_unavailable");
  return (await statement.all<T>()).results ?? [];
}

function whole(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function validVatBasisPoints(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 10_000) {
    throw new Error("product_vat_rate_invalid");
  }
  return n;
}

export function estimateCostFromRetail(
  retailMinor: number | null,
  vatRateBasisPoints = DEFAULT_VAT_RATE_BASIS_POINTS,
): {
  costIncVatMinor: number | null;
  costExVatMinor: number | null;
} {
  if (retailMinor === null || !Number.isFinite(retailMinor) || retailMinor < 0) {
    return { costIncVatMinor: null, costExVatMinor: null };
  }
  const vat = validVatBasisPoints(vatRateBasisPoints);
  const costIncVatMinor = Math.round(retailMinor / DEFAULT_RETAIL_MULTIPLIER);
  const costExVatMinor = Math.round(
    (costIncVatMinor * 10_000) / (10_000 + vat),
  );
  return { costIncVatMinor, costExVatMinor };
}

export function costIncludingVat(
  costExVatMinor: number | null,
  vatRateBasisPoints = DEFAULT_VAT_RATE_BASIS_POINTS,
): number | null {
  if (
    costExVatMinor === null ||
    !Number.isFinite(costExVatMinor) ||
    costExVatMinor < 0
  ) {
    return null;
  }
  const vat = validVatBasisPoints(vatRateBasisPoints);
  return Math.round((costExVatMinor * (10_000 + vat)) / 10_000);
}

export function retailExcludingVat(
  retailIncVatMinor: number | null,
  vatRateBasisPoints = DEFAULT_VAT_RATE_BASIS_POINTS,
): number | null {
  if (
    retailIncVatMinor === null ||
    !Number.isFinite(retailIncVatMinor) ||
    retailIncVatMinor < 0
  ) {
    return null;
  }
  const vat = validVatBasisPoints(vatRateBasisPoints);
  return Math.round((retailIncVatMinor * 10_000) / (10_000 + vat));
}

export interface AdminSupplier {
  id: string;
  name: string;
  active: boolean;
}

export async function listAdminSuppliers(
  db: D1DatabaseLike,
): Promise<AdminSupplier[]> {
  const rows = await allRows<{ id: string; name: string; active: number }>(
    db.prepare(
      "SELECT id, name, active FROM suppliers WHERE active = 1 ORDER BY name COLLATE NOCASE",
    ),
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    active: Number(row.active) === 1,
  }));
}

export async function resolveAdminSupplier(
  db: D1DatabaseLike,
  value: unknown,
): Promise<{ id: string; name: string } | null> {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }
  const name = String(value).trim();
  if (name.length > 160) throw new Error("product_supplier_name_too_long");

  const existing = await db
    .prepare(
      "SELECT id, name FROM suppliers WHERE lower(name) = lower(?) LIMIT 1",
    )
    .bind(name)
    .first<{ id: string; name: string }>();
  if (existing) return existing;

  const id = uid("sup");
  const timestamp = now();
  try {
    await db
      .prepare(
        "INSERT INTO suppliers (id, name, active, created_at, updated_at) VALUES (?, ?, 1, ?, ?)",
      )
      .bind(id, name, timestamp, timestamp)
      .run();
    return { id, name };
  } catch (cause) {
    const raced = await db
      .prepare(
        "SELECT id, name FROM suppliers WHERE lower(name) = lower(?) LIMIT 1",
      )
      .bind(name)
      .first<{ id: string; name: string }>();
    if (raced) return raced;
    throw cause;
  }
}

interface ValuationRow {
  productId: string;
  variantId: string;
  title: string;
  sku: string | null;
  priceMinor: number | null;
  costMinor: number | null;
  vatRateBasisPoints: number | null;
  supplierId: string | null;
  supplierName: string | null;
  supplierProductCode: string | null;
  categoryName: string | null;
  trackInventory: number;
  lowStockThreshold: number | null;
  onHand: number | null;
  reserved: number | null;
  safetyStock: number | null;
  incoming: number;
}

export interface StockValuationLine {
  productId: string;
  variantId: string;
  title: string;
  sku: string | null;
  supplierId: string | null;
  supplierName: string;
  categoryName: string;
  onHand: number;
  reserved: number;
  safetyStock: number;
  available: number;
  incoming: number;
  priceMinor: number | null;
  vatRateBasisPoints: number;
  costSource: "ACTUAL" | "ESTIMATED" | "MISSING";
  unitCostExVatMinor: number | null;
  unitCostIncVatMinor: number | null;
  retailExVatMinor: number | null;
  costValueExVatMinor: number;
  costValueIncVatMinor: number;
  retailValueIncVatMinor: number;
  retailValueExVatMinor: number;
  reservedRetailValueMinor: number;
  sellableRetailValueMinor: number;
  potentialGrossProfitMinor: number;
  low: boolean;
  out: boolean;
}

function lineFromRow(row: ValuationRow): StockValuationLine {
  const tracked = Number(row.trackInventory) === 1;
  const onHand = tracked ? whole(row.onHand) : 0;
  const reserved = tracked ? whole(row.reserved) : 0;
  const safetyStock = tracked ? whole(row.safetyStock) : 0;
  const available = Math.max(0, onHand - reserved - safetyStock);
  const vatRateBasisPoints =
    row.vatRateBasisPoints === null || row.vatRateBasisPoints === undefined
      ? DEFAULT_VAT_RATE_BASIS_POINTS
      : validVatBasisPoints(row.vatRateBasisPoints);
  const priceMinor =
    row.priceMinor === null || row.priceMinor === undefined
      ? null
      : whole(row.priceMinor);
  const actualCost =
    row.costMinor === null || row.costMinor === undefined
      ? null
      : whole(row.costMinor);
  const estimated =
    actualCost === null
      ? estimateCostFromRetail(priceMinor, vatRateBasisPoints)
      : { costIncVatMinor: null, costExVatMinor: null };
  const unitCostExVatMinor =
    actualCost === null ? estimated.costExVatMinor : actualCost;
  const unitCostIncVatMinor =
    actualCost === null
      ? estimated.costIncVatMinor
      : costIncludingVat(actualCost, vatRateBasisPoints);
  const retailExVatMinor = retailExcludingVat(
    priceMinor,
    vatRateBasisPoints,
  );
  const costSource =
    actualCost !== null
      ? "ACTUAL"
      : unitCostExVatMinor !== null
        ? "ESTIMATED"
        : "MISSING";

  const costValueExVatMinor = (unitCostExVatMinor ?? 0) * onHand;
  const costValueIncVatMinor = (unitCostIncVatMinor ?? 0) * onHand;
  const retailValueIncVatMinor = (priceMinor ?? 0) * onHand;
  const retailValueExVatMinor = (retailExVatMinor ?? 0) * onHand;
  const reservedRetailValueMinor = (priceMinor ?? 0) * reserved;
  const sellableRetailValueMinor = (priceMinor ?? 0) * available;
  const potentialGrossProfitMinor =
    retailValueExVatMinor - costValueExVatMinor;
  const threshold =
    row.lowStockThreshold === null ? null : whole(row.lowStockThreshold);

  return {
    productId: row.productId,
    variantId: row.variantId,
    title: row.title,
    sku: row.sku,
    supplierId: row.supplierId,
    supplierName: row.supplierName || "Unassigned",
    categoryName: row.categoryName || "Uncategorised",
    onHand,
    reserved,
    safetyStock,
    available,
    incoming: whole(row.incoming),
    priceMinor,
    vatRateBasisPoints,
    costSource,
    unitCostExVatMinor,
    unitCostIncVatMinor,
    retailExVatMinor,
    costValueExVatMinor,
    costValueIncVatMinor,
    retailValueIncVatMinor,
    retailValueExVatMinor,
    reservedRetailValueMinor,
    sellableRetailValueMinor,
    potentialGrossProfitMinor,
    low:
      tracked &&
      available > 0 &&
      threshold !== null &&
      available <= threshold,
    out: tracked && available <= 0,
  };
}

async function valuationRows(
  db: D1DatabaseLike,
  locationId: string,
): Promise<{ lines: StockValuationLine[]; totalVariants: number; untrackedVariants: number }> {
  const rows = await allRows<ValuationRow>(
    db
      .prepare(
        `SELECT
          p.id AS productId,
          v.id AS variantId,
          pv.title,
          v.sku,
          v.price_minor AS priceMinor,
          v.cost_minor AS costMinor,
          v.vat_rate_basis_points AS vatRateBasisPoints,
          v.supplier_id AS supplierId,
          s.name AS supplierName,
          v.supplier_product_code AS supplierProductCode,
          (
            SELECT c.name
            FROM product_version_categories pvc
            JOIN categories c ON c.id = pvc.category_id
            WHERE pvc.product_version_id = pv.id
            ORDER BY pvc.is_primary DESC, pvc.position ASC, c.name COLLATE NOCASE
            LIMIT 1
          ) AS categoryName,
          v.track_inventory AS trackInventory,
          v.low_stock_threshold AS lowStockThreshold,
          b.on_hand AS onHand,
          b.reserved,
          b.safety_stock AS safetyStock,
          COALESCE((
            SELECT SUM(ii.expected_quantity - ii.received_quantity)
            FROM inventory_incoming ii
            WHERE ii.variant_id = v.id
              AND ii.location_id = ?
              AND ii.status IN ('OPEN','PARTIAL')
          ),0) AS incoming
        FROM product_variants v
        JOIN products p ON p.id = v.product_id
        JOIN product_versions pv
          ON pv.id = COALESCE(p.current_draft_version_id, p.current_published_version_id)
        LEFT JOIN inventory_balances b
          ON b.variant_id = v.id AND b.location_id = ?
        LEFT JOIN suppliers s ON s.id = v.supplier_id
        WHERE v.active = 1
          AND p.publication_status <> 'ARCHIVED'
        ORDER BY pv.title COLLATE NOCASE, v.id`,
      )
      .bind(locationId, locationId),
  );

  const totalVariants = rows.length;
  const untrackedVariants = rows.filter(
    (row) => Number(row.trackInventory) !== 1,
  ).length;
  return {
    lines: rows
      .filter((row) => Number(row.trackInventory) === 1)
      .map(lineFromRow),
    totalVariants,
    untrackedVariants,
  };
}

function aggregateBreakdown(
  lines: StockValuationLine[],
  key: (line: StockValuationLine) => { id: string | null; name: string },
): Array<Record<string, unknown>> {
  const groups = new Map<
    string,
    {
      id: string | null;
      name: string;
      products: Set<string>;
      units: number;
      costValueExVatMinor: number;
      costValueIncVatMinor: number;
      retailValueMinor: number;
      potentialGrossProfitMinor: number;
    }
  >();

  for (const line of lines) {
    const groupKey = key(line);
    const mapKey = (groupKey.id ?? "") + "::" + groupKey.name;
    const current =
      groups.get(mapKey) ?? {
        id: groupKey.id,
        name: groupKey.name,
        products: new Set<string>(),
        units: 0,
        costValueExVatMinor: 0,
        costValueIncVatMinor: 0,
        retailValueMinor: 0,
        potentialGrossProfitMinor: 0,
      };
    current.products.add(line.productId);
    current.units += line.onHand;
    current.costValueExVatMinor += line.costValueExVatMinor;
    current.costValueIncVatMinor += line.costValueIncVatMinor;
    current.retailValueMinor += line.retailValueIncVatMinor;
    current.potentialGrossProfitMinor += line.potentialGrossProfitMinor;
    groups.set(mapKey, current);
  }

  return Array.from(groups.values())
    .map((group) => ({
      id: group.id,
      name: group.name,
      productCount: group.products.size,
      units: group.units,
      costValueExVatMinor: group.costValueExVatMinor,
      costValueIncVatMinor: group.costValueIncVatMinor,
      retailValueMinor: group.retailValueMinor,
      potentialGrossProfitMinor: group.potentialGrossProfitMinor,
    }))
    .sort(
      (a, b) =>
        Number(b.costValueIncVatMinor) - Number(a.costValueIncVatMinor) ||
        String(a.name).localeCompare(String(b.name)),
    );
}

function normaliseDays(value: number): number {
  return new Set([7, 30, 90, 365]).has(value) ? value : 90;
}

export async function getAdminStockValuation(
  db: D1DatabaseLike,
  options: { locationId?: string; days?: number } = {},
): Promise<Record<string, unknown>> {
  const locationId = options.locationId || DEFAULT_VALUATION_LOCATION_ID;
  const days = normaliseDays(Number(options.days ?? 90));
  const { lines, totalVariants, untrackedVariants } = await valuationRows(
    db,
    locationId,
  );

  const summary = {
    totalVariants,
    trackedVariants: lines.length,
    untrackedVariants,
    onHandUnits: 0,
    reservedUnits: 0,
    sellableUnits: 0,
    incomingUnits: 0,
    costValueExVatMinor: 0,
    costValueIncVatMinor: 0,
    retailValueIncVatMinor: 0,
    retailValueExVatMinor: 0,
    reservedRetailValueMinor: 0,
    sellableRetailValueMinor: 0,
    potentialGrossProfitMinor: 0,
    actualCostVariants: 0,
    estimatedCostVariants: 0,
    missingValuationVariants: 0,
    lowStockVariants: 0,
    outOfStockVariants: 0,
  };

  for (const line of lines) {
    summary.onHandUnits += line.onHand;
    summary.reservedUnits += line.reserved;
    summary.sellableUnits += line.available;
    summary.incomingUnits += line.incoming;
    summary.costValueExVatMinor += line.costValueExVatMinor;
    summary.costValueIncVatMinor += line.costValueIncVatMinor;
    summary.retailValueIncVatMinor += line.retailValueIncVatMinor;
    summary.retailValueExVatMinor += line.retailValueExVatMinor;
    summary.reservedRetailValueMinor += line.reservedRetailValueMinor;
    summary.sellableRetailValueMinor += line.sellableRetailValueMinor;
    summary.potentialGrossProfitMinor += line.potentialGrossProfitMinor;
    if (line.costSource === "ACTUAL") summary.actualCostVariants += 1;
    if (line.costSource === "ESTIMATED") summary.estimatedCostVariants += 1;
    if (line.costSource === "MISSING") summary.missingValuationVariants += 1;
    if (line.low) summary.lowStockVariants += 1;
    if (line.out) summary.outOfStockVariants += 1;
  }

  const trackedCoverage =
    totalVariants > 0
      ? Math.round((summary.trackedVariants / totalVariants) * 1000) / 10
      : 0;
  const costCoverage =
    lines.length > 0
      ? Math.round(
          ((summary.actualCostVariants + summary.estimatedCostVariants) /
            lines.length) *
            1000,
        ) / 10
      : 0;
  const actualCostCoverage =
    lines.length > 0
      ? Math.round((summary.actualCostVariants / lines.length) * 1000) / 10
      : 0;

  const since = new Date(Date.now() - (days - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const trend = await allRows<Record<string, unknown>>(
    db
      .prepare(
        `SELECT snapshot_date AS day,
          on_hand_units AS onHandUnits,
          cost_value_ex_vat_minor AS costValueExVatMinor,
          cost_value_inc_vat_minor AS costValueIncVatMinor,
          retail_value_inc_vat_minor AS retailValueMinor,
          sellable_retail_value_minor AS sellableRetailValueMinor,
          potential_gross_profit_minor AS potentialGrossProfitMinor
        FROM inventory_valuation_snapshots
        WHERE location_id = ? AND snapshot_date >= ?
        ORDER BY snapshot_date ASC`,
      )
      .bind(locationId, since),
  );

  const supplierBreakdown = aggregateBreakdown(lines, (line) => ({
    id: line.supplierId,
    name: line.supplierName,
  }));
  const categoryBreakdown = aggregateBreakdown(lines, (line) => ({
    id: line.categoryName,
    name: line.categoryName,
  }));

  const topProducts = [...lines]
    .filter((line) => line.onHand > 0)
    .sort(
      (a, b) =>
        b.costValueIncVatMinor - a.costValueIncVatMinor ||
        b.retailValueIncVatMinor - a.retailValueIncVatMinor,
    )
    .slice(0, 20)
    .map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      title: line.title,
      sku: line.sku,
      supplierName: line.supplierName,
      onHand: line.onHand,
      costSource: line.costSource,
      unitCostExVatMinor: line.unitCostExVatMinor,
      costValueIncVatMinor: line.costValueIncVatMinor,
      retailValueMinor: line.retailValueIncVatMinor,
    }));

  return {
    generatedAt: now(),
    locationId,
    days,
    policy: {
      retailMultiplier: DEFAULT_RETAIL_MULTIPLIER,
      defaultVatRateBasisPoints: DEFAULT_VAT_RATE_BASIS_POINTS,
      actualCostField: "cost_minor_ex_vat",
      estimatedFormula:
        "costIncVat = retailIncVat / 2; costExVat = costIncVat / (1 + VAT rate)",
    },
    summary: {
      ...summary,
      trackedCoverage,
      costCoverage,
      actualCostCoverage,
    },
    supplierBreakdown,
    categoryBreakdown,
    topProducts,
    trend: trend.map((row) => ({
      day: row.day,
      onHandUnits: whole(row.onHandUnits),
      costValueExVatMinor: whole(row.costValueExVatMinor),
      costValueIncVatMinor: whole(row.costValueIncVatMinor),
      retailValueMinor: whole(row.retailValueMinor),
      sellableRetailValueMinor: whole(row.sellableRetailValueMinor),
      potentialGrossProfitMinor: whole(row.potentialGrossProfitMinor),
    })),
  };
}

export async function captureAdminStockValuationSnapshot(
  db: D1DatabaseLike,
  options: { locationId?: string; days?: number } = {},
): Promise<Record<string, unknown>> {
  const locationId = options.locationId || DEFAULT_VALUATION_LOCATION_ID;
  const report = await getAdminStockValuation(db, options);
  const summary = report.summary as Record<string, unknown>;
  const timestamp = now();
  const day = timestamp.slice(0, 10);

  await db
    .prepare(
      `INSERT INTO inventory_valuation_snapshots (
        id, snapshot_date, location_id,
        on_hand_units, reserved_units, sellable_units,
        cost_value_ex_vat_minor, cost_value_inc_vat_minor,
        retail_value_inc_vat_minor, retail_value_ex_vat_minor,
        reserved_retail_value_minor, sellable_retail_value_minor,
        potential_gross_profit_minor, tracked_variants,
        actual_cost_variants, estimated_cost_variants,
        missing_valuation_variants, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(snapshot_date, location_id) DO UPDATE SET
        on_hand_units = excluded.on_hand_units,
        reserved_units = excluded.reserved_units,
        sellable_units = excluded.sellable_units,
        cost_value_ex_vat_minor = excluded.cost_value_ex_vat_minor,
        cost_value_inc_vat_minor = excluded.cost_value_inc_vat_minor,
        retail_value_inc_vat_minor = excluded.retail_value_inc_vat_minor,
        retail_value_ex_vat_minor = excluded.retail_value_ex_vat_minor,
        reserved_retail_value_minor = excluded.reserved_retail_value_minor,
        sellable_retail_value_minor = excluded.sellable_retail_value_minor,
        potential_gross_profit_minor = excluded.potential_gross_profit_minor,
        tracked_variants = excluded.tracked_variants,
        actual_cost_variants = excluded.actual_cost_variants,
        estimated_cost_variants = excluded.estimated_cost_variants,
        missing_valuation_variants = excluded.missing_valuation_variants,
        updated_at = excluded.updated_at`,
    )
    .bind(
      uid("ivs"),
      day,
      locationId,
      whole(summary.onHandUnits),
      whole(summary.reservedUnits),
      whole(summary.sellableUnits),
      whole(summary.costValueExVatMinor),
      whole(summary.costValueIncVatMinor),
      whole(summary.retailValueIncVatMinor),
      whole(summary.retailValueExVatMinor),
      whole(summary.reservedRetailValueMinor),
      whole(summary.sellableRetailValueMinor),
      whole(summary.potentialGrossProfitMinor),
      whole(summary.trackedVariants),
      whole(summary.actualCostVariants),
      whole(summary.estimatedCostVariants),
      whole(summary.missingValuationVariants),
      timestamp,
      timestamp,
    )
    .run();

  return getAdminStockValuation(db, options);
}
