import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import {
  assertReservationAvailability,
  buildRevisionReservationPlan,
  prepareReservationCommitMutation,
  prepareReservationConsumeMutation,
  prepareReservationMutation,
  prepareReservationReleaseMutation,
  rebaseReservationPlanAfterRelease,
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



describe("Phase 5 supersede reservation rebasing", () => {
  it("adds released quantity back to availability and advances the expected balance version", () => {
    const plan = {
      revisionId: "rev-new",
      locationId: "loc_ambleside",
      lines: [
        {
          revisionItemId: 61,
          lineNumber: 1,
          catalogProductId: "LEGACY-SHARED",
          confirmedQuantity: 4,
          productId: "prd-shared",
          variantId: "var-shared",
          resolved: true,
          tracked: true,
          onHand: 5,
          reserved: 2,
          safetyStock: 0,
          available: 3,
          balanceVersion: 10,
          sufficient: false,
        },
      ],
      trackedLines: [] as any[],
      untrackedLines: [] as any[],
      requirements: [
        {
          variantId: "var-shared",
          requiredQuantity: 4,
          onHand: 5,
          reserved: 2,
          safetyStock: 0,
          available: 3,
          balanceVersion: 10,
        },
      ],
    };
    plan.trackedLines = plan.lines;

    const rebased = rebaseReservationPlanAfterRelease(plan, {
      reservationId: "res-old",
      orderId: "order-1",
      revisionId: "rev-old",
      locationId: "loc_ambleside",
      expiresAt: "2026-10-02T21:00:00.000Z",
      version: 2,
      mutationToken: "old-res-token",
      requirements: [
        {
          variantId: "var-shared",
          quantity: 2,
          onHand: 5,
          reserved: 2,
          safetyStock: 0,
          balanceVersion: 10,
        },
      ],
    });

    expect(rebased.requirements).toEqual([
      {
        variantId: "var-shared",
        requiredQuantity: 4,
        onHand: 5,
        reserved: 0,
        safetyStock: 0,
        available: 5,
        balanceVersion: 11,
      },
    ]);
    expect(rebased.lines[0]).toMatchObject({
      reserved: 0,
      available: 5,
      balanceVersion: 11,
      sufficient: true,
    });
    expect(() => assertReservationAvailability(rebased)).not.toThrow();
  });

  it("rejects a stale supersede plan when the old and new reads disagree on balance version", () => {
    const plan = {
      revisionId: "rev-new",
      locationId: "loc_ambleside",
      lines: [],
      trackedLines: [],
      untrackedLines: [],
      requirements: [
        {
          variantId: "var-shared",
          requiredQuantity: 1,
          onHand: 5,
          reserved: 1,
          safetyStock: 0,
          available: 4,
          balanceVersion: 11,
        },
      ],
    };

    expect(() =>
      rebaseReservationPlanAfterRelease(plan, {
        reservationId: "res-old",
        orderId: "order-1",
        revisionId: "rev-old",
        locationId: "loc_ambleside",
        expiresAt: "2026-10-02T21:00:00.000Z",
        version: 2,
        mutationToken: "old-res-token",
        requirements: [
          {
            variantId: "var-shared",
            quantity: 1,
            onHand: 5,
            reserved: 1,
            safetyStock: 0,
            balanceVersion: 10,
          },
        ],
      }),
    ).toThrow("reservation_supersede_balance_version_mismatch");
  });
});

describe("Phase 5 guarded reservation mutation builder", () => {
  class MutationDb implements D1DatabaseLike {
    readonly prepared: Statement[] = [];

    prepare(query: string): Statement {
      const statement = new Statement(query);
      this.prepared.push(statement);
      return statement;
    }

    async batch<T>(): Promise<T[]> {
      return [] as T[];
    }
  }

  const basePlan = {
    revisionId: "rev-guarded",
    locationId: "loc_ambleside",
    lines: [
      {
        revisionItemId: 51,
        lineNumber: 1,
        catalogProductId: "LEGACY-GUARDED",
        confirmedQuantity: 2,
        productId: "prd-guarded",
        variantId: "var-guarded",
        resolved: true,
        tracked: true,
        onHand: 5,
        reserved: 1,
        safetyStock: 0,
        available: 4,
        balanceVersion: 8,
        sufficient: true,
      },
    ],
    trackedLines: [] as any[],
    untrackedLines: [] as any[],
    requirements: [
      {
        variantId: "var-guarded",
        requiredQuantity: 2,
        onHand: 5,
        reserved: 1,
        safetyStock: 0,
        available: 4,
        balanceVersion: 8,
      },
    ],
  };

  it("builds one guarded balance mutation and one ledger movement per tracked variant", () => {
    const db = new MutationDb();
    const plan = {
      ...basePlan,
      trackedLines: basePlan.lines,
    };

    const prepared = prepareReservationMutation(db, plan, {
      orderId: "order-guarded",
      actorEmail: "owner@example.com",
      expiresAt: "2026-10-02T21:00:00.000Z",
      revisionVersion: 4,
      revisionMutationToken: "revision-win-token",
      idempotencyKey: "reservation:test:guarded",
      createdAt: "2026-09-25T21:00:00.000Z",
    });

    expect(prepared.statements).toHaveLength(4);
    expect(prepared.idempotencyKey).toBe("reservation:test:guarded");

    const balanceUpdate = db.prepared[0];
    expect(balanceUpdate.sql).toContain("SET reserved = reserved + ?");
    expect(balanceUpdate.sql).toContain("version = ?");
    expect(balanceUpdate.sql).toContain(
      "(on_hand - reserved - safety_stock) >= ?",
    );
    expect(balanceUpdate.sql).toContain("mutation_token = ?");
    expect(balanceUpdate.sql).toContain("state = 'DRAFT'");
    expect(balanceUpdate.values).toContain(8);
    expect(balanceUpdate.values).toContain(2);

    const reservationInsert = db.prepared[1];
    expect(reservationInsert.sql).toContain(
      "INSERT INTO inventory_reservations",
    );
    expect(reservationInsert.sql).toContain("CASE WHEN");
    expect(reservationInsert.sql).toContain("THEN ? ELSE NULL END");
    expect(reservationInsert.sql).toContain(
      "guard_balance.mutation_token = ?",
    );

    const itemInsert = db.prepared[2];
    expect(itemInsert.sql).toContain(
      "INSERT INTO inventory_reservation_items",
    );
    expect(itemInsert.values).toContain(51);
    expect(itemInsert.values).toContain("var-guarded");

    const movementInsert = db.prepared[3];
    expect(movementInsert.sql).toContain(
      "'ORDER_RESERVATION'",
    );
    expect(movementInsert.sql).toContain("b.reserved");
    expect(movementInsert.values).toContain("order-guarded");
    expect(movementInsert.values).toContain("rev-guarded");
  });

  it("aggregates one balance mutation while retaining each reviewed-line provenance row", () => {
    const db = new MutationDb();
    const second = {
      ...basePlan.lines[0],
      revisionItemId: 52,
      lineNumber: 2,
      confirmedQuantity: 1,
    };
    const plan = {
      ...basePlan,
      lines: [basePlan.lines[0], second],
      trackedLines: [basePlan.lines[0], second],
      requirements: [
        {
          ...basePlan.requirements[0],
          requiredQuantity: 3,
        },
      ],
    };

    const prepared = prepareReservationMutation(db, plan, {
      orderId: "order-guarded",
      actorEmail: "owner@example.com",
      expiresAt: "2026-10-02T21:00:00.000Z",
      revisionVersion: 4,
      revisionMutationToken: "revision-win-token",
      createdAt: "2026-09-25T21:00:00.000Z",
    });

    expect(prepared.statements).toHaveLength(5);
    expect(
      db.prepared.filter((statement) =>
        statement.sql.includes("UPDATE inventory_balances"),
      ),
    ).toHaveLength(1);
    expect(
      db.prepared.filter((statement) =>
        statement.sql.includes("INSERT INTO inventory_reservation_items"),
      ),
    ).toHaveLength(2);
    expect(
      db.prepared.filter((statement) =>
        statement.sql.includes("INSERT INTO inventory_movements"),
      ),
    ).toHaveLength(1);
  });

  it("refuses to prepare any mutation when aggregate availability is insufficient", () => {
    const db = new MutationDb();
    const plan = {
      ...basePlan,
      lines: basePlan.lines.map((line) => ({
        ...line,
        available: 1,
        sufficient: false,
      })),
      trackedLines: basePlan.lines.map((line) => ({
        ...line,
        available: 1,
        sufficient: false,
      })),
      requirements: [
        {
          ...basePlan.requirements[0],
          requiredQuantity: 2,
          available: 1,
        },
      ],
    };

    expect(() =>
      prepareReservationMutation(db, plan, {
        orderId: "order-guarded",
        actorEmail: "owner@example.com",
        expiresAt: "2026-10-02T21:00:00.000Z",
        revisionVersion: 4,
        revisionMutationToken: "revision-win-token",
      }),
    ).toThrow("reservation_insufficient_stock");

    expect(db.prepared).toHaveLength(0);
  });
});

describe("Phase 5 guarded reservation release builder", () => {
  class ReleaseDb implements D1DatabaseLike {
    readonly prepared: Statement[] = [];

    prepare(query: string): Statement {
      const statement = new Statement(query);
      this.prepared.push(statement);
      return statement;
    }

    async batch<T>(): Promise<T[]> {
      return [] as T[];
    }
  }

  it("builds release balance updates, a guarded terminal state change and release movements", () => {
    const db = new ReleaseDb();
    const prepared = prepareReservationReleaseMutation(
      db,
      {
        reservationId: "res-release",
        orderId: "order-release",
        revisionId: "rev-release",
        locationId: "loc_ambleside",
        expiresAt: "2026-10-02T21:00:00.000Z",
        version: 3,
        mutationToken: "active-res-token",
        requirements: [
          {
            variantId: "var-release",
            quantity: 2,
            onHand: 5,
            reserved: 2,
            safetyStock: 0,
            balanceVersion: 10,
          },
        ],
      },
      {
        actorEmail: "owner@example.com",
        reason: "Reviewed quote declined",
        createdAt: "2026-09-25T21:10:00.000Z",
        externalGuard: {
          revisionId: "rev-current",
          version: 8,
          mutationToken: "revision-guard-token",
          state: "SENT",
        },
      },
    );

    expect(prepared.statements).toHaveLength(3);

    const balance = db.prepared[0];
    expect(balance.sql).toContain("SET reserved = reserved - ?");
    expect(balance.sql).toContain("reserved >= ?");
    expect(balance.sql).toContain("reservation_guard.state = ?");
    expect(balance.values).toContain("ACTIVE");
    expect(balance.sql).toContain("external_revision_guard.state = ?");
    expect(balance.values).toContain(2);
    expect(balance.values).toContain("revision-guard-token");

    const release = db.prepared[1];
    expect(release.sql).toContain("SET state = ?");
    expect(release.values).toContain("RELEASED");
    expect(release.sql).toContain("CASE");
    expect(release.sql).toContain("ELSE NULL");
    expect(release.sql).toContain("release_reason = ?");
    expect(release.values).toContain("Reviewed quote declined");

    const movement = db.prepared[2];
    expect(movement.sql).toContain("'RESERVATION_RELEASE'");
    expect(movement.values).toContain(-2);
    expect(movement.values).toContain("res-release");
  });

  it("can release an all-untracked reservation without balance mutations", () => {
    const db = new ReleaseDb();
    const prepared = prepareReservationReleaseMutation(
      db,
      {
        reservationId: "res-untracked",
        orderId: "order-untracked",
        revisionId: "rev-untracked",
        locationId: "loc_ambleside",
        expiresAt: "2026-10-02T21:00:00.000Z",
        version: 1,
        mutationToken: "active-token",
        requirements: [],
      },
      {
        actorEmail: "owner@example.com",
        reason: "Reviewed quote superseded",
        createdAt: "2026-09-25T21:10:00.000Z",
      },
    );

    expect(prepared.statements).toHaveLength(1);
    expect(db.prepared[0].sql).toContain("SET state = ?");
    expect(db.prepared[0].values).toContain("RELEASED");
    expect(db.prepared[0].sql).toContain("AND 1 = 1");
    expect(db.prepared[0].sql).toContain("THEN ?");
  });

  it("rejects impossible release state before preparing SQL", () => {
    const db = new ReleaseDb();

    expect(() =>
      prepareReservationReleaseMutation(
        db,
        {
          reservationId: "res-invalid",
          orderId: "order-invalid",
          revisionId: "rev-invalid",
          locationId: "loc_ambleside",
          expiresAt: "2026-10-02T21:00:00.000Z",
          version: 1,
          mutationToken: "active-token",
          requirements: [
            {
              variantId: "var-invalid",
              quantity: 3,
              onHand: 5,
              reserved: 2,
              safetyStock: 0,
              balanceVersion: 1,
            },
          ],
        },
        {
          actorEmail: "owner@example.com",
          reason: "",
        },
      ),
    ).toThrow("reservation_release_reason_required");

    expect(db.prepared).toHaveLength(0);
  });
});


describe("Phase 5 payment and fulfilment reservation builders", () => {
  class LifecycleDb implements D1DatabaseLike {
    readonly prepared: Statement[] = [];
    prepare(query: string): Statement {
      const statement = new Statement(query);
      this.prepared.push(statement);
      return statement;
    }
    async batch<T>(): Promise<T[]> {
      return [] as T[];
    }
  }

  const plan = {
    reservationId: "res-life",
    orderId: "order-life",
    revisionId: "rev-life",
    locationId: "loc_ambleside",
    expiresAt: "2026-10-02T21:00:00.000Z",
    version: 4,
    mutationToken: "reservation-life-token",
    requirements: [
      {
        variantId: "var-life",
        quantity: 2,
        onHand: 5,
        reserved: 2,
        safetyStock: 0,
        balanceVersion: 9,
      },
    ],
  };

  const orderGuard = {
    orderId: "order-life",
    status: "PAID",
    paymentStatus: "PAID",
    updatedAt: "2026-09-25T21:20:00.000Z",
  };

  it("commits a paid reservation without touching inventory quantities", () => {
    const db = new LifecycleDb();
    const prepared = prepareReservationCommitMutation(db, plan, {
      actorEmail: "owner@example.com",
      createdAt: orderGuard.updatedAt,
      externalOrderGuard: orderGuard,
    });

    expect(prepared.statements).toHaveLength(1);
    const statement = db.prepared[0];
    expect(statement.sql).toContain("SET state = 'COMMITTED'");
    expect(statement.sql).toContain("committed_at = ?");
    expect(statement.sql).toContain("state = 'ACTIVE'");
    expect(statement.sql).toContain("external_order_guard.status = ?");
    expect(statement.sql).not.toContain("UPDATE inventory_balances");
    expect(statement.values).toContain("PAID");
    expect(statement.values).toContain("reservation-life-token");
  });

  it("consumes a committed reservation with On hand and Reserved decremented together", () => {
    const db = new LifecycleDb();
    const prepared = prepareReservationConsumeMutation(db, plan, {
      actorEmail: "owner@example.com",
      createdAt: "2026-09-25T21:30:00.000Z",
      externalOrderGuard: {
        ...orderGuard,
        status: "SHIPPED",
        updatedAt: "2026-09-25T21:30:00.000Z",
      },
    });

    expect(prepared.statements).toHaveLength(3);

    const balance = db.prepared[0];
    expect(balance.sql).toContain("SET on_hand = on_hand - ?");
    expect(balance.sql).toContain("reserved = reserved - ?");
    expect(balance.sql).toContain("reservation_guard.state = 'COMMITTED'");
    expect(balance.values.filter((value) => value === 2).length).toBeGreaterThanOrEqual(4);

    const reservation = db.prepared[1];
    expect(reservation.sql).toContain("SET state = 'CONSUMED'");
    expect(reservation.sql).toContain("ELSE NULL");
    expect(reservation.values).toContain("SHIPPED");

    const movement = db.prepared[2];
    expect(movement.sql).toContain("'SALE'");
    expect(movement.values).toContain(-2);
    expect(movement.values).toContain("res-life");
    expect(movement.values).toContain("owner@example.com");
  });

  it("consumes an all-untracked reservation without creating stock ledger rows", () => {
    const db = new LifecycleDb();
    const prepared = prepareReservationConsumeMutation(
      db,
      { ...plan, requirements: [] },
      {
        actorEmail: "owner@example.com",
        createdAt: "2026-09-25T21:30:00.000Z",
        externalOrderGuard: {
          ...orderGuard,
          status: "COMPLETED",
          updatedAt: "2026-09-25T21:30:00.000Z",
        },
      },
    );

    expect(prepared.statements).toHaveLength(1);
    expect(db.prepared[0].sql).toContain("SET state = 'CONSUMED'");
    expect(
      db.prepared.some((statement) =>
        statement.sql.includes("INSERT INTO inventory_movements"),
      ),
    ).toBe(false);
  });
});

});
