import { describe, expect, it } from "vitest";
import {
  calculateRevisionTotals,
  validateRevisionItem,
} from "../src/domain/order-revision";
import {
  createDraftRevisionFromOriginal,
  listOrderRevisions,
} from "../src/data/order-revisions";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";

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

class RevisionDb implements D1DatabaseLike {
  prepared: Statement[] = [];
  batched: Statement[] = [];

  prepare(query: string): Statement {
    let firstValue: unknown = null;
    let rows: unknown[] = [];

    if (query.includes("FROM orders") && query.includes("public_reference")) {
      firstValue = {
        id: "order-1",
        currency: "GBP",
        fulfilmentMethod: "collection",
        deliveryAmountMinor: null,
      };
    } else if (query.includes("FROM order_items")) {
      rows = [
        {
          id: 11,
          lineNumber: 1,
          catalogProductId: "rock-1",
          sku: null,
          slug: "lakeland-rock",
          productName: "Lakeland Rock",
          unitPriceMinor: 150,
          quantity: 2,
        },
      ];
    } else if (query.includes("MAX(revision_number)")) {
      firstValue = { revisionNumber: 2 };
    } else if (query.includes("state = 'DRAFT'")) {
      firstValue = null;
    } else if (query.includes("FROM order_revisions r")) {
      rows = [
        {
          id: "rev-3",
          revisionNumber: 3,
          state: "DRAFT",
          version: 1,
          itemsSubtotalMinor: 300,
          deliveryAmountMinor: 0,
          adjustmentAmountMinor: 0,
          finalTotalMinor: 300,
          customerMessage: null,
          internalNote: null,
          createdBy: "owner@example.com",
          createdAt: "2026-09-25T02:00:00.000Z",
          sentAt: null,
          acceptedAt: null,
          supersededAt: null,
        },
      ];
    }

    const statement = new Statement(query, firstValue, rows);
    this.prepared.push(statement);
    return statement;
  }

  async batch<T>(statements: D1PreparedStatementLike[]): Promise<T[]> {
    this.batched = statements as Statement[];
    return [] as T[];
  }
}

describe("order revision domain", () => {
  it("calculates totals from confirmed quantities only", () => {
    const totals = calculateRevisionTotals({
      items: [
        {
          unitPriceMinor: 500,
          requestedQuantity: 2,
          confirmedQuantity: 1,
          availabilityStatus: "REDUCED",
        },
        {
          unitPriceMinor: 250,
          requestedQuantity: 1,
          confirmedQuantity: 0,
          availabilityStatus: "UNAVAILABLE",
        },
      ],
      deliveryAmountMinor: 395,
      adjustmentAmountMinor: -100,
    });

    expect(totals.itemsSubtotalMinor).toBe(500);
    expect(totals.finalTotalMinor).toBe(795);
  });

  it("rejects inconsistent availability dispositions", () => {
    expect(() =>
      validateRevisionItem({
        unitPriceMinor: 500,
        requestedQuantity: 2,
        confirmedQuantity: 2,
        availabilityStatus: "REDUCED",
      }),
    ).toThrow("revision_reduced_requires_lower_quantity");

    expect(() =>
      validateRevisionItem({
        unitPriceMinor: 500,
        requestedQuantity: 1,
        confirmedQuantity: 1,
        availabilityStatus: "UNAVAILABLE",
      }),
    ).toThrow("revision_unavailable_requires_zero_confirmed");
  });
});

describe("order revision repository", () => {
  it("creates an immutable draft from original order items", async () => {
    const db = new RevisionDb();

    const result = await createDraftRevisionFromOriginal(
      db,
      "BSR-260925-TEST",
      "owner@example.com",
    );

    expect(result.revisionNumber).toBe(3);
    expect(result.state).toBe("DRAFT");
    expect(result.itemsSubtotalMinor).toBe(300);
    expect(result.deliveryAmountMinor).toBe(0);
    expect(result.finalTotalMinor).toBe(300);

    expect(db.batched).toHaveLength(3);
    expect(db.batched[0].sql).toContain("INSERT INTO order_revisions");
    expect(db.batched[1].sql).toContain("INSERT INTO order_revision_items");
    expect(db.batched[2].sql).toContain("ORDER_REVISION_DRAFT_CREATED");
  });

  it("lists revisions newest first", async () => {
    const db = new RevisionDb();
    const revisions = await listOrderRevisions(db, "BSR-260925-TEST");

    expect(revisions).toHaveLength(1);
    expect(revisions[0].revisionNumber).toBe(3);
    const statement = db.prepared.find((entry) =>
      entry.sql.includes("FROM order_revisions r"),
    );
    expect(statement?.values).toEqual(["BSR-260925-TEST"]);
  });
});
