import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { handleDynamicSitemapRequest } from "../src/routes/storefront-sitemap";

class Statement implements D1PreparedStatementLike {
  private values: unknown[] = [];

  constructor(private readonly rows: unknown[]) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    return null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    const limit = Number(this.values.at(-2));
    const offset = Number(this.values.at(-1));
    if (Number.isFinite(limit) && Number.isFinite(offset)) {
      return {
        results: this.rows.slice(offset, offset + limit) as T[],
      };
    }
    return { results: this.rows as T[] };
  }

  async run(): Promise<unknown> {
    return {};
  }
}

class Db implements D1DatabaseLike {
  constructor(
    private readonly nodeRows: unknown[],
    private readonly productRows: unknown[],
  ) {}

  prepare(sql: string): D1PreparedStatementLike {
    return new Statement(
      sql.includes("FROM products p") ? this.productRows : this.nodeRows,
    );
  }

  async batch<T>(): Promise<T[]> {
    return [] as T[];
  }
}

const publishedNodes = [
  {
    id: "legacy",
    stableKey: "gifts",
    name: "Gifts",
    slug: "gifts",
    parentNodeId: null,
    sortOrder: 10,
    showInNavigation: 1,
    shortDescription: "Legacy gifts.",
    imageUrl: null,
    legacyPath: "/gifts.html",
    publishedVersionId: "legacy-v1",
  },
  {
    id: "dynamic-b",
    stableKey: "dynamic-b",
    name: "New & Special",
    slug: "new-and-special",
    parentNodeId: null,
    sortOrder: 30,
    showInNavigation: 1,
    shortDescription: "Dynamic collection.",
    imageUrl: null,
    legacyPath: null,
    publishedVersionId: "dynamic-b-v1",
  },
  {
    id: "dynamic-a",
    stableKey: "dynamic-a",
    name: "Christmas",
    slug: "christmas",
    parentNodeId: null,
    sortOrder: 20,
    showInNavigation: 1,
    shortDescription: "Seasonal collection.",
    imageUrl: null,
    legacyPath: null,
    publishedVersionId: "dynamic-a-v1",
  },
];

const productBase = {
  publicationStatus: "ACTIVE",
  sellStatus: "AVAILABLE",
  onlineOrderingEnabled: 1,
  productUpdatedAt: "2026-09-27T00:00:00.000Z",
  publishedVersionId: "pv-1",
  publishedVersionNumber: 1,
  title: "Product",
  shortDescription: "Published product.",
  brand: null,
  productType: "gifts",
  primaryCategory: "gifts",
  categorySlugs: "gifts",
  primaryStorefrontNodeId: "legacy",
  storefrontNodeIds: "legacy",
  variantId: "variant-1",
  sku: "SKU",
  priceMinor: 995,
  currency: "GBP",
  trackInventory: 0,
  onHand: null,
  reserved: null,
  safetyStock: null,
  balanceVersion: null,
  primaryImageUrl: null,
};

const publishedProducts = [
  {
    ...productBase,
    productId: "product-legacy",
    legacyId: "HC-001",
    slug: "highland-cow-classic",
    title: "Legacy Highland Cow",
  },
  {
    ...productBase,
    productId: "product-native",
    legacyId: null,
    slug: "admin-created-gift",
    title: "Admin Created Gift",
    primaryStorefrontNodeId: "dynamic-a",
    storefrontNodeIds: "dynamic-a",
  },
];

function db(): Db {
  return new Db(publishedNodes, publishedProducts);
}

describe("CARD 12 published-state sitemap", () => {
  it("is unavailable while clean routes are disabled", async () => {
    const response = await handleDynamicSitemapRequest(
      new Request("https://example.test/sitemap.xml"),
      { DB: db() },
    );
    expect(response.status).toBe(404);
  });

  it("preserves legacy canonicals and adds clean D1 canonicals without duplicates", async () => {
    const response = await handleDynamicSitemapRequest(
      new Request("https://example.test/sitemap.xml"),
      {
        DB: db(),
        STOREFRONT_CLEAN_COLLECTION_ROUTES_ENABLED: "true",
        STOREFRONT_CLEAN_PRODUCT_ROUTES_ENABLED: "true",
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/xml");
    const xml = await response.text();

    expect(xml).toContain(
      "<loc>https://theblacksheepshop.co.uk/gifts.html</loc>",
    );
    expect(xml).toContain(
      "<loc>https://theblacksheepshop.co.uk/collections/christmas</loc>",
    );
    expect(xml).toContain(
      "<loc>https://theblacksheepshop.co.uk/collections/new-and-special</loc>",
    );
    expect(xml).not.toContain("/collections/gifts</loc>");

    expect(xml).toContain(
      "<loc>https://theblacksheepshop.co.uk/products/highland-cow-classic.html</loc>",
    );
    expect(xml).toContain(
      "<loc>https://theblacksheepshop.co.uk/products/admin-created-gift</loc>",
    );
    expect(xml).not.toContain("product.html?");

    expect((xml.match(/<loc>/g) || []).length).toBe(
      new Set([
        "/",
        "/all-products.html",
        "/about.html",
        "/visit.html",
        "/privacy.html",
        "/delivery-returns.html",
        "/terms.html",
        "/gifts.html",
        "/collections/christmas",
        "/collections/new-and-special",
        "/products/highland-cow-classic.html",
        "/products/admin-created-gift",
      ]).size,
    );
  });

  it("omits admin-native products until clean product routing is enabled", async () => {
    const response = await handleDynamicSitemapRequest(
      new Request("https://example.test/sitemap.xml"),
      {
        DB: db(),
        STOREFRONT_CLEAN_COLLECTION_ROUTES_ENABLED: "true",
        STOREFRONT_CLEAN_PRODUCT_ROUTES_ENABLED: "false",
      },
    );
    const xml = await response.text();
    expect(xml).toContain(
      "<loc>https://theblacksheepshop.co.uk/products/highland-cow-classic.html</loc>",
    );
    expect(xml).not.toContain("/products/admin-created-gift</loc>");
  });

  it("rejects writes", async () => {
    const response = await handleDynamicSitemapRequest(
      new Request("https://example.test/sitemap.xml", {
        method: "POST",
      }),
      {
        DB: db(),
        STOREFRONT_CLEAN_COLLECTION_ROUTES_ENABLED: "true",
      },
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });
});
