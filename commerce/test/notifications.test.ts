import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import type {
  CreatedOrder,
  SubmittedOrderInput,
} from "../src/domain/order";
import { notifyOrderSubmitted } from "../src/notifications/service";

class Statement implements D1PreparedStatementLike {
  values: unknown[] = [];
  constructor(public readonly sql: string) {}
  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }
  async first<T>(): Promise<T | null> {
    return null;
  }
  async run(): Promise<unknown> {
    return {};
  }
}

class Db implements D1DatabaseLike {
  statements: Statement[] = [];
  prepare(query: string): Statement {
    const statement = new Statement(query);
    this.statements.push(statement);
    return statement;
  }
  async batch<T>(): Promise<T[]> {
    return [];
  }
}

const request: SubmittedOrderInput = {
  id: "order-1",
  publicReference: "BSR-260924-ABCDEFGH",
  idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
  currency: "GBP",
  fulfilmentMethod: "collection",
  customerName: "Jane Smith",
  customerEmail: "jane@example.com",
  itemsSubtotalMinor: 1990,
  items: [
    {
      catalogProductId: "PR-001",
      slug: "example",
      productName: "Peter Rabbit Example",
      unitPriceMinor: 995,
      quantity: 2,
      lineTotalMinor: 1990,
    },
  ],
};

const order: CreatedOrder = {
  id: "order-1",
  publicReference: "BSR-260924-ABCDEFGH",
  status: "SUBMITTED",
  createdAt: "2026-09-24T18:00:00.000Z",
};

describe("order notifications", () => {
  it("sends owner and customer emails and records success events", async () => {
    const db = new Db();
    const messages: any[] = [];
    await notifyOrderSubmitted(
      {
        DB: db,
        EMAIL: {
          async send(message) {
            messages.push(message);
            return { messageId: "message-1" };
          },
        },
        ORDER_EMAIL_FROM: "orders@theblacksheepshop.co.uk",
        ORDER_OWNER_EMAIL: "owner@example.com",
      },
      request,
      order,
    );

    expect(messages).toHaveLength(2);
    expect(messages[0].subject).toContain(order.publicReference);
    expect(messages[1].to).toMatchObject({ email: request.customerEmail });
    expect(db.statements).toHaveLength(2);
    expect(db.statements.every((statement) => statement.sql.includes("order_events"))).toBe(true);
    expect(db.statements.map((statement) => statement.values[1])).toEqual(
      expect.arrayContaining([
        "OWNER_NOTIFICATION_SENT",
        "CUSTOMER_ACKNOWLEDGEMENT_SENT",
      ]),
    );
  });

  it("retries once and records a final provider-safe failure", async () => {
    const db = new Db();
    let attempts = 0;
    await notifyOrderSubmitted(
      {
        DB: db,
        EMAIL: {
          async send() {
            attempts += 1;
            throw new Error("provider details should not be persisted");
          },
        },
        ORDER_EMAIL_FROM: "orders@theblacksheepshop.co.uk",
        ORDER_OWNER_EMAIL: "owner@example.com",
      },
      request,
      order,
    );

    expect(attempts).toBe(4);
    expect(db.statements).toHaveLength(2);
    expect(db.statements.map((statement) => statement.values[1])).toEqual(
      expect.arrayContaining([
        "OWNER_NOTIFICATION_FAILED",
        "CUSTOMER_ACKNOWLEDGEMENT_FAILED",
      ]),
    );
    expect(db.statements.every((statement) => String(statement.values[7]).includes("send_failed"))).toBe(true);
    expect(db.statements.every((statement) => !String(statement.values[7]).includes("provider details"))).toBe(true);
  });

  it("does nothing until the email binding and addresses are configured", async () => {
    const db = new Db();
    await notifyOrderSubmitted({ DB: db }, request, order);
    expect(db.statements).toHaveLength(0);
  });
});
