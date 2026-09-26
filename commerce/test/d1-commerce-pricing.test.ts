import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import {
  priceRequestedCartFromD1,
  requirePurchasableCommerceProductFromD1,
} from "../src/data/commerce-pricing";

class Statement implements D1PreparedStatementLike {
  values: unknown[] = [];
  constructor(
    public readonly sql: string,
    private readonly rows: unknown[] = [],
  ) {}
  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }
  async first<T>(): Promise<T | null> {
    return (this.rows[0] as T | undefined) ?? null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.rows as T[] };
  }
  async run(): Promise<unknown> {
    return {};
  }
}

class Db implements D1DatabaseLike {
  readonly prepared: Statement[] = [];
  constructor(private readonly rows: unknown[]) {}
  prepare(query: string): Statement {
    const statement = new Statement(query, this.rows);
    this.prepared.push(statement);
    return statement;
  }
  async batch<T>(): Promise<T[]> {
    return [] as T[];
  }
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    productId: "prd-1",
    legacyId: "HC-001",
    slug: "highland-cow",
    publicationStatus: "ACTIVE",
    sellStatus: "AUTO",
    onlineOrderingEnabled: 1,
    productUpdatedAt: "2026-09-25T22:00:00.000Z",
    publishedVersionId: "pver-1",
    publishedVersionNumber: 2,
    title: "Highland Cow",
    shortDescription: "Published product",
    brand: "Leonardo",
    productType: "gifts",
    primaryCategory: "highland-cow",
    variantId: "var-1",
    sku: "LP001",
    priceMinor: 950,
    currency: "GBP",
    trackInventory: 0,
    onHand: null,
    reserved: null,
    safetyStock: null,
    balanceVersion: null,
    primaryImageUrl: "/images/cow.webp",
    ...overrides,
  };
}

describe("Phase 6 D1 Product resolver", () => {
  it("resolves the same published D1 product used by checkout for Admin quote editing", async () => {
    const db = new Db([row({ priceMinor: 1250 })]);

    await expect(
      requirePurchasableCommerceProductFromD1(db, "HC-001"),
    ).resolves.toMatchObject({
      id: "HC-001",
      name: "Highland Cow",
      priceMinor: 1250,
      purchasable: true,
    });

    expect(db.prepared).toHaveLength(1);
    expect(db.prepared[0].sql).toContain(
      "pv.id = p.current_published_version_id",
    );
    expect(db.prepared[0].sql).not.toContain(
      "current_draft_version_id",
    );
  });

  it("rejects unavailable D1 products for Admin quote additions/substitutions", async () => {
    await expect(
      requirePurchasableCommerceProductFromD1(
        new Db([row({ sellStatus: "OUT_OF_STOCK" })]),
        "HC-001",
      ),
    ).rejects.toThrow("out_of_stock");

    await expect(
      requirePurchasableCommerceProductFromD1(
        new Db([]),
        "MISSING",
      ),
    ).rejects.toThrow("catalog_product_not_found");
  });
});

describe("Phase 6 D1 checkout pricing", () => {
  it("uses the D1 server price and ignores any browser-side price concept", async () => {
    const db = new Db([row({ priceMinor: 1250 })]);

    const priced = await priceRequestedCartFromD1(db, [
      { productId: "HC-001", quantity: 2 },
    ]);

    expect(priced).toEqual({
      currency: "GBP",
      itemsSubtotalMinor: 2500,
      lines: [
        {
          productId: "HC-001",
          sku: "LP001",
          slug: "highland-cow",
          productName: "Highland Cow",
          unitPriceMinor: 1250,
          quantity: 2,
          lineTotalMinor: 2500,
        },
      ],
    });
  });

  it("enforces requested quantity against live Available for tracked stock", async () => {
    const db = new Db([
      row({
        trackInventory: 1,
        onHand: 3,
        reserved: 1,
        safetyStock: 0,
        balanceVersion: 5,
      }),
    ]);

    await expect(
      priceRequestedCartFromD1(db, [
        { productId: "HC-001", quantity: 3 },
      ]),
    ).rejects.toThrow("out_of_stock");

    await expect(
      priceRequestedCartFromD1(db, [
        { productId: "HC-001", quantity: 2 },
      ]),
    ).resolves.toMatchObject({
      itemsSubtotalMinor: 1900,
    });
  });

  it("preserves untracked AUTO orderability", async () => {
    const db = new Db([row({ trackInventory: 0 })]);

    await expect(
      priceRequestedCartFromD1(db, [
        { productId: "HC-001", quantity: 5 },
      ]),
    ).resolves.toMatchObject({
      itemsSubtotalMinor: 4750,
    });
  });

  it("blocks manual selling states and unavailable prices", async () => {
    await expect(
      priceRequestedCartFromD1(
        new Db([row({ sellStatus: "ARRIVING_SOON" })]),
        [{ productId: "HC-001", quantity: 1 }],
      ),
    ).rejects.toThrow("arriving_soon");

    await expect(
      priceRequestedCartFromD1(
        new Db([row({ sellStatus: "OUT_OF_STOCK" })]),
        [{ productId: "HC-001", quantity: 1 }],
      ),
    ).rejects.toThrow("out_of_stock");

    await expect(
      priceRequestedCartFromD1(
        new Db([row({ priceMinor: null })]),
        [{ productId: "HC-001", quantity: 1 }],
      ),
    ).rejects.toThrow("price_unavailable");
  });

  it("fails when a requested public id is missing from Product Core", async () => {
    await expect(
      priceRequestedCartFromD1(
        new Db([]),
        [{ productId: "MISSING", quantity: 1 }],
      ),
    ).rejects.toThrow("catalog_product_not_found");
  });

  it("resolves both legacy public ids and future Product UUID ids in one batched query", async () => {
    const db = new Db([
      row(),
      row({
        productId: "prd-new",
        legacyId: null,
        slug: "new-product",
        title: "New Product",
        variantId: "var-new",
        sku: null,
        priceMinor: 500,
      }),
    ]);

    const priced = await priceRequestedCartFromD1(db, [
      { productId: "HC-001", quantity: 1 },
      { productId: "prd-new", quantity: 1 },
    ]);

    expect(priced.lines.map((line) => line.productId)).toEqual([
      "HC-001",
      "prd-new",
    ]);
    expect(db.prepared).toHaveLength(1);
    expect(db.prepared[0].sql).toContain("p.legacy_catalog_id IN");
    expect(db.prepared[0].sql).toContain("p.id IN");
  });
});
