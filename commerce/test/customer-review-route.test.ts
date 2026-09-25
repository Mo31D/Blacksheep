import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { handleCustomerReviewRequest } from "../src/routes/customer-review";

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

class ReviewDb implements D1DatabaseLike {
  readonly prepared: Statement[] = [];
  readonly batched: Statement[][] = [];

  constructor(private readonly available = true) {}

  prepare(query: string): Statement {
    let firstValue: unknown = null;
    let rows: unknown[] = [];

    if (query.includes("FROM customer_review_tokens t")) {
      firstValue = this.available
        ? {
            tokenId: "token-1",
            orderId: "order-1",
            publicReference: "BSR-260925-TEST",
            orderStatus: "AWAITING_PAYMENT",
            paymentStatus: "PAYMENT_REQUESTED",
            paymentRequestUrl: "https://pay.example.test/order-1",
            fulfilmentMessage: "Collect after 12:00",
            customerName: "Jane Smith",
            customerEmail: "jane@example.com",
            revisionId: "rev-1",
            revisionNumber: 2,
            revisionState: "SENT",
            customerMessage:
              "One requested item was unavailable, so we updated the order.",
            fulfilmentMethod: "collection",
            itemsSubtotalMinor: 150,
            deliveryAmountMinor: 0,
            adjustmentAmountMinor: 0,
            finalTotalMinor: 150,
            expiresAt: "2099-09-30T00:00:00.000Z",
          }
        : null;
    } else if (query.includes("FROM order_items")) {
      rows = [
        {
          lineNumber: 1,
          productName: "Lakeland Rock",
          quantity: 2,
          unitPriceMinor: 150,
          lineTotalMinor: 300,
        },
      ];
    } else if (query.includes("FROM order_revision_items")) {
      rows = [
        {
          lineNumber: 1,
          productName: "Lakeland Rock",
          requestedQuantity: 2,
          confirmedQuantity: 1,
          availabilityStatus: "REDUCED",
          customerNote: "Only one is available today.",
          unitPriceMinor: 150,
          lineTotalMinor: 150,
        },
      ];
    }

    const statement = new Statement(query, firstValue, rows);
    this.prepared.push(statement);
    return statement;
  }

  async batch<T>(statements: D1PreparedStatementLike[]): Promise<T[]> {
    this.batched.push(statements as Statement[]);
    return [] as T[];
  }
}

const token = "abcdefghijklmnopqrstuvwxyzABCDEFGH1234567890";

describe("customer review route", () => {
  it("renders a private mobile review page without exposing customer contact details", async () => {
    const response = await handleCustomerReviewRequest(
      new Request("https://api.example.com/review/" + token),
      { DB: new ReviewDb() },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");

    const html = await response.text();
    expect(html).toContain("Review your order");
    expect(html).toContain("Only one is available today.");
    expect(html).toContain("Accept changes &amp; pay securely");
    expect(html).toContain("£1.50");
    expect(html).not.toContain("jane@example.com");
  });

  it("returns a generic unavailable page for expired or superseded tokens", async () => {
    const response = await handleCustomerReviewRequest(
      new Request("https://api.example.com/review/" + token),
      { DB: new ReviewDb(false) },
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toContain(
      "This review link is no longer available",
    );
  });

  it("accepts the current reviewed version and returns only an HTTPS payment target", async () => {
    const db = new ReviewDb();
    const response = await handleCustomerReviewRequest(
      new Request("https://api.example.com/review/" + token + "/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      { DB: db },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      paymentRequestUrl: "https://pay.example.test/order-1",
      reference: "BSR-260925-TEST",
    });
    expect(db.batched.length).toBeGreaterThan(0);
  });

  it("records a customer question against the order and revision", async () => {
    const db = new ReviewDb();
    const response = await handleCustomerReviewRequest(
      new Request("https://api.example.com/review/" + token + "/question", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: "Could I collect tomorrow afternoon instead?",
        }),
      }),
      { DB: db },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      reference: "BSR-260925-TEST",
    });

    const batchedSql = db.batched
      .flat()
      .map((statement) => statement.sql)
      .join("\n");
    expect(batchedSql).toContain("INSERT INTO order_messages");
    expect(batchedSql).toContain("CUSTOMER_QUESTION_RECEIVED");
  });
});
