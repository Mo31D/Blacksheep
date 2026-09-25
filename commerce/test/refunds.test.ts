import { describe, expect, it } from "vitest";
import type { D1DatabaseLike, D1PreparedStatementLike } from "../src/data/d1";
import { recordManualRefund } from "../src/data/refunds";

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
  async run(): Promise<unknown> { return {}; }
}

class RefundDb implements D1DatabaseLike {
  batched: Statement[] = [];
  refunds: any[];
  constructor(refunds: any[] = []) { this.refunds = refunds; }
  prepare(query: string): Statement {
    if (query.includes("FROM orders o") && query.includes("paidAmountMinor")) {
      return new Statement(query, {
        id: "order-1",
        publicReference: "BSR-1",
        status: "PREPARING",
        paymentStatus: "PAID",
        currency: "GBP",
        paidAmountMinor: 3000,
      });
    }
    if (query.includes("FROM refunds r")) {
      return new Statement(query, null, this.refunds);
    }
    return new Statement(query);
  }
  async batch<T>(statements: D1PreparedStatementLike[]): Promise<T[]> {
    this.batched = statements as Statement[];
    return [] as T[];
  }
}

describe("refund ledger", () => {
  it("records a partial refund while preserving PAID state", async () => {
    const db = new RefundDb();
    const summary = await recordManualRefund(
      db,
      "BSR-1",
      {
        amountMinor: 1000,
        reasonCode: "ITEM_UNAVAILABLE",
        refundMethod: "ORIGINAL_METHOD",
        externalReference: "RF-1",
      },
      "owner@example.com",
    );

    expect(summary.refundedMinor).toBe(1000);
    expect(summary.remainingRefundableMinor).toBe(2000);
    expect(summary.fullyRefunded).toBe(false);
    expect(db.batched).toHaveLength(3);
    expect(db.batched[1].values[0]).toBe("PAID");
    expect(db.batched[2].values[1]).toBe("PAYMENT_PARTIALLY_REFUNDED");
  });

  it("marks payment refunded when cumulative refunds reach the paid total", async () => {
    const db = new RefundDb([
      {
        id: "refund-old",
        amountMinor: 1000,
        currency: "GBP",
        reasonCode: "GOODWILL",
        refundMethod: "ORIGINAL_METHOD",
        externalReference: null,
        internalNote: null,
        createdBy: "owner@example.com",
        createdAt: "2026-09-25T01:00:00.000Z",
      },
    ]);

    const summary = await recordManualRefund(
      db,
      "BSR-1",
      {
        amountMinor: 2000,
        reasonCode: "RETURNED_GOODS",
        refundMethod: "ORIGINAL_METHOD",
      },
      "owner@example.com",
    );

    expect(summary.refundedMinor).toBe(3000);
    expect(summary.remainingRefundableMinor).toBe(0);
    expect(summary.fullyRefunded).toBe(true);
    expect(db.batched[1].values[0]).toBe("REFUNDED");
    expect(db.batched[2].values[1]).toBe("PAYMENT_REFUNDED");
  });

  it("refuses to record more than the amount still refundable", async () => {
    const db = new RefundDb([
      {
        id: "refund-old",
        amountMinor: 2500,
        currency: "GBP",
        reasonCode: "GOODWILL",
        refundMethod: "ORIGINAL_METHOD",
        externalReference: null,
        internalNote: null,
        createdBy: "owner@example.com",
        createdAt: "2026-09-25T01:00:00.000Z",
      },
    ]);

    await expect(
      recordManualRefund(
        db,
        "BSR-1",
        {
          amountMinor: 600,
          reasonCode: "OTHER",
          refundMethod: "CASH",
        },
        "owner@example.com",
      ),
    ).rejects.toThrow("refund_exceeds_remaining_amount");
    expect(db.batched).toHaveLength(0);
  });
});
