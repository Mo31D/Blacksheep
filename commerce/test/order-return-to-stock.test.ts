import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { returnConsumedReservationToStock } from "../src/data/order-reservations";

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

class ReturnDb implements D1DatabaseLike {
  readonly prepared: Statement[] = [];
  readonly batches: Statement[][] = [];
  returnedAt: string | null = null;

  constructor(
    private readonly paymentStatus = "REFUNDED",
    private readonly failConcurrently = false,
  ) {}

  prepare(query: string): Statement {
    let firstFactory: (() => unknown) | null = null;
    let rowsFactory: (() => unknown[]) | null = null;

    if (
      query.includes("FROM inventory_reservations r") &&
      query.includes("o.public_reference = ?") &&
      query.includes("r.state = 'CONSUMED'")
    ) {
      firstFactory = () => ({
        reservationId: "res-return",
        orderId: "order-return",
        revisionId: "rev-return",
        locationId: "loc_ambleside",
        expiresAt: "2026-10-02T21:00:00.000Z",
        version: 6,
        mutationToken: "consumed-token",
        returnedAt: this.returnedAt,
        paymentStatus: this.paymentStatus,
        orderUpdatedAt: "2026-09-25T22:00:00.000Z",
      });
    } else if (query.includes("FROM inventory_reservation_items i")) {
      rowsFactory = () => [
        {
          variantId: "var-return",
          quantity: 2,
          onHand: 3,
          reserved: 0,
          safetyStock: 0,
          balanceVersion: 11,
        },
      ];
    } else if (query.includes("SELECT returned_at AS returnedAt")) {
      firstFactory = () => ({ returnedAt: this.returnedAt });
    }

    const statement = new Statement(query, firstFactory, rowsFactory);
    this.prepared.push(statement);
    return statement;
  }

  async batch<T>(statements: D1PreparedStatementLike[]): Promise<T[]> {
    const batch = statements as Statement[];
    this.batches.push(batch);
    this.returnedAt = "2026-09-25T22:05:00.000Z";
    if (this.failConcurrently) {
      throw new Error("NOT NULL constraint failed: inventory_reservations.mutation_token");
    }
    return batch.map(() => ({
      success: true,
      meta: { changes: 1 },
    })) as T[];
  }
}

describe("Phase 5 explicit return to stock", () => {
  it("increments On hand exactly once and writes an immutable RETURN movement", async () => {
    const db = new ReturnDb();

    const result = await returnConsumedReservationToStock(
      db,
      "BSR-RETURN",
      "owner@example.com",
    );

    expect(result.idempotentReplay).toBe(false);
    expect(db.batches).toHaveLength(1);

    const batch = db.batches[0];
    const balance = batch.find((statement) =>
      statement.sql.includes("SET on_hand = on_hand + ?"),
    );
    const marker = batch.find(
      (statement) =>
        statement.sql.includes("UPDATE inventory_reservations") &&
        statement.sql.includes("returned_at = ?"),
    );
    const movement = batch.find(
      (statement) =>
        statement.sql.includes("INSERT INTO inventory_movements") &&
        statement.sql.includes("'RETURN'"),
    );

    expect(balance).toBeDefined();
    expect(balance!.values).toContain(2);
    expect(marker).toBeDefined();
    expect(marker!.sql).toContain("returned_at IS NULL");
    expect(movement).toBeDefined();
    expect(movement!.values).toContain(2);
    expect(movement!.values).toContain("owner@example.com");
    expect(movement!.values).toContain(
      "reservation-return:res-return:variant:var-return",
    );
  });

  it("requires financial refund before physical stock is returned", async () => {
    const db = new ReturnDb("PAID");

    await expect(
      returnConsumedReservationToStock(
        db,
        "BSR-RETURN",
        "owner@example.com",
      ),
    ).rejects.toThrow("return_to_stock_requires_refund");

    expect(db.batches).toHaveLength(0);
  });

  it("replays idempotently after the return marker already exists", async () => {
    const db = new ReturnDb();
    db.returnedAt = "2026-09-25T22:05:00.000Z";

    const result = await returnConsumedReservationToStock(
      db,
      "BSR-RETURN",
      "owner@example.com",
    );

    expect(result).toEqual({
      reservationId: "res-return",
      returnedAt: "2026-09-25T22:05:00.000Z",
      idempotentReplay: true,
    });
    expect(db.batches).toHaveLength(0);
  });

  it("treats a concurrent winning return as an idempotent replay", async () => {
    const db = new ReturnDb("REFUNDED", true);

    const result = await returnConsumedReservationToStock(
      db,
      "BSR-RETURN",
      "owner@example.com",
    );

    expect(result.idempotentReplay).toBe(true);
    expect(result.returnedAt).toBe("2026-09-25T22:05:00.000Z");
    expect(db.batches).toHaveLength(1);
  });
});
