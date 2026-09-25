import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import {
  notifyPaymentConfirmed,
  notifyPaymentRequest,
} from "../src/notifications/payment";

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
  publicReference: "BSR-260924-ABCDEFGH",
  customerName: "Jane Smith",
  customerEmail: "jane@example.com",
  finalTotalMinor: 3495,
  paymentRequestUrl: "https://payment.example.test/order-1",
  fulfilmentMethod: "delivery",
  fulfilmentMessage: "Expected dispatch within 2 working days",
};

describe("payment notifications", () => {
  it("sends the exact final total and secure payment URL", async () => {
    const db = new Db();
    const sent: any[] = [];
    await notifyPaymentRequest(
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
    );

    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain("£34.95");
    expect(sent[0].text).toContain(order.paymentRequestUrl);
    expect(sent[0].text).toContain(order.fulfilmentMessage);
    expect(sent[0].text).toContain("delivery-returns.html");
    expect(sent[0].text).toContain("Paying confirms the reviewed order");
    expect(sent[0].to).toMatchObject({ email: order.customerEmail });
    expect(db.statements[0].values[1]).toBe("PAYMENT_REQUEST_EMAIL_SENT");
  });

  it("uses the secure customer review page as the primary CTA for revised orders", async () => {
    const db = new Db();
    const sent: any[] = [];
    const reviewUrl =
      "https://api.theblacksheepshop.co.uk/review/abcdefghijklmnopqrstuvwxyzABCDEFGH";

    await notifyPaymentRequest(
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
      {
        ...order,
        revisionNumber: 2,
        reviewUrl,
        customerMessage: "One requested item was unavailable, so we updated the order.",
      },
    );

    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain(reviewUrl);
    expect(sent[0].text).toContain("Review the confirmed version");
    expect(sent[0].html).toContain("Review changes &amp; pay");
    expect(sent[0].html).toContain(reviewUrl);
  });

  it("does not send a payment request without a final total and URL", async () => {
    const db = new Db();
    let sends = 0;
    await notifyPaymentRequest(
      {
        DB: db,
        EMAIL: {
          async send() {
            sends += 1;
            return {};
          },
        },
        ORDER_EMAIL_FROM: "orders@theblacksheepshop.co.uk",
      },
      { ...order, finalTotalMinor: null, paymentRequestUrl: null },
    );

    expect(sends).toBe(0);
    expect(db.statements).toHaveLength(0);
  });

  it("does not send a payment request without fulfilment timing", async () => {
    const db = new Db();
    let sends = 0;
    await notifyPaymentRequest(
      {
        DB: db,
        EMAIL: {
          async send() {
            sends += 1;
            return {};
          },
        },
        ORDER_EMAIL_FROM: "orders@theblacksheepshop.co.uk",
      },
      { ...order, fulfilmentMessage: null },
    );

    expect(sends).toBe(0);
    expect(db.statements).toHaveLength(0);
  });

  it("sends a payment-confirmed acknowledgment", async () => {
    const db = new Db();
    const sent: any[] = [];
    await notifyPaymentConfirmed(
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
    );

    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain("Payment received");
    expect(sent[0].text).toContain("Your order is confirmed");
    expect(db.statements[0].values[1]).toBe("PAYMENT_CONFIRMED_EMAIL_SENT");
  });
});
