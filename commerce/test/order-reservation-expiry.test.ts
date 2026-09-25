import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { expireDueReservations } from "../src/data/order-reservations";

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

class ExpiryDb implements D1DatabaseLike {
  readonly prepared: Statement[] = [];
  readonly batches: Statement[][] = [];
  reservationState = "ACTIVE";

  constructor(
    private readonly mode: "expire" | "concurrent" | "empty" = "expire",
  ) {}

  prepare(query: string): Statement {
    let firstFactory: (() => unknown) | null = null;
    let rowsFactory: (() => unknown[]) | null = null;

    if (
      query.includes("FROM inventory_reservations r") &&
      query.includes("r.expires_at <= ?")
    ) {
      rowsFactory = () =>
        this.mode === "empty"
          ? []
          : [
              {
                id: "res-expired",
                orderId: "order-1",
                revisionId: "rev-expired",
                locationId: "loc_ambleside",
                state: "ACTIVE",
                expiresAt: "2026-09-25T20:00:00.000Z",
                version: 3,
                mutationToken: "reservation-token",
                revisionVersion: 7,
                revisionState: "SENT",
              },
            ];
    } else if (query.includes("FROM inventory_reservation_items i")) {
      rowsFactory = () => [
        {
          variantId: "var-1",
          quantity: 2,
          onHand: 5,
          reserved: 2,
          safetyStock: 0,
          balanceVersion: 9,
        },
      ];
    } else if (
      query.includes("SELECT state FROM inventory_reservations WHERE id = ?")
    ) {
      firstFactory = () => ({ state: this.reservationState });
    }

    const statement = new Statement(query, firstFactory, rowsFactory);
    this.prepared.push(statement);
    return statement;
  }

  async batch<T>(statements: D1PreparedStatementLike[]): Promise<T[]> {
    const batch = statements as Statement[];
    this.batches.push(batch);

    if (this.mode === "concurrent") {
      this.reservationState = "RELEASED";
      throw new Error("concurrent expiry winner");
    }

    this.reservationState = "EXPIRED";
    return batch.map(() => ({
      success: true,
      meta: { changes: 1 },
    })) as T[];
  }
}

describe("Phase 5 lazy reservation expiry", () => {
  it("expires the revision and releases stock in one guarded batch", async () => {
    const db = new ExpiryDb();

    const result = await expireDueReservations(db, {
      now: "2026-09-25T21:00:00.000Z",
    });

    expect(result).toEqual({ expired: 1, skipped: 0 });
    expect(db.batches).toHaveLength(1);

    const batch = db.batches[0];
    const revisionExpire = batch.findIndex(
      (statement) =>
        statement.sql.includes("UPDATE order_revisions") &&
        statement.sql.includes("SET state = 'EXPIRED'"),
    );
    const balanceRelease = batch.findIndex(
      (statement) =>
        statement.sql.includes("UPDATE inventory_balances") &&
        statement.sql.includes("reserved = reserved - ?"),
    );
    const reservationExpire = batch.findIndex(
      (statement) =>
        statement.sql.includes("UPDATE inventory_reservations") &&
        statement.sql.includes("SET state = ?"),
    );
    const movement = batch.findIndex(
      (statement) =>
        statement.sql.includes("INSERT INTO inventory_movements") &&
        statement.sql.includes("'RESERVATION_RELEASE'"),
    );
    const orderReset = batch.findIndex(
      (statement) =>
        statement.sql.includes("UPDATE orders") &&
        statement.sql.includes("status = 'UNDER_REVIEW'"),
    );
    const tokenRevoke = batch.findIndex((statement) =>
      statement.sql.includes("UPDATE customer_review_tokens"),
    );
    const event = batch.findIndex((statement) =>
      statement.sql.includes("'ORDER_REVISION_EXPIRED'"),
    );

    expect(revisionExpire).toBe(0);
    expect(balanceRelease).toBeGreaterThan(revisionExpire);
    expect(reservationExpire).toBeGreaterThan(balanceRelease);
    expect(movement).toBeGreaterThan(reservationExpire);
    expect(orderReset).toBeGreaterThan(movement);
    expect(tokenRevoke).toBeGreaterThan(orderReset);
    expect(event).toBeGreaterThan(tokenRevoke);

    expect(batch[reservationExpire].values).toContain("EXPIRED");
    expect(batch[movement].values).toContain("SYSTEM");
    expect(batch[movement].values).toContain("reservation-expiry");
    expect(batch[movement].values).toContain(-2);
  });

  it("treats a concurrent expiry/release winner as an idempotent skip", async () => {
    const db = new ExpiryDb("concurrent");

    const result = await expireDueReservations(db, {
      now: "2026-09-25T21:00:00.000Z",
    });

    expect(result).toEqual({ expired: 0, skipped: 1 });
    expect(db.batches).toHaveLength(1);
  });

  it("does nothing when there are no expired active reservations", async () => {
    const db = new ExpiryDb("empty");

    const result = await expireDueReservations(db, {
      now: "2026-09-25T21:00:00.000Z",
    });

    expect(result).toEqual({ expired: 0, skipped: 0 });
    expect(db.batches).toHaveLength(0);
  });
});
