import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { createCustomerReviewToken } from "../src/data/customer-review";

class Statement implements D1PreparedStatementLike {
  values: unknown[] = [];
  constructor(
    public readonly sql: string,
    private readonly firstValue: unknown = null,
  ) {}
  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }
  async first<T>(): Promise<T | null> {
    return (this.firstValue as T | null) ?? null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: [] };
  }
  async run(): Promise<unknown> {
    return {};
  }
}

class TokenDb implements D1DatabaseLike {
  readonly prepared: Statement[] = [];
  readonly batched: Statement[][] = [];

  constructor(private readonly revisionExpiresAt: string | null) {}

  prepare(query: string): Statement {
    const firstValue = query.includes("FROM orders o")
      ? {
          orderId: "order-1",
          revisionId: "rev-1",
          revisionNumber: 2,
          revisionExpiresAt: this.revisionExpiresAt,
        }
      : null;
    const statement = new Statement(query, firstValue);
    this.prepared.push(statement);
    return statement;
  }

  async batch<T>(statements: D1PreparedStatementLike[]): Promise<T[]> {
    this.batched.push(statements as Statement[]);
    return [] as T[];
  }
}

describe("Phase 5 customer review expiry alignment", () => {
  it("uses the exact revision expiry for a reservation-aware reviewed quote", async () => {
    const expiry = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    const db = new TokenDb(expiry);

    const result = await createCustomerReviewToken(db, "BSR-EXPIRY", 168);

    expect(result.expiresAt).toBe(expiry);
    expect(db.batched).toHaveLength(1);

    const tokenInsert = db.batched[0].find((statement) =>
      statement.sql.includes("INSERT INTO customer_review_tokens"),
    );
    expect(tokenInsert).toBeDefined();
    expect(tokenInsert!.values).toContain(expiry);

    const lookup = db.prepared.find((statement) =>
      statement.sql.includes("FROM orders o"),
    );
    expect(lookup?.sql).toContain("r.expires_at AS revisionExpiresAt");
  });

  it("keeps the legacy TTL behavior when the revision has no fixed expiry", async () => {
    const db = new TokenDb(null);
    const before = Date.now();

    const result = await createCustomerReviewToken(db, "BSR-LEGACY", 2);

    const expiry = Date.parse(result.expiresAt);
    expect(expiry).toBeGreaterThanOrEqual(before + 2 * 60 * 60 * 1000 - 2000);
    expect(expiry).toBeLessThanOrEqual(Date.now() + 2 * 60 * 60 * 1000 + 2000);
  });

  it("refuses to mint a fresh token for an already expired reservation-aware revision", async () => {
    const db = new TokenDb(
      new Date(Date.now() - 60 * 1000).toISOString(),
    );

    await expect(
      createCustomerReviewToken(db, "BSR-EXPIRED", 168),
    ).rejects.toThrow("review_revision_expired");

    expect(db.batched).toHaveLength(0);
  });
});
