import { describe, expect, it } from "vitest";
import {
  createSubmittedOrder,
  findOrderByIdempotencyKey,
} from "../src/data/orders";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";

class FakeStatement implements D1PreparedStatementLike {
  values: unknown[] = [];

  constructor(
    public readonly sql: string,
    private readonly firstResult: unknown = null,
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    return (this.firstResult as T | null) ?? null;
  }

  async run(): Promise<unknown> {
    return {};
  }
}

class FakeDb implements D1DatabaseLike {
  prepared: FakeStatement[] = [];
  batched: FakeStatement[] = [];
  nextFirstResult: unknown = null;

  prepare(query: string): FakeStatement {
    const statement = new FakeStatement(query, this.nextFirstResult);
    this.nextFirstResult = null;
    this.prepared.push(statement);
    return statement;
  }

  async batch<T>(statements: D1PreparedStatementLike[]): Promise<T[]> {
    this.batched = statements as FakeStatement[];
    return [] as T[];
  }
}

const input = {
  id: "48f112bf-3eae-4aa4-8338-b2a37c2f2d19",
  publicReference: "BSR-240926-7K42",
  idempotencyKey: "idem-123456789",
  currency: "GBP",
  fulfilmentMethod: "delivery" as const,
  customerName: "Jane Smith",
  customerEmail: "jane@example.com",
  customerPhone: "07123456789",
  deliveryAddress: {
    line1: "12 Example Road",
    town: "Kendal",
    postcode: "LA9 4AA",
    country: "GB",
  },
  itemsSubtotalMinor: 3275,
  items: [
    {
      catalogProductId: "PR-001",
      sku: "SKU-1",
      slug: "peter-rabbit-example",
      productName: "Peter Rabbit Example",
      unitPriceMinor: 995,
      quantity: 2,
      lineTotalMinor: 1990,
    },
    {
      catalogProductId: "HC-001",
      sku: "SKU-2",
      slug: "highland-cow-example",
      productName: "Highland Cow Example",
      unitPriceMinor: 1285,
      quantity: 1,
      lineTotalMinor: 1285,
    },
  ],
  createdAt: "2026-09-24T18:00:00.000Z",
};

describe("D1 order repository", () => {
  it("creates order, item snapshots and first event in one batch", async () => {
    const db = new FakeDb();

    const created = await createSubmittedOrder(db, input);

    expect(created).toEqual({
      id: input.id,
      publicReference: input.publicReference,
      status: "SUBMITTED",
      createdAt: input.createdAt,
    });

    expect(db.batched).toHaveLength(4);
    expect(db.batched[0].sql).toContain("INSERT INTO orders");
    expect(db.batched[1].sql).toContain("INSERT INTO order_items");
    expect(db.batched[2].sql).toContain("INSERT INTO order_items");
    expect(db.batched[3].sql).toContain("INSERT INTO order_events");
    expect(db.batched[0].values).toContain(input.idempotencyKey);
  });

  it("rejects subtotal drift before writing", async () => {
    const db = new FakeDb();

    await expect(
      createSubmittedOrder(db, {
        ...input,
        itemsSubtotalMinor: 1,
      }),
    ).rejects.toThrow("itemsSubtotalMinor");

    expect(db.batched).toHaveLength(0);
  });

  it("looks up an existing order by idempotency key", async () => {
    const db = new FakeDb();
    db.nextFirstResult = {
      id: input.id,
      publicReference: input.publicReference,
      status: "SUBMITTED",
      createdAt: input.createdAt,
    };

    const result = await findOrderByIdempotencyKey(db, input.idempotencyKey);

    expect(result?.publicReference).toBe(input.publicReference);
    expect(db.prepared[0].sql).toContain("idempotency_key");
    expect(db.prepared[0].values).toEqual([input.idempotencyKey]);
  });
});
