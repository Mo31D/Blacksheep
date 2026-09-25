import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import {
  getPublicCommerceProduct,
  listPublicCommerceProducts,
  toPublicCommerceProduct,
} from "../src/data/public-catalog";

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

class PublicCatalogDb implements D1DatabaseLike {
  readonly prepared: Statement[] = [];

  constructor(
    private readonly row: Record<string, unknown> | null,
  ) {}

  prepare(query: string): Statement {
    const statement = new Statement(
      query,
      this.row,
      this.row ? [this.row] : [],
    );
    this.prepared.push(statement);
    return statement;
  }

  async batch<T>(): Promise<T[]> {
    return [] as T[];
  }
}

function row(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    productId: "prd-1",
    legacyId: "LEGACY-1",
    slug: "published-product",
    publicationStatus: "ACTIVE",
    sellStatus: "AUTO",
    onlineOrderingEnabled: 1,
    productUpdatedAt: "2026-09-25T22:00:00.000Z",
    publishedVersionId: "pver-published",
    publishedVersionNumber: 3,
    title: "Published title",
    shortDescription: "Published description",
    brand: "Brand",
    productType: "gifts",
    primaryCategory: "highland-cow",
    variantId: "var-1",
    sku: "SKU-1",
    priceMinor: 950,
    currency: "GBP",
    trackInventory: 0,
    onHand: null,
    reserved: null,
    safetyStock: null,
    balanceVersion: null,
    primaryImageUrl: "/images/product.webp",
    ...overrides,
  };
}

describe("Phase 6 public commerce state", () => {
  it("keeps untracked AUTO products orderable when online and priced", () => {
    expect(toPublicCommerceProduct(row() as any)).toMatchObject({
      id: "LEGACY-1",
      name: "Published title",
      priceMinor: 950,
      status: "available",
      purchasable: true,
      nonPurchasableReason: null,
      inventory: {
        tracked: false,
        available: null,
      },
    });
  });

  it("uses Available = On hand - Reserved - Safety stock for tracked products", () => {
    expect(
      toPublicCommerceProduct(
        row({
          trackInventory: 1,
          onHand: 5,
          reserved: 2,
          safetyStock: 1,
          balanceVersion: 7,
        }) as any,
      ),
    ).toMatchObject({
      purchasable: true,
      inventory: { tracked: true, available: 2 },
    });
  });

  it("fails tracked AUTO products closed when Available reaches zero", () => {
    expect(
      toPublicCommerceProduct(
        row({
          trackInventory: 1,
          onHand: 3,
          reserved: 2,
          safetyStock: 1,
          balanceVersion: 4,
        }) as any,
      ),
    ).toMatchObject({
      status: "out-of-stock",
      purchasable: false,
      nonPurchasableReason: "out_of_stock",
      inventory: { tracked: true, available: 0 },
    });
  });

  it("treats a tracked product without a balance as unavailable", () => {
    expect(
      toPublicCommerceProduct(
        row({
          trackInventory: 1,
          onHand: null,
          reserved: null,
          safetyStock: null,
          balanceVersion: null,
        }) as any,
      ),
    ).toMatchObject({
      status: "out-of-stock",
      purchasable: false,
      nonPurchasableReason: "out_of_stock",
      inventory: { tracked: true, available: 0 },
    });
  });

  it("gives manual ARRIVING_SOON and OUT_OF_STOCK precedence over inventory", () => {
    expect(
      toPublicCommerceProduct(
        row({
          sellStatus: "ARRIVING_SOON",
          trackInventory: 1,
          onHand: 20,
          reserved: 0,
          safetyStock: 0,
        }) as any,
      ),
    ).toMatchObject({
      status: "arriving-soon",
      purchasable: false,
      nonPurchasableReason: "arriving_soon",
    });

    expect(
      toPublicCommerceProduct(
        row({
          sellStatus: "OUT_OF_STOCK",
          trackInventory: 1,
          onHand: 20,
          reserved: 0,
          safetyStock: 0,
        }) as any,
      ),
    ).toMatchObject({
      status: "out-of-stock",
      purchasable: false,
      nonPurchasableReason: "out_of_stock",
    });
  });

  it("blocks online ordering and missing price independently of inventory", () => {
    expect(
      toPublicCommerceProduct(
        row({ onlineOrderingEnabled: 0 }) as any,
      ),
    ).toMatchObject({
      purchasable: false,
      nonPurchasableReason: "online_ordering_disabled",
    });

    expect(
      toPublicCommerceProduct(
        row({ priceMinor: null }) as any,
      ),
    ).toMatchObject({
      purchasable: false,
      nonPurchasableReason: "price_unavailable",
    });
  });

  it("maps NOT_FOR_SALE explicitly", () => {
    expect(
      toPublicCommerceProduct(
        row({ sellStatus: "NOT_FOR_SALE" }) as any,
      ),
    ).toMatchObject({
      status: "not-for-sale",
      purchasable: false,
      nonPurchasableReason: "not_for_sale",
    });
  });
});

describe("Phase 6 published-only D1 query", () => {
  it("reads current_published_version_id and never falls back to Draft content", async () => {
    const db = new PublicCatalogDb(row());

    const product = await getPublicCommerceProduct(db, "LEGACY-1");

    expect(product?.name).toBe("Published title");
    const sql = db.prepared[0].sql;
    expect(sql).toContain(
      "pv.id = p.current_published_version_id",
    );
    expect(sql).not.toContain("current_draft_version_id");
    expect(sql).not.toContain("COALESCE(p.current_draft_version_id");
    expect(sql).toContain("p.publication_status = 'ACTIVE'");
    expect(db.prepared[0].values).toEqual([
      "LEGACY-1",
      "LEGACY-1",
    ]);
  });

  it("uses the published version for categories and primary media", async () => {
    const db = new PublicCatalogDb(row());

    await getPublicCommerceProduct(db, "LEGACY-1");

    const sql = db.prepared[0].sql;
    expect(sql).toContain(
      "pvc.product_version_id = pv.id",
    );
    expect(sql).toContain(
      "pvm.product_version_id = pv.id",
    );
  });

  it("lists only ACTIVE published products and supports safe pagination", async () => {
    const db = new PublicCatalogDb(row());

    const result = await listPublicCommerceProducts(db, {
      query: "published",
      limit: 25,
      cursor: 0,
    });

    expect(result.products).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
    const sql = db.prepared[0].sql;
    expect(sql).toContain("p.publication_status = 'ACTIVE'");
    expect(sql).toContain(
      "p.current_published_version_id IS NOT NULL",
    );
    expect(sql).not.toContain("current_draft_version_id");
    expect(db.prepared[0].values).toEqual([
      "%published%",
      "%published%",
      "%published%",
      "%published%",
      26,
      0,
    ]);
  });

  it("does not expose archived or draft-only rows when D1 returns no public match", async () => {
    const db = new PublicCatalogDb(null);

    await expect(
      getPublicCommerceProduct(db, "prd-private"),
    ).resolves.toBeNull();
  });
});
