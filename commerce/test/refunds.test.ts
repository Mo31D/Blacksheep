import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
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

  async run(): Promise<unknown> {
    return {};
  }
}

interface RefundDbOptions {
  refunds?: any[];
  claimChanged?: boolean;
  idempotentRefundId?: string | null;
}

class RefundDb implements D1DatabaseLike {
  batched: Statement[] = [];
  private readonly refunds: any[];
  private readonly claimChanged: boolean;
  private readonly idempotentRefundId: string | null;

  constructor(options: RefundDbOptions = {}) {
    this.refunds = options.refunds ?? [];
    this.claimChanged = options.claimChanged ?? true;
    this.idempotentRefundId = options.idempotentRefundId ?? null;
  }

  prepare(query: string): Statement {
    if (query.includes("FROM orders o") && query.includes("paidAmountMinor")) {
      return new Statement(query, {
        id: "order-1",
        publicReference: "BSR-1",
        status: "PREPARING",
        paymentStatus: "PAID",
        currency: "GBP",
        paidAmountMinor: 3000,
        refundVersion: 0,
      });
    }

    if (
      query.includes("FROM refunds") &&
      query.includes("idempotency_key")
    ) {
      return new Statement(
        query,
        this.idempotentRefundId
          ? { id: this.idempotentRefundId }
          : null,
      );
    }

    if (query.includes("FROM refunds r")) {
      return new Statement(query, null, this.refunds);
    }

    return new Statement(query);
  }

  async batch<T>(statements: D1PreparedStatementLike[]): Promise<T[]> {
    this.batched = statements as Statement[];
    return statements.map((_, index) => ({
      meta: { changes: index === 0 ? (this.claimChanged ? 1 : 0) : 1 },
    })) as T[];
  }
}

describe("refund ledger", () => {
  it("records a partial refund with guarded side effects", async () => {
    const db = new RefundDb();

    const summary = await recordManualRefund(
      db,
      "BSR-1",
      {
        amountMinor: 1000,
        reasonCode: "ITEM_UNAVAILABLE",
        refundMethod: "ORIGINAL_METHOD",
        externalReference: "RF-1",
        idempotencyKey: "refund-test-0001",
      },
      "owner@example.com",
    );

    expect(summary.refundedMinor).toBe(1000);
    expect(summary.remainingRefundableMinor).toBe(2000);
    expect(summary.fullyRefunded).toBe(false);
    expect(summary.idempotentReplay).toBe(false);
    expect(summary.recordedRefundId).toBeTruthy();

    expect(db.batched).toHaveLength(3);
    expect(db.batched[0].sql).toContain("refund_version");
    expect(db.batched[0].sql).toContain("refund_mutation_token");
    expect(db.batched[1].sql).toContain("refund_mutation_token");
    expect(db.batched[2].sql).toContain("refund_mutation_token");
  });

  it("marks the payment fully refunded at the cumulative paid total", async () => {
    const db = new RefundDb({
      refunds: [
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
      ],
    });

    const summary = await recordManualRefund(
      db,
      "BSR-1",
      {
        amountMinor: 2000,
        reasonCode: "RETURNED_GOODS",
        refundMethod: "ORIGINAL_METHOD",
        idempotencyKey: "refund-test-0002",
      },
      "owner@example.com",
    );

    expect(summary.refundedMinor).toBe(3000);
    expect(summary.remainingRefundableMinor).toBe(0);
    expect(summary.fullyRefunded).toBe(true);
  });

  it("refuses to record more than the amount still refundable", async () => {
    const db = new RefundDb({
      refunds: [
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
      ],
    });

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

  it("rejects zero and negative refund amounts", async () => {
    for (const amountMinor of [0, -1]) {
      const db = new RefundDb();

      await expect(
        recordManualRefund(
          db,
          "BSR-1",
          {
            amountMinor,
            reasonCode: "OTHER",
            refundMethod: "CASH",
          },
          "owner@example.com",
        ),
      ).rejects.toThrow("refund_invalid_amount");

      expect(db.batched).toHaveLength(0);
    }
  });

  it("rejects the losing concurrent refund claim without side effects", async () => {
    const db = new RefundDb({ claimChanged: false });

    await expect(
      recordManualRefund(
        db,
        "BSR-1",
        {
          amountMinor: 500,
          reasonCode: "PRICE_CORRECTION",
          refundMethod: "ORIGINAL_METHOD",
        },
        "owner@example.com",
      ),
    ).rejects.toThrow("refund_version_conflict");

    expect(db.batched).toHaveLength(3);
    expect(db.batched[1].sql).toContain("refund_mutation_token");
    expect(db.batched[2].sql).toContain("refund_mutation_token");
  });

  it("replays an existing idempotent refund without creating another ledger entry", async () => {
    const existingRefund = {
      id: "refund-existing",
      amountMinor: 1000,
      currency: "GBP",
      reasonCode: "GOODWILL",
      refundMethod: "ORIGINAL_METHOD",
      externalReference: "RF-EXISTING",
      internalNote: null,
      createdBy: "owner@example.com",
      createdAt: "2026-09-25T01:00:00.000Z",
    };
    const db = new RefundDb({
      refunds: [existingRefund],
      idempotentRefundId: existingRefund.id,
    });

    const summary = await recordManualRefund(
      db,
      "BSR-1",
      {
        amountMinor: 1000,
        reasonCode: "GOODWILL",
        refundMethod: "ORIGINAL_METHOD",
        idempotencyKey: "refund-retry-0001",
      },
      "owner@example.com",
    );

    expect(summary.idempotentReplay).toBe(true);
    expect(summary.recordedRefundId).toBe(existingRefund.id);
    expect(summary.refundedMinor).toBe(1000);
    expect(db.batched).toHaveLength(0);
  });
});
