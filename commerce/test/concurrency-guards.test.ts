import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { addDraftRevisionAdjustment } from "../src/data/order-revisions";
import { recordManualRefund } from "../src/data/refunds";
import {
  acceptCustomerReview,
  declineCustomerReview,
} from "../src/data/customer-review";
import { applyResendDeliveryEvent } from "../src/data/email-delivery";

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

abstract class LosingBatchDb implements D1DatabaseLike {
  readonly batches: Statement[][] = [];

  abstract prepare(query: string): Statement;

  async batch<T>(statements: D1PreparedStatementLike[]): Promise<T[]> {
    const batch = statements as Statement[];
    this.batches.push(batch);
    return batch.map((_, index) => ({
      success: true,
      meta: { changes: index === 0 ? 0 : 0 },
    })) as T[];
  }
}

class LosingRevisionDb extends LosingBatchDb {
  prepare(query: string): Statement {
    if (query.includes("FROM order_revisions r") && query.includes("JOIN orders o")) {
      return new Statement(query, {
        id: "rev-1",
        orderId: "order-1",
        revisionNumber: 1,
        state: "DRAFT",
        version: 1,
        mutationToken: null,
        currency: "GBP",
        itemsSubtotalMinor: 1000,
        deliveryAmountMinor: 0,
        adjustmentAmountMinor: 0,
        finalTotalMinor: 1000,
        customerMessage: null,
        internalNote: null,
        createdBy: "owner@example.com",
        createdAt: "2026-09-25T10:00:00.000Z",
        sentAt: null,
        acceptedAt: null,
        declinedAt: null,
        supersededAt: null,
        expiresAt: null,
        fulfilmentMethod: "collection",
        deliveryAddressLine1: null,
        deliveryAddressLine2: null,
        deliveryTown: null,
        deliveryCounty: null,
        deliveryPostcode: null,
        deliveryCountry: null,
        orderStatus: "UNDER_REVIEW",
      });
    }
    return new Statement(query);
  }
}

class LosingRefundDb extends LosingBatchDb {
  prepare(query: string): Statement {
    if (query.includes("FROM orders o") && query.includes("paidAmountMinor")) {
      return new Statement(query, {
        id: "order-1",
        publicReference: "BSR-CONCURRENCY",
        status: "PREPARING",
        paymentStatus: "PAID",
        currency: "GBP",
        paidAmountMinor: 5000,
        refundVersion: 0,
      });
    }
    if (query.includes("FROM refunds r")) {
      return new Statement(query, null, []);
    }
    return new Statement(query);
  }
}

class LosingReviewDb extends LosingBatchDb {
  prepare(query: string): Statement {
    if (query.includes("FROM customer_review_tokens t")) {
      return new Statement(query, {
        tokenId: "token-1",
        orderId: "order-1",
        publicReference: "BSR-CONCURRENCY",
        orderStatus: "AWAITING_PAYMENT",
        paymentStatus: "PAYMENT_REQUESTED",
        paymentRequestUrl: "https://pay.example.test/order-1",
        fulfilmentMessage: "Collection",
        customerName: "Customer",
        customerEmail: "customer@example.com",
        revisionId: "rev-1",
        revisionNumber: 1,
        revisionVersion: 1,
        revisionState: "SENT",
        customerMessage: "Please review.",
        fulfilmentMethod: "collection",
        itemsSubtotalMinor: 1000,
        deliveryAmountMinor: 0,
        adjustmentAmountMinor: 0,
        finalTotalMinor: 1000,
        expiresAt: "2099-09-30T00:00:00.000Z",
      });
    }
    return new Statement(query);
  }
}

class LosingWebhookDb extends LosingBatchDb {
  prepare(query: string): Statement {
    if (query.includes("FROM email_webhook_events")) {
      return new Statement(query, null);
    }
    if (query.includes("FROM order_messages")) {
      return new Statement(query, {
        id: "message-1",
        orderId: "order-1",
      });
    }
    return new Statement(query);
  }
}

describe("Admin V2 concurrency guards", () => {
  it("rejects a stale reviewed-order adjustment and token-guards every side effect", async () => {
    const db = new LosingRevisionDb();

    await expect(
      addDraftRevisionAdjustment(
        db,
        "BSR-CONCURRENCY",
        "rev-1",
        {
          expectedVersion: 1,
          kind: "DISCOUNT",
          label: "Availability adjustment",
          amountMinor: -100,
          internalReason: "Concurrent mutation test",
        },
        "owner@example.com",
      ),
    ).rejects.toThrow("revision_version_conflict");

    const batch = db.batches[0];
    expect(batch).toHaveLength(3);
    expect(batch[0].sql).toContain("mutation_token = ?");
    expect(batch[1].sql).toContain("mutation_token = ?");
    expect(batch[2].sql).toContain("mutation_token = ?");
  });

  it("rejects a stale concurrent refund and token-guards refund/event inserts", async () => {
    const db = new LosingRefundDb();

    await expect(
      recordManualRefund(
        db,
        "BSR-CONCURRENCY",
        {
          amountMinor: 1000,
          reasonCode: "GOODWILL",
          refundMethod: "ORIGINAL_METHOD",
        },
        "owner@example.com",
      ),
    ).rejects.toThrow("refund_version_conflict");

    const batch = db.batches[0];
    expect(batch).toHaveLength(3);
    expect(batch[0].sql).toContain("refund_version = ?");
    expect(batch[0].sql).toContain("refund_mutation_token = ?");
    expect(batch[1].sql).toContain("refund_mutation_token = ?");
    expect(batch[2].sql).toContain("refund_mutation_token = ?");
  });

  it("makes an accept loser fail instead of appending a duplicate acceptance event", async () => {
    const db = new LosingReviewDb();

    await expect(
      acceptCustomerReview(db, "abcdefghijklmnopqrstuvwxyzABCDEFGH1234567890"),
    ).rejects.toThrow("review_conflict");

    const batch = db.batches[0];
    expect(batch).toHaveLength(3);
    expect(batch[0].sql).toContain("mutation_token = ?");
    expect(batch[1].sql).toContain("mutation_token = ?");
    expect(batch[2].sql).toContain("mutation_token = ?");
  });

  it("makes a decline loser fail before order/token/event side effects can be owned", async () => {
    const db = new LosingReviewDb();

    await expect(
      declineCustomerReview(db, "abcdefghijklmnopqrstuvwxyzABCDEFGH1234567890"),
    ).rejects.toThrow("review_conflict");

    const batch = db.batches[0];
    expect(batch).toHaveLength(4);
    expect(batch[0].sql).toContain("mutation_token = ?");
    expect(batch[1].sql).toContain("mutation_token = ?");
    expect(batch[2].sql).toContain("mutation_token = ?");
    expect(batch[3].sql).toContain("mutation_token = ?");
  });

  it("treats a webhook insert loser as a duplicate and token-guards delivery side effects", async () => {
    const db = new LosingWebhookDb();

    const result = await applyResendDeliveryEvent(db, {
      webhookEventId: "evt-1",
      eventType: "email.delivered",
      providerMessageId: "resend-1",
      receivedAt: "2026-09-25T10:00:00.000Z",
    });

    expect(result).toEqual({
      duplicate: true,
      tracked: false,
      status: "DELIVERED",
    });

    const batch = db.batches[0];
    expect(batch).toHaveLength(3);
    expect(batch[0].sql).toContain("claim_token");
    expect(batch[1].sql).toContain("claim_token = ?");
    expect(batch[2].sql).toContain("claim_token = ?");
  });
});
