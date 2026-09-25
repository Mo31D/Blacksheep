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

  constructor(
    private readonly available = true,
    private readonly mutationChanged = true,
    private readonly revisionState = "SENT",
  ) {}

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
            revisionVersion: 4,
            revisionState: this.revisionState,
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
    const batch = statements as Statement[];
    this.batched.push(batch);
    return batch.map((_, index) => ({
      meta: {
        changes: index === 0 ? (this.mutationChanged ? 1 : 0) : 1,
      },
    })) as T[];
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

  it("accepts the current reviewed version with mutation-token guarded side effects", async () => {
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

    expect(db.batched).toHaveLength(1);
    expect(db.batched[0][0].sql).toContain("mutation_token");
    expect(db.batched[0][1].sql).toContain("mutation_token");
    expect(db.batched[0][2].sql).toContain("mutation_token");
  });

  it("returns a conflict when an accept loses a concurrent revision race", async () => {
    const db = new ReviewDb(true, false, "SENT");
    const response = await handleCustomerReviewRequest(
      new Request("https://api.example.com/review/" + token + "/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      { DB: db },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "review_conflict" },
    });
  });

  it("returns a conflict when a decline loses a concurrent revision race", async () => {
    const db = new ReviewDb(true, false, "SENT");
    const response = await handleCustomerReviewRequest(
      new Request("https://api.example.com/review/" + token + "/decline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      { DB: db },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "review_conflict" },
    });

    expect(db.batched[0][1].sql).toContain("mutation_token");
    expect(db.batched[0][2].sql).toContain("mutation_token");
    expect(db.batched[0][3].sql).toContain("mutation_token");
  });

  it("treats an already accepted review as an idempotent accept", async () => {
    const db = new ReviewDb(true, true, "ACCEPTED");
    const response = await handleCustomerReviewRequest(
      new Request("https://api.example.com/review/" + token + "/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      { DB: db },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      reference: "BSR-260925-TEST",
    });
    expect(db.batched).toHaveLength(0);
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
