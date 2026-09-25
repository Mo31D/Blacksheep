import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { applyAdminOrderUpdate } from "../src/data/admin-orders";
import type {
  AdminOrderState,
  ValidatedAdminAction,
} from "../src/domain/admin-order";

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

class LifecycleDb implements D1DatabaseLike {
  readonly prepared: Statement[] = [];
  readonly batches: Statement[][] = [];

  constructor(
    private readonly reservationState: "ACTIVE" | "COMMITTED" | null,
  ) {}

  prepare(query: string): Statement {
    let firstValue: unknown = null;
    let rows: unknown[] = [];

    if (
      query.includes("FROM inventory_reservations") &&
      query.includes("revision_id = ?") &&
      query.includes("state = 'ACTIVE'")
    ) {
      firstValue =
        this.reservationState === "ACTIVE"
          ? {
              id: "res-life",
              orderId: "order-life",
              revisionId: "rev-life",
              locationId: "loc_ambleside",
              state: "ACTIVE",
              expiresAt: "2026-10-02T21:00:00.000Z",
              version: 4,
              mutationToken: "active-token",
            }
          : null;
    } else if (
      query.includes("FROM inventory_reservations") &&
      query.includes("revision_id = ?") &&
      query.includes("state = 'COMMITTED'")
    ) {
      firstValue =
        this.reservationState === "COMMITTED"
          ? {
              id: "res-life",
              orderId: "order-life",
              revisionId: "rev-life",
              locationId: "loc_ambleside",
              state: "COMMITTED",
              expiresAt: "2026-10-02T21:00:00.000Z",
              version: 5,
              mutationToken: "committed-token",
            }
          : null;
    } else if (query.includes("FROM inventory_reservation_items i")) {
      rows = [
        {
          variantId: "var-life",
          quantity: 2,
          onHand: 5,
          reserved: 2,
          safetyStock: 0,
          balanceVersion: 9,
        },
      ];
    }

    const statement = new Statement(query, firstValue, rows);
    this.prepared.push(statement);
    return statement;
  }

  async batch<T>(statements: D1PreparedStatementLike[]): Promise<T[]> {
    const batch = statements as Statement[];
    this.batches.push(batch);
    return batch.map(() => ({
      success: true,
      meta: { changes: 1 },
    })) as T[];
  }
}

function order(
  status: AdminOrderState["status"],
  fulfilmentMethod: AdminOrderState["fulfilmentMethod"],
  paymentStatus: string,
): AdminOrderState {
  return {
    id: "order-life",
    publicReference: "BSR-LIFE",
    status,
    fulfilmentMethod,
    itemsSubtotalMinor: 1000,
    deliveryAmountMinor: 0,
    finalTotalMinor: 1000,
    paymentStatus,
    activeRevisionId: "rev-life",
  };
}

describe("Phase 5 Admin order reservation lifecycle", () => {
  it("Mark paid commits the reservation without changing inventory balances", async () => {
    const db = new LifecycleDb("ACTIVE");
    const action: ValidatedAdminAction = {
      nextStatus: "PAID",
      paymentStatus: "PAID",
      timestampField: "paid_at",
      eventType: "PAYMENT_CONFIRMED",
    };

    await applyAdminOrderUpdate(
      db,
      order("AWAITING_PAYMENT", "collection", "PAYMENT_REQUESTED"),
      action,
      "owner@example.com",
      { inventoryReservations: true },
    );

    const batch = db.batches[0];
    expect(batch[0].sql).toContain("AND status = ?");
    expect(batch[0].sql).toContain("AND payment_status = ?");
    expect(
      batch.some((statement) =>
        statement.sql.includes("SET state = 'COMMITTED'"),
      ),
    ).toBe(true);
    expect(
      batch.some((statement) =>
        statement.sql.includes("UPDATE inventory_balances"),
      ),
    ).toBe(false);
  });

  it("delivery Shipped consumes committed stock and records SALE", async () => {
    const db = new LifecycleDb("COMMITTED");
    const action: ValidatedAdminAction = {
      nextStatus: "SHIPPED",
      timestampField: "shipped_at",
      eventType: "ORDER_SHIPPED",
      trackingReference: "TRACK-1",
      trackingUrl: "https://tracking.example/1",
    };

    await applyAdminOrderUpdate(
      db,
      order("PREPARING", "delivery", "PAID"),
      action,
      "owner@example.com",
      { inventoryReservations: true },
    );

    const batch = db.batches[0];
    const balance = batch.find((statement) =>
      statement.sql.includes("SET on_hand = on_hand - ?"),
    );
    const consumed = batch.find((statement) =>
      statement.sql.includes("SET state = 'CONSUMED'"),
    );
    const sale = batch.find(
      (statement) =>
        statement.sql.includes("INSERT INTO inventory_movements") &&
        statement.sql.includes("'SALE'"),
    );

    expect(balance).toBeDefined();
    expect(balance!.sql).toContain("reserved = reserved - ?");
    expect(consumed).toBeDefined();
    expect(sale).toBeDefined();
    expect(sale!.values).toContain(-2);
  });

  it("collection Complete consumes committed stock, not Ready for collection", async () => {
    const readyDb = new LifecycleDb("COMMITTED");
    await applyAdminOrderUpdate(
      readyDb,
      order("PREPARING", "collection", "PAID"),
      {
        nextStatus: "READY_FOR_COLLECTION",
        eventType: "ORDER_READY_FOR_COLLECTION",
      },
      "owner@example.com",
      { inventoryReservations: true },
    );

    expect(
      readyDb.batches[0].some((statement) =>
        statement.sql.includes("SET state = 'CONSUMED'"),
      ),
    ).toBe(false);

    const completeDb = new LifecycleDb("COMMITTED");
    await applyAdminOrderUpdate(
      completeDb,
      order("READY_FOR_COLLECTION", "collection", "PAID"),
      {
        nextStatus: "COMPLETED",
        timestampField: "completed_at",
        eventType: "ORDER_COMPLETED",
      },
      "owner@example.com",
      { inventoryReservations: true },
    );

    expect(
      completeDb.batches[0].some((statement) =>
        statement.sql.includes("SET state = 'CONSUMED'"),
      ),
    ).toBe(true);
  });

  it("pre-payment Cancel releases an ACTIVE hold", async () => {
    const db = new LifecycleDb("ACTIVE");

    await applyAdminOrderUpdate(
      db,
      order("AWAITING_PAYMENT", "collection", "PAYMENT_REQUESTED"),
      {
        nextStatus: "CANCELLED",
        paymentStatus: "CANCELLED",
        timestampField: "cancelled_at",
        eventType: "ORDER_CANCELLED",
      },
      "owner@example.com",
      { inventoryReservations: true },
    );

    const release = db.batches[0].find(
      (statement) =>
        statement.sql.includes("UPDATE inventory_reservations") &&
        statement.values.includes("RELEASED"),
    );
    expect(release).toBeDefined();
    expect(release!.values).toContain("ACTIVE");
    expect(
      db.batches[0].some(
        (statement) =>
          statement.sql.includes("'RESERVATION_RELEASE'") &&
          statement.values.includes(-2),
      ),
    ).toBe(true);
  });

  it("refund-and-cancel before fulfilment releases a COMMITTED hold", async () => {
    const db = new LifecycleDb("COMMITTED");

    await applyAdminOrderUpdate(
      db,
      order("PREPARING", "delivery", "PAID"),
      {
        nextStatus: "CANCELLED",
        paymentStatus: "REFUNDED",
        timestampField: "cancelled_at",
        eventType: "ORDER_REFUNDED_AND_CANCELLED",
      },
      "owner@example.com",
      { inventoryReservations: true },
    );

    const release = db.batches[0].find(
      (statement) =>
        statement.sql.includes("UPDATE inventory_reservations") &&
        statement.values.includes("RELEASED"),
    );
    expect(release).toBeDefined();
    expect(release!.values).toContain("COMMITTED");
  });

  it("delivery Complete after Shipped does not consume stock a second time", async () => {
    const db = new LifecycleDb(null);

    await applyAdminOrderUpdate(
      db,
      order("SHIPPED", "delivery", "PAID"),
      {
        nextStatus: "COMPLETED",
        timestampField: "completed_at",
        eventType: "ORDER_COMPLETED",
      },
      "owner@example.com",
      { inventoryReservations: true },
    );

    expect(
      db.prepared.some((statement) =>
        statement.sql.includes("inventory_reservations"),
      ),
    ).toBe(false);
    expect(
      db.batches[0].some((statement) =>
        statement.sql.includes("inventory_movements"),
      ),
    ).toBe(false);
  });

  it("keeps the legacy order action path free of reservation queries when the feature is off", async () => {
    const db = new LifecycleDb("ACTIVE");

    await applyAdminOrderUpdate(
      db,
      order("AWAITING_PAYMENT", "collection", "PAYMENT_REQUESTED"),
      {
        nextStatus: "PAID",
        paymentStatus: "PAID",
        timestampField: "paid_at",
        eventType: "PAYMENT_CONFIRMED",
      },
      "owner@example.com",
    );

    expect(
      db.prepared.some((statement) =>
        statement.sql.includes("inventory_reservations"),
      ),
    ).toBe(false);
    expect(db.batches[0]).toHaveLength(2);
  });
});
