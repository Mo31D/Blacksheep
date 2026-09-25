import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { declineCustomerReview } from "../src/data/customer-review";

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

class DeclineDb implements D1DatabaseLike {
  readonly prepared: Statement[] = [];
  readonly batches: Statement[][] = [];

  prepare(query: string): Statement {
    let firstValue: unknown = null;
    let rows: unknown[] = [];

    if (query.includes("FROM customer_review_tokens t")) {
      firstValue = {
        tokenId: "token-1",
        orderId: "order-1",
        publicReference: "BSR-DECLINE",
        orderStatus: "AWAITING_PAYMENT",
        paymentStatus: "PAYMENT_REQUESTED",
        paymentRequestUrl: "https://pay.example.test/1",
        fulfilmentMessage: "Collection",
        customerName: "Customer",
        customerEmail: "customer@example.com",
        revisionId: "rev-1",
        revisionNumber: 2,
        revisionVersion: 4,
        revisionState: "SENT",
        customerMessage: "Please review.",
        fulfilmentMethod: "collection",
        itemsSubtotalMinor: 1000,
        deliveryAmountMinor: 0,
        adjustmentAmountMinor: 0,
        finalTotalMinor: 1000,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      };
    } else if (
      query.includes("FROM inventory_reservations") &&
      query.includes("revision_id = ?") &&
      query.includes("state = 'ACTIVE'")
    ) {
      firstValue = {
        id: "res-1",
        orderId: "order-1",
        revisionId: "rev-1",
        locationId: "loc_ambleside",
        state: "ACTIVE",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        version: 2,
        mutationToken: "reservation-token",
      };
    } else if (query.includes("FROM inventory_reservation_items i")) {
      rows = [
        {
          variantId: "var-1",
          quantity: 2,
          onHand: 5,
          reserved: 2,
          safetyStock: 0,
          balanceVersion: 7,
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

const token = "abcdefghijklmnopqrstuvwxyzABCDEFGH1234567890";

describe("Phase 5 customer decline reservation release", () => {
  it("atomically releases an active hold before completing customer decline", async () => {
    const db = new DeclineDb();

    const result = await declineCustomerReview(db, token, {
      inventoryReservations: true,
    });

    expect(result.reference).toBe("BSR-DECLINE");
    expect(db.batches).toHaveLength(1);

    const batch = db.batches[0];
    const revisionDecline = batch.findIndex(
      (statement) =>
        statement.sql.includes("UPDATE order_revisions") &&
        statement.sql.includes("SET state = 'DECLINED'"),
    );
    const balanceRelease = batch.findIndex(
      (statement) =>
        statement.sql.includes("UPDATE inventory_balances") &&
        statement.sql.includes("reserved = reserved - ?"),
    );
    const reservationRelease = batch.findIndex(
      (statement) =>
        statement.sql.includes("UPDATE inventory_reservations") &&
        statement.sql.includes("state = 'RELEASED'"),
    );
    const releaseMovement = batch.findIndex(
      (statement) =>
        statement.sql.includes("INSERT INTO inventory_movements") &&
        statement.sql.includes("'RESERVATION_RELEASE'"),
    );
    const orderReset = batch.findIndex(
      (statement) =>
        statement.sql.includes("UPDATE orders") &&
        statement.sql.includes("status = 'UNDER_REVIEW'"),
    );

    expect(revisionDecline).toBe(0);
    expect(balanceRelease).toBeGreaterThan(revisionDecline);
    expect(reservationRelease).toBeGreaterThan(balanceRelease);
    expect(releaseMovement).toBeGreaterThan(reservationRelease);
    expect(orderReset).toBeGreaterThan(releaseMovement);

    const movement = batch[releaseMovement];
    expect(movement.values).toContain("CUSTOMER");
    expect(movement.values).toContain("customer-review");
    expect(movement.values).toContain(-2);
  });

  it("does not even query Phase 5 reservation tables when the feature is off", async () => {
    const db = new DeclineDb();

    await declineCustomerReview(db, token);

    expect(
      db.prepared.some((statement) =>
        statement.sql.includes("inventory_reservations"),
      ),
    ).toBe(false);
    expect(
      db.prepared.some((statement) =>
        statement.sql.includes("inventory_balances"),
      ),
    ).toBe(false);

    const sql = db.batches[0].map((statement) => statement.sql);
    expect(sql).toHaveLength(4);
    expect(sql.some((entry) => entry.includes("ORDER_REVISION_DECLINED"))).toBe(
      true,
    );
  });
});
