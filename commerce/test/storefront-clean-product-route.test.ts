import { describe, expect, it } from "vitest";
import type { D1DatabaseLike, D1PreparedStatementLike } from "../src/data/d1";
import { handleCleanProductRequest } from "../src/routes/storefront-product";

const dynamicProductRow = {
  productId: "prd-dynamic",
  legacyId: null,
  slug: "new-highland-cow",
  publicationStatus: "ACTIVE",
  sellStatus: "AUTO",
  onlineOrderingEnabled: 1,
  productUpdatedAt: "2026-09-27T12:00:00.000Z",
  publishedVersionId: "pver-dynamic-1",
  publishedVersionNumber: 2,
  title: "New Highland Cow",
  shortDescription: "A newly published product.",
  brand: "The Leonardo Collection",
  productType: "gifts",
  primaryCategory: "highland-cows",
  categorySlugs: "highland-cows",
  primaryStorefrontNodeId: "sfn-dynamic",
  storefrontNodeIds: "sfn-dynamic",
  variantId: "var-dynamic",
  sku: "LP-DYN",
  priceMinor: 950,
  currency: "GBP",
  trackInventory: 0,
  onHand: null,
  reserved: null,
  safetyStock: null,
  balanceVersion: null,
  primaryImageUrl: "/images/highland-cow.webp",
};

const legacyProductRow = {
  ...dynamicProductRow,
  productId: "prd-legacy",
  legacyId: "HC-099",
  slug: "legacy-highland-cow",
  publishedVersionId: "pver-legacy-1",
};

const nodeRow = {
  id: "sfn-dynamic",
  stableKey: "dynamic",
  name: "Highland Cows",
  slug: "highland-cows-new",
  parentNodeId: null,
  sortOrder: 10,
  showInNavigation: 1,
  shortDescription: "Highland Cow gifts.",
  imageUrl: null,
  legacyPath: null,
  publishedVersionId: "sfv-dynamic-1",
};

class Statement implements D1PreparedStatementLike {
  values: unknown[] = [];
  constructor(
    readonly sql: string,
    private readonly product: unknown | null,
    private readonly nodes: unknown[],
  ) {}
  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }
  async first<T>(): Promise<T | null> {
    return this.sql.includes("FROM products p") ? (this.product as T | null) : null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return {
      results: this.sql.includes("FROM storefront_nodes n")
        ? (this.nodes as T[])
        : [],
    };
  }
  async run(): Promise<unknown> {
    return {};
  }
}

class Db implements D1DatabaseLike {
  prepared: Statement[] = [];
  constructor(
    private readonly product: unknown | null,
    private readonly nodes: unknown[] = [nodeRow],
  ) {}
  prepare(sql: string): D1PreparedStatementLike {
    const statement = new Statement(sql, this.product, this.nodes);
    this.prepared.push(statement);
    return statement;
  }
  async batch<T>(): Promise<T[]> {
    return [] as T[];
  }
}

describe("CARD 12 clean product route", () => {
  it("stays unavailable while the route capability is disabled", async () => {
    const db = new Db(dynamicProductRow);
    const response = await handleCleanProductRequest(
      new Request("https://staging.example.test/products/new-highland-cow"),
      { DB: db },
    );
    expect(response.status).toBe(404);
    expect(db.prepared).toHaveLength(0);
  });

  it("renders an admin-native published product with canonical Product JSON-LD", async () => {
    const response = await handleCleanProductRequest(
      new Request("https://staging.example.test/products/new-highland-cow"),
      {
        DB: new Db(dynamicProductRow),
        STOREFRONT_CLEAN_PRODUCT_ROUTES_ENABLED: "true",
      },
    );
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain(
      '<link rel="canonical" href="https://theblacksheepshop.co.uk/products/new-highland-cow">',
    );
    expect(html).toContain("<h1>New Highland Cow</h1>");
    expect(html).toContain("£9.50");
    expect(html).toContain('"@type":"Product"');
    expect(html).toContain('"price":"9.50"');
    expect(html).toContain("/collections/highland-cows-new");
  });

  it("redirects imported legacy products to their established static page", async () => {
    const response = await handleCleanProductRequest(
      new Request("https://staging.example.test/products/legacy-highland-cow"),
      {
        DB: new Db(legacyProductRow),
        STOREFRONT_CLEAN_PRODUCT_ROUTES_ENABLED: "true",
      },
    );
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://theblacksheepshop.co.uk/products/legacy-highland-cow.html",
    );
  });

  it("canonicalizes www and trailing slash variants", async () => {
    const response = await handleCleanProductRequest(
      new Request("https://www.theblacksheepshop.co.uk/products/new-highland-cow/"),
      {
        DB: new Db(dynamicProductRow),
        STOREFRONT_CLEAN_PRODUCT_ROUTES_ENABLED: "true",
      },
    );
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://theblacksheepshop.co.uk/products/new-highland-cow",
    );
  });

  it("returns a noindex 404 for an unknown slug", async () => {
    const response = await handleCleanProductRequest(
      new Request("https://staging.example.test/products/missing"),
      {
        DB: new Db(null),
        STOREFRONT_CLEAN_PRODUCT_ROUTES_ENABLED: "true",
      },
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('content="noindex,follow"');
  });
});
