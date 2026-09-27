import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { handleCleanCollectionRequest } from "../src/routes/storefront-clean";

class Statement implements D1PreparedStatementLike {
  values: unknown[] = [];
  constructor(
    readonly sql: string,
    private readonly rows: unknown[] = [],
  ) {}
  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }
  async first<T>(): Promise<T | null> {
    return null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.rows as T[] };
  }
  async run(): Promise<unknown> {
    return {};
  }
}

const dynamicNode = {
  id: "sfn_dynamic",
  stableKey: "dynamic",
  name: "New Collection",
  slug: "new-collection",
  parentNodeId: null,
  sortOrder: 10,
  showInNavigation: 1,
  shortDescription: "A clean routed collection.",
  imageUrl: null,
  legacyPath: null,
  publishedVersionId: "sfv_dynamic_1",
};

const childNode = {
  ...dynamicNode,
  id: "sfn_child",
  stableKey: "child",
  name: "Child Collection",
  slug: "child-collection",
  parentNodeId: "sfn_dynamic",
  sortOrder: 20,
  publishedVersionId: "sfv_child_1",
};

const legacyNode = {
  ...dynamicNode,
  id: "sfn_gifts",
  stableKey: "gifts",
  name: "Gifts & Souvenirs",
  slug: "gifts",
  legacyPath: "/gifts.html",
  publishedVersionId: "sfv_gifts_1",
};

const productRow = {
  productId: "prd-1",
  legacyId: "HC-001",
  slug: "highland-cow",
  publicationStatus: "ACTIVE",
  sellStatus: "AUTO",
  onlineOrderingEnabled: 1,
  productUpdatedAt: "2026-09-27T12:00:00.000Z",
  publishedVersionId: "pver-1",
  publishedVersionNumber: 2,
  title: "Highland Cow",
  shortDescription: "A published product.",
  brand: "Leonardo",
  productType: "gifts",
  primaryCategory: "highland-cows",
  categorySlugs: "highland-cows",
  primaryStorefrontNodeId: "sfn_dynamic",
  storefrontNodeIds: "sfn_dynamic,sfn_child",
  variantId: "var-1",
  sku: "LP00001",
  priceMinor: 950,
  currency: "GBP",
  trackInventory: 0,
  onHand: null,
  reserved: null,
  safetyStock: null,
  balanceVersion: null,
  primaryImageUrl: "/images/highland-cow.webp",
};

class Db implements D1DatabaseLike {
  prepared: Statement[] = [];
  constructor(
    private readonly nodes: unknown[] = [dynamicNode, childNode],
    private readonly products: unknown[] = [productRow],
  ) {}
  prepare(sql: string): Statement {
    const rows = sql.includes("FROM storefront_nodes n")
      ? this.nodes
      : sql.includes("FROM products p")
        ? this.products
        : [];
    const statement = new Statement(sql, rows);
    this.prepared.push(statement);
    return statement;
  }
  async batch<T>(): Promise<T[]> {
    return [] as T[];
  }
}

describe("CARD 12 clean collection route", () => {
  it("is unavailable while the route capability is disabled", async () => {
    const db = new Db();
    const response = await handleCleanCollectionRequest(
      new Request("https://staging.example.test/collections/new-collection"),
      { DB: db },
    );

    expect(response.status).toBe(404);
    expect(db.prepared).toHaveLength(0);
  });

  it("renders a canonical indexable collection page from published D1 data", async () => {
    const response = await handleCleanCollectionRequest(
      new Request("https://staging.example.test/collections/new-collection"),
      {
        DB: new Db(),
        STOREFRONT_CLEAN_COLLECTION_ROUTES_ENABLED: "true",
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();

    expect(html).toContain(
      '<link rel="canonical" href="https://theblacksheepshop.co.uk/collections/new-collection">',
    );
    expect(html).toContain(
      '<meta name="robots" content="index,follow,max-image-preview:large">',
    );
    expect(html).toContain("<h1>New Collection</h1>");
    expect(html).toContain("Child Collection");
    expect(html).toContain("Highland Cow");
    expect(html).toContain("/products/highland-cow.html");
    expect(html).toContain('"@type":"CollectionPage"');
    expect(html).toContain('"@type":"ItemList"');
  });

  it("redirects legacy Storefront nodes to their established indexed page", async () => {
    const response = await handleCleanCollectionRequest(
      new Request("https://staging.example.test/collections/gifts"),
      {
        DB: new Db([legacyNode], []),
        STOREFRONT_CLEAN_COLLECTION_ROUTES_ENABLED: "true",
      },
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://theblacksheepshop.co.uk/gifts.html",
    );
  });

  it("returns noindex 404 for an unpublished or unknown slug", async () => {
    const response = await handleCleanCollectionRequest(
      new Request("https://staging.example.test/collections/missing"),
      {
        DB: new Db(),
        STOREFRONT_CLEAN_COLLECTION_ROUTES_ENABLED: "true",
      },
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toContain('content="noindex,follow"');
  });
});
