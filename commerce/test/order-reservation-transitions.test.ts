import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { transitionOrderRevision } from "../src/data/order-revisions";

type RevisionState = "DRAFT" | "SENT" | "DECLINED";

class Statement implements D1PreparedStatementLike {
  values: unknown[] = [];

  constructor(
    public readonly sql: string,
    private readonly firstFactory: (() => unknown) | null = null,
    private readonly rowsFactory: (() => unknown[]) | null = null,
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    return (this.firstFactory ? this.firstFactory() : null) as T | null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return {
      results: (this.rowsFactory ? this.rowsFactory() : []) as T[],
    };
  }

  async run(): Promise<unknown> {
    return {};
  }
}

interface Scenario {
  action: "send" | "decline";
  resolvedRows?: unknown[];
  activeReservation?: boolean;
  supersededReservation?: boolean;
  releaseRows?: unknown[];
  initialState?: RevisionState;
  initialVersion?: number;
  replayReservation?: boolean;
}

class TransitionDb implements D1DatabaseLike {
  readonly prepared: Statement[] = [];
  readonly batches: Statement[][] = [];
  postBatch = false;

  constructor(private readonly scenario: Scenario) {}

  private revisionRow(): Record<string, unknown> {
    const beforeState: RevisionState =
      this.scenario.initialState ??
      (this.scenario.action === "decline" ? "SENT" : "DRAFT");
    const afterState: RevisionState =
      this.scenario.action === "decline" ? "DECLINED" : "SENT";
    const beforeVersion = this.scenario.initialVersion ?? 4;
    return {
      id: "rev-new",
      orderId: "order-1",
      revisionNumber: 2,
      state: this.postBatch ? afterState : beforeState,
      version: this.postBatch ? beforeVersion + 1 : beforeVersion,
      mutationToken: this.postBatch ? "post-batch-token" : "before-token",
      currency: "GBP",
      itemsSubtotalMinor: 4000,
      deliveryAmountMinor: 0,
      adjustmentAmountMinor: 0,
      finalTotalMinor: 4000,
      customerMessage: null,
      internalNote: null,
      createdBy: "owner@example.com",
      createdAt: "2026-09-25T20:00:00.000Z",
      sentAt:
        this.postBatch && this.scenario.action === "send"
          ? "2026-09-25T21:00:00.000Z"
          : null,
      acceptedAt: null,
      declinedAt:
        this.postBatch && this.scenario.action === "decline"
          ? "2026-09-25T21:00:00.000Z"
          : null,
      supersededAt: null,
      expiresAt: null,
      fulfilmentMethod: "collection",
      deliveryAddressLine1: null,
      deliveryAddressLine2: null,
      deliveryTown: null,
      deliveryCounty: null,
      deliveryPostcode: null,
      deliveryCountry: null,
      orderStatus: "UNDER_REVIEW",
    };
  }

  prepare(query: string): Statement {
    let firstFactory: (() => unknown) | null = null;
    let rowsFactory: (() => unknown[]) | null = null;

    if (
      query.includes("FROM order_revisions r") &&
      query.includes("INNER JOIN orders o") &&
      query.includes("WHERE o.public_reference = ? AND r.id = ?")
    ) {
      firstFactory = () => this.revisionRow();
    } else if (query.includes("FROM inventory_locations")) {
      firstFactory = () => ({ id: "loc_ambleside" });
    } else if (query.includes("FROM order_revision_items ri")) {
      rowsFactory = () => this.scenario.resolvedRows ?? [];
    } else if (
      query.includes("FROM inventory_reservations") &&
      query.includes("order_id = ?") &&
      query.includes("revision_id <> ?")
    ) {
      rowsFactory = () =>
        this.scenario.supersededReservation
          ? [
              {
                id: "res-old",
                orderId: "order-1",
                revisionId: "rev-old",
                locationId: "loc_ambleside",
                state: "ACTIVE",
                expiresAt: "2026-10-01T21:00:00.000Z",
                version: 2,
                mutationToken: "old-res-token",
              },
            ]
          : [];
    } else if (
      query.includes("FROM inventory_reservations") &&
      query.includes("state IN ('ACTIVE','COMMITTED','CONSUMED')")
    ) {
      firstFactory = () =>
        this.scenario.replayReservation ? { id: "res-replay" } : null;
    } else if (
      query.includes("FROM inventory_reservations") &&
      query.includes("revision_id = ?") &&
      query.includes("state = 'ACTIVE'")
    ) {
      firstFactory = () =>
        this.scenario.activeReservation
          ? {
              id: "res-new",
              orderId: "order-1",
              revisionId: "rev-new",
              locationId: "loc_ambleside",
              state: "ACTIVE",
              expiresAt: "2026-10-01T21:00:00.000Z",
              version: 1,
              mutationToken: "active-res-token",
            }
          : null;
    } else if (query.includes("FROM inventory_reservation_items i")) {
      rowsFactory = () => this.scenario.releaseRows ?? [];
    } else if (
      query.includes("FROM order_revision_items") &&
      !query.includes("FROM order_revision_items ri")
    ) {
      rowsFactory = () => [
        {
          id: 101,
          lineNumber: 1,
          sourceOrderItemId: 1,
          catalogProductId: "LEGACY-TRACKED",
          sku: "TRACK-1",
          slug: "tracked",
          productName: "Tracked Product",
          unitPriceMinor: 4000,
          requestedQuantity: 1,
          confirmedQuantity: 1,
          availabilityStatus: "CONFIRMED",
          reasonCode: null,
          customerNote: null,
          internalNote: null,
          lineTotalMinor: 4000,
        },
      ];
    } else if (query.includes("FROM order_adjustments")) {
      rowsFactory = () => [];
    }

    const statement = new Statement(query, firstFactory, rowsFactory);
    this.prepared.push(statement);
    return statement;
  }

  async batch<T>(statements: D1PreparedStatementLike[]): Promise<T[]> {
    const batch = statements as Statement[];
    this.batches.push(batch);
    this.postBatch = true;
    return batch.map(() => ({
      success: true,
      meta: { changes: 1 },
    })) as T[];
  }
}

const trackedRow = {
  revisionItemId: 101,
  lineNumber: 1,
  catalogProductId: "LEGACY-TRACKED",
  confirmedQuantity: 1,
  productId: "prd-tracked",
  variantId: "var-tracked",
  trackInventory: 1,
  onHand: 3,
  reserved: 0,
  safetyStock: 0,
  balanceVersion: 7,
};

describe("Phase 5 revision reservation transitions", () => {
  it("puts tracked hold creation and revision Send into one D1 batch", async () => {
    const db = new TransitionDb({
      action: "send",
      resolvedRows: [trackedRow],
    });

    const result = await transitionOrderRevision(
      db,
      "BSR-TEST",
      "rev-new",
      "send",
      4,
      "owner@example.com",
      { inventoryReservations: true, reservationTtlHours: 168 },
    );

    expect(result).toMatchObject({ state: "SENT", version: 5 });
    expect(db.batches).toHaveLength(1);

    const sql = db.batches[0].map((statement) => statement.sql);
    const lockIndex = sql.findIndex(
      (entry) =>
        entry.includes("UPDATE order_revisions") &&
        entry.includes("SET version = ?, mutation_token = ?"),
    );
    const holdIndex = sql.findIndex(
      (entry) =>
        entry.includes("UPDATE inventory_balances") &&
        entry.includes("reserved = reserved + ?"),
    );
    const reservationIndex = sql.findIndex((entry) =>
      entry.includes("INSERT INTO inventory_reservations"),
    );
    const movementIndex = sql.findIndex(
      (entry) =>
        entry.includes("INSERT INTO inventory_movements") &&
        entry.includes("'ORDER_RESERVATION'"),
    );
    const sendIndex = sql.findIndex(
      (entry) =>
        entry.includes("SET state = 'SENT'") &&
        entry.includes("expires_at = ?"),
    );

    expect(lockIndex).toBe(0);
    expect(holdIndex).toBeGreaterThan(lockIndex);
    expect(reservationIndex).toBeGreaterThan(holdIndex);
    expect(movementIndex).toBeGreaterThan(reservationIndex);
    expect(sendIndex).toBeGreaterThan(movementIndex);
  });

  it("treats an exact replay of a successful Send as idempotent and creates no second hold", async () => {
    const db = new TransitionDb({
      action: "send",
      initialState: "SENT",
      initialVersion: 5,
      replayReservation: true,
    });

    const result = await transitionOrderRevision(
      db,
      "BSR-TEST",
      "rev-new",
      "send",
      4,
      "owner@example.com",
      { inventoryReservations: true },
    );

    expect(result).toMatchObject({
      state: "SENT",
      version: 5,
      idempotentReplay: true,
    });
    expect(db.batches).toHaveLength(0);
    expect(
      db.prepared.filter((statement) =>
        statement.sql.includes("INSERT INTO inventory_reservations"),
      ),
    ).toHaveLength(0);
  });

  it("preserves an untracked reviewed line without a numeric inventory balance mutation", async () => {
    const db = new TransitionDb({
      action: "send",
      resolvedRows: [
        {
          ...trackedRow,
          productId: "prd-untracked",
          variantId: "var-untracked",
          trackInventory: 0,
          onHand: null,
          reserved: null,
          safetyStock: null,
          balanceVersion: null,
        },
      ],
    });

    await transitionOrderRevision(
      db,
      "BSR-TEST",
      "rev-new",
      "send",
      4,
      "owner@example.com",
      { inventoryReservations: true },
    );

    const sql = db.batches[0].map((statement) => statement.sql);
    expect(
      sql.some(
        (entry) =>
          entry.includes("UPDATE inventory_balances") &&
          entry.includes("reserved = reserved + ?"),
      ),
    ).toBe(false);
    expect(
      sql.some((entry) => entry.includes("INSERT INTO inventory_reservations")),
    ).toBe(true);
    expect(
      sql.some((entry) => entry.includes("SET state = 'SENT'")),
    ).toBe(true);
  });

  it("rejects insufficient tracked stock before any D1 batch executes", async () => {
    const db = new TransitionDb({
      action: "send",
      resolvedRows: [
        {
          ...trackedRow,
          confirmedQuantity: 2,
          onHand: 1,
          reserved: 0,
          balanceVersion: 3,
        },
      ],
    });

    await expect(
      transitionOrderRevision(
        db,
        "BSR-TEST",
        "rev-new",
        "send",
        4,
        "owner@example.com",
        { inventoryReservations: true },
      ),
    ).rejects.toThrow("reservation_insufficient_stock");

    expect(db.batches).toHaveLength(0);
  });

  it("releases a superseded hold before reserving the replacement and rebases the version", async () => {
    const db = new TransitionDb({
      action: "send",
      supersededReservation: true,
      resolvedRows: [
        {
          ...trackedRow,
          confirmedQuantity: 4,
          onHand: 5,
          reserved: 2,
          safetyStock: 0,
          balanceVersion: 10,
        },
      ],
      releaseRows: [
        {
          variantId: "var-tracked",
          quantity: 2,
          onHand: 5,
          reserved: 2,
          safetyStock: 0,
          balanceVersion: 10,
        },
      ],
    });

    await transitionOrderRevision(
      db,
      "BSR-TEST",
      "rev-new",
      "send",
      4,
      "owner@example.com",
      { inventoryReservations: true },
    );

    const batch = db.batches[0];
    const releaseBalance = batch.find(
      (statement) =>
        statement.sql.includes("UPDATE inventory_balances") &&
        statement.sql.includes("reserved = reserved - ?"),
    );
    const replacementHold = batch.find(
      (statement) =>
        statement.sql.includes("UPDATE inventory_balances") &&
        statement.sql.includes("reserved = reserved + ?"),
    );

    expect(releaseBalance).toBeDefined();
    expect(replacementHold).toBeDefined();
    expect(batch.indexOf(releaseBalance!)).toBeLessThan(
      batch.indexOf(replacementHold!),
    );

    // The old reservation releases balance version 10 -> 11.
    expect(releaseBalance!.values).toContain(10);
    // The replacement hold must expect the rebased version 11.
    expect(replacementHold!.values).toContain(11);
    expect(replacementHold!.values).toContain(4);
  });

  it("releases an active reservation before marking a reviewed quote declined", async () => {
    const db = new TransitionDb({
      action: "decline",
      activeReservation: true,
      releaseRows: [
        {
          variantId: "var-tracked",
          quantity: 1,
          onHand: 3,
          reserved: 1,
          safetyStock: 0,
          balanceVersion: 8,
        },
      ],
    });

    await transitionOrderRevision(
      db,
      "BSR-TEST",
      "rev-new",
      "decline",
      4,
      "owner@example.com",
      { inventoryReservations: true },
    );

    const batch = db.batches[0];
    const releaseIndex = batch.findIndex(
      (statement) =>
        statement.sql.includes("SET state = ?") &&
        statement.sql.includes("release_reason = ?") &&
        statement.values.includes("RELEASED"),
    );
    const declineIndex = batch.findIndex(
      (statement) => statement.sql.includes("SET state = 'DECLINED'"),
    );

    expect(releaseIndex).toBeGreaterThan(0);
    expect(declineIndex).toBeGreaterThan(releaseIndex);
    expect(
      batch.some(
        (statement) =>
          statement.sql.includes("INSERT INTO inventory_movements") &&
          statement.sql.includes("'RESERVATION_RELEASE'"),
      ),
    ).toBe(true);
  });

  it("keeps the legacy transition path reservation-free when the feature option is off", async () => {
    const db = new TransitionDb({
      action: "send",
      resolvedRows: [trackedRow],
    });

    await transitionOrderRevision(
      db,
      "BSR-TEST",
      "rev-new",
      "send",
      4,
      "owner@example.com",
    );

    const sql = db.batches[0].map((statement) => statement.sql);
    expect(sql.some((entry) => entry.includes("inventory_reservations"))).toBe(
      false,
    );
    expect(sql.some((entry) => entry.includes("inventory_balances"))).toBe(
      false,
    );
    expect(
      sql.some(
        (entry) =>
          entry.includes("SET state = 'SENT'") &&
          entry.includes("expires_at = ?"),
      ),
    ).toBe(false);
  });
});
