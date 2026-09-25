import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { sendOwnerCustomerMessage } from "../src/notifications/customer-message";

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
  async all<T>(): Promise<{ results: T[] }> {
    return { results: [] };
  }
  async run(): Promise<unknown> {
    return {};
  }
}

class Db implements D1DatabaseLike {
  batched: Statement[][] = [];
  prepare(query: string): Statement {
    return new Statement(query);
  }
  async batch<T>(statements: D1PreparedStatementLike[]): Promise<T[]> {
    this.batched.push(statements as Statement[]);
    return [] as T[];
  }
}

const order = {
  id: "order-1",
  publicReference: "BSR-260925-MESSAGE",
  customerName: "Jane Smith",
  customerEmail: "jane@example.com",
  finalTotalMinor: 1500,
  paymentRequestUrl: "https://pay.example.test/order-1",
  fulfilmentMethod: "collection",
  fulfilmentMessage: "Collect tomorrow afternoon",
  revisionNumber: 2,
  items: [],
};

describe("owner customer messages", () => {
  it("records the provider message id after a successful payment reminder", async () => {
    const db = new Db();
    const sent: any[] = [];

    const result = await sendOwnerCustomerMessage(
      {
        DB: db,
        EMAIL: {
          async send(message) {
            sent.push(message);
            return { id: "resend-msg-123" };
          },
        },
        ORDER_EMAIL_FROM: "orders@theblacksheepshop.co.uk",
      },
      order,
      {
        kind: "PAYMENT_REMINDER",
        subject: "Payment reminder",
        body: "Your reviewed order is waiting for payment.",
        actorEmail: "owner@example.com",
        reviewUrl:
          "https://api.theblacksheepshop.co.uk/review/abcdefghijklmnopqrstuvwxyzABCDEFGH",
      },
    );

    expect(result.providerMessageId).toBe("resend-msg-123");
    expect(sent).toHaveLength(1);
    expect(sent[0].replyTo).toMatchObject({
      email: "orders@theblacksheepshop.co.uk",
    });
    expect(sent[0].html).toContain("Review order &amp; pay");
    expect(db.batched).toHaveLength(1);
    expect(db.batched[0][0].sql).toContain("INSERT INTO order_messages");
    expect(db.batched[0][0].values).toContain("resend-msg-123");
    expect(db.batched[0][1].values).toContain("PAYMENT_REMINDER_EMAIL_SENT");
  });

  it("records a failed message after two provider failures", async () => {
    const db = new Db();
    let attempts = 0;

    await expect(
      sendOwnerCustomerMessage(
        {
          DB: db,
          EMAIL: {
            async send() {
              attempts += 1;
              throw new Error("provider failed");
            },
          },
          ORDER_EMAIL_FROM: "orders@theblacksheepshop.co.uk",
        },
        order,
        {
          kind: "CUSTOM_MESSAGE",
          subject: "Order message",
          body: "Please reply if you need any help.",
          actorEmail: "owner@example.com",
        },
      ),
    ).rejects.toThrow("customer_message_send_failed");

    expect(attempts).toBe(2);
    expect(db.batched).toHaveLength(1);
    expect(db.batched[0][0].sql).toContain("'FAILED'");
    expect(db.batched[0][1].values).toContain("CUSTOMER_MESSAGE_EMAIL_FAILED");
  });
});
