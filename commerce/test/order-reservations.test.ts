import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import {
  assertReservationAvailability,
  buildRevisionReservationPlan,
  ReservationAvailabilityError,
} from "../src/data/order-reservations";

class Statement implements D1PreparedStatementLike {
  values: unknown[] = [];

  constructor(
    public readonly sql: string,
    private readonly firstValue: unknown = null,
    private readonly rows: unknown[] = [],
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    return (this.firstValue as T | null) ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.rows as T[] };
  }

  async run(): Promise<unknown> {
    return {};
  }
}

class ReservationPlanDb implements D1DatabaseLike {
  readonly prepared: Statement[] = [];

  constructor(private readonly rows: unknown[]) {}

  prepare(query: string): Statement {
    const statement = query.includes("FROM inventory_locations")
      ? new Statement(query, { id: "loc_ambleside" })
      : query.includes("FROM order_revision_items ri")
        ? new Statement(query, null, this.rows)
        : new Statement(query);
    this.prepared.push(statement);
    return statement;
  }

  async batch<T>(): Promise<T[]> {
    return [] as T[];
  }
}

describe("Phase 5 reservation planning", () => {
  it("resolves Product Core by legacy id then Product UUID without SKU fuzzy matching", async () => {
    const db = new ReservationPlanDb([
      {
        revisionItemId: 11,
        lineNumber: 1,
        catalogProductId: "LEGACY-1",
        confirmedQuantity: 1,
        productId: "prd-1",
        variantId: "var-1",
        trackInventory: 1,
        onHand: 5,
        reserved: 1,
        safetyStock: 1,
        balanceVersion: 4,
      },
    ]);

    const plan = await buildRevisionReservationPlan(db, "rev-1");

    expect(plan.trackedLines).toHaveLength(1);
    expect(plan.requirements).toEqual([
      {
        variantId: "var-1",
        requiredQuantity: 1,
        onHand: 5,
        reserved: 1,
        safetyStock: 1,
        available: 3,
        balanceVersion: 4,
      },
    ]);

    const resolution = db.prepared.find((entry) =>
      entry.sql.includes("FROM order_revision_items ri"),
    );
    expect(resolution?.sql).toContain(
      "legacy_match.legacy_catalog_id = ri.catalog_product_id",
    );
    expect(resolution?.sql).toContain(
      "uuid_match.id = ri.catalog_product_id",
    );
    expect(resolution?.sql).not.toContain("v.sku = ri.sku");
    expect(resolution?.values).toEqual(["loc_ambleside", "rev-1"]);
  });

  it("keeps unresolved or untracked revision lines on current behaviour", async () => {
    const db = new ReservationPlanDb([
      {
        revisionItemId: 12,
        lineNumber: 1,
        catalogProductId: "LEGACY-UNRESOLVED",
        confirmedQuantity: 2,
        productId: null,
        variantId: null,
        trackInventory: null,
        onHand: null,
        reserved: null,
        safetyStock: null,
        balanceVersion: null,
      },
      {
        revisionItemId: 13,
        lineNumber: 2,
        catalogProductId: "LEGACY-UNTRACKED",
        confirmedQuantity: 1,
        productId: "prd-2",
        variantId: "var-2",
        trackInventory: 0,
        onHand: null,
        reserved: null,
        safetyStock: null,
        balanceVersion: null,
      },
    ]);

    const plan = await buildRevisionReservationPlan(db, "rev-2");

    expect(plan.trackedLines).toHaveLength(0);
    expect(plan.untrackedLines).toHaveLength(2);
    expect(plan.requirements).toHaveLength(0);
    expect(plan.lines[0]).toMatchObject({
      resolved: false,
      tracked: false,
      sufficient: true,
    });
    expect(plan.lines[1]).toMatchObject({
      resolved: true,
      tracked: false,
      sufficient: true,
    });
    expect(() => assertReservationAvailability(plan)).not.toThrow();
  });

  it("aggregates multiple reviewed lines that resolve to the same tracked variant", async () => {
    const rows = [1, 2].map((lineNumber) => ({
      revisionItemId: 20 + lineNumber,
      lineNumber,
      catalogProductId: "LEGACY-SAME-" + lineNumber,
      confirmedQuantity: 2,
      productId: "prd-shared",
      variantId: "var-shared",
      trackInventory: 1,
      onHand: 5,
      reserved: 1,
      safetyStock: 0,
      balanceVersion: 7,
    }));
    const db = new ReservationPlanDb(rows);

    const plan = await buildRevisionReservationPlan(db, "rev-shared");

    expect(plan.requirements).toEqual([
      {
        variantId: "var-shared",
        requiredQuantity: 4,
        onHand: 5,
        reserved: 1,
        safetyStock: 0,
        available: 4,
        balanceVersion: 7,
      },
    ]);
    expect(plan.lines.every((line) => line.sufficient)).toBe(true);
  });

  it("reports aggregate insufficient stock with exact required and available quantities", async () => {
    const db = new ReservationPlanDb([
      {
        revisionItemId: 31,
        lineNumber: 1,
        catalogProductId: "LEGACY-LOW-1",
        confirmedQuantity: 2,
        productId: "prd-low",
        variantId: "var-low",
        trackInventory: 1,
        onHand: 3,
        reserved: 0,
        safetyStock: 0,
        balanceVersion: 2,
      },
      {
        revisionItemId: 32,
        lineNumber: 2,
        catalogProductId: "LEGACY-LOW-2",
        confirmedQuantity: 2,
        productId: "prd-low",
        variantId: "var-low",
        trackInventory: 1,
        onHand: 3,
        reserved: 0,
        safetyStock: 0,
        balanceVersion: 2,
      },
    ]);

    const plan = await buildRevisionReservationPlan(db, "rev-low");

    expect(plan.lines.every((line) => line.sufficient === false)).toBe(true);

    try {
      assertReservationAvailability(plan);
      throw new Error("expected reservation availability failure");
    } catch (error) {
      expect(error).toBeInstanceOf(ReservationAvailabilityError);
      expect((error as ReservationAvailabilityError).message).toBe(
        "reservation_insufficient_stock",
      );
      expect((error as ReservationAvailabilityError).conflicts).toEqual([
        {
          variantId: "var-low",
          requiredQuantity: 4,
          available: 3,
        },
      ]);
    }
  });

  it("treats a tracked variant without a balance as an integrity error", async () => {
    const db = new ReservationPlanDb([
      {
        revisionItemId: 41,
        lineNumber: 1,
        catalogProductId: "LEGACY-MISSING-BALANCE",
        confirmedQuantity: 1,
        productId: "prd-missing",
        variantId: "var-missing",
        trackInventory: 1,
        onHand: null,
        reserved: null,
        safetyStock: null,
        balanceVersion: null,
      },
    ]);

    await expect(
      buildRevisionReservationPlan(db, "rev-missing"),
    ).rejects.toThrow("reservation_tracked_balance_missing");
  });

  it("rejects an inactive or unknown stock location", async () => {
    class MissingLocationDb extends ReservationPlanDb {
      prepare(query: string): Statement {
        if (query.includes("FROM inventory_locations")) {
          const statement = new Statement(query, null);
          this.prepared.push(statement);
          return statement;
        }
        return super.prepare(query);
      }
    }

    const db = new MissingLocationDb([]);

    await expect(
      buildRevisionReservationPlan(db, "rev-1", "loc-unknown"),
    ).rejects.toThrow("reservation_location_not_found");
  });
});
