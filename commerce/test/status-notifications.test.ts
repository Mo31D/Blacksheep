import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { notifyLifecycleUpdate } from "../src/notifications/status";

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

const order = {
  id: "order-1",
  publicReference: "BSR-260925-STATUS",
  customerName: "Jane Smith",
  customerEmail: "jane@example.com",
  finalTotalMinor: 3495,
  paymentRequestUrl: null,
  fulfilmentMethod: "collection",
  fulfilmentMessage: "Collect after 12:40",
};

describe("customer lifecycle notifications", () => {
  it("sends a professional ready-for-collection message with shop reply-to", async () => {
    const db = new Db();
    const sent: any[] = [];

    await notifyLifecycleUpdate(
      {
        DB: db,
        EMAIL: {
          async send(message) {
            sent.push(message);
            return {};
          },
        },
        ORDER_EMAIL_FROM: "orders@theblacksheepshop.co.uk",
      },
      order,
      "ready_for_collection",
    );

    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain("Ready for collection");
    expect(sent[0].html).toContain("The Black Sheep Shop");
    expect(sent[0].html).toContain("Your order is ready");
    expect(sent[0].text).toContain("Collect after 12:40");
    expect(sent[0].replyTo).toMatchObject({
      email: "orders@theblacksheepshop.co.uk",
    });
    expect(db.statements[0].values[1]).toBe(
      "READY_FOR_COLLECTION_EMAIL_SENT",
    );
  });

  it("sends a refund-and-cancellation confirmation", async () => {
    const db = new Db();
    const sent: any[] = [];

    await notifyLifecycleUpdate(
      {
        DB: db,
        EMAIL: {
          async send(message) {
            sent.push(message);
            return {};
          },
        },
        ORDER_EMAIL_FROM: "orders@theblacksheepshop.co.uk",
      },
      order,
      "refunded_and_cancelled",
    );

    expect(sent[0].text).toContain("refunded and cancelled");
    expect(sent[0].text).toContain("£34.95");
    expect(db.statements[0].values[1]).toBe(
      "REFUND_CANCELLATION_EMAIL_SENT",
    );
  });
});
