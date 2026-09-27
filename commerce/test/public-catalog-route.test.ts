import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { handlePublicCatalogRequest } from "../src/routes/catalog";

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

const publicRow = {
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
  shortDescription: "Published public description",
  brand: "Leonardo",
  productType: "gifts",
  primaryCategory: "highland-cow",
  categorySlugs: "highland-cow,seasonal,home-gifts",
  variantId: "var-1",
  sku: "LP00001",
  priceMinor: 950,
  currency: "GBP",
  trackInventory: 1,
  onHand: 4,
  reserved: 1,
  safetyStock: 0,
  balanceVersion: 5,
  primaryImageUrl: "/images/highland-cow.webp",
};

const storefrontRow = {
  id: "sfn_gifts",
  stableKey: "gifts",
  name: "Gifts & Souvenirs",
  slug: "gifts",
  parentNodeId: null,
  sortOrder: 10,
  showInNavigation: 1,
  shortDescription: "Gift range",
  imageUrl: "/images/1.png",
  legacyPath: "/gifts.html",
  publishedVersionId: "sfv_gifts_1",
};

const homepageRow = {
  id: "home_product_rail",
  version: 4,
  publishedVersionId: "hmv-live",
  draftVersionId: null,
  effectiveVersionId: "hmv-live",
  effectiveVersionNumber: 2,
  enabled: 1,
  mode: "FEATURED_PRODUCTS",
  productLimit: 4,
  heading: "Shop favourites",
  selectedStorefrontNodeId: null,
  selectedStorefrontNodeName: null,
};

const homepageProductRow = {
  productId: "prd-1",
  title: "Highland Cow",
  slug: "highland-cow",
  legacyId: "HC-001",
  priceMinor: 950,
  primaryImageUrl: "/images/highland-cow.webp",
  position: 0,
};

class Db implements D1DatabaseLike {
  readonly prepared: Statement[] = [];

  prepare(query: string): Statement {
    const isStorefront = query.includes("FROM storefront_nodes n");
    const isHomepage = query.includes("FROM homepage_merchandising hm");
    const isHomepageProducts = query.includes(
      "FROM homepage_merchandising_products hp",
    );
    const statement = new Statement(
      query,
      isHomepage ? homepageRow : isStorefront ? null : publicRow,
      isHomepageProducts
        ? [homepageProductRow]
        : isStorefront
          ? [storefrontRow]
          : [publicRow],
    );
    this.prepared.push(statement);
    return statement;
  }

  async batch<T>(): Promise<T[]> {
    return [] as T[];
  }
}

describe("Phase 6 public catalogue route", () => {
  it("is hidden when the staging feature flag is off", async () => {
    const db = new Db();
    const response = await handlePublicCatalogRequest(
      new Request("https://api.example.test/v1/catalog"),
      { DB: db },
    );

    expect(response.status).toBe(404);
    expect(db.prepared).toHaveLength(0);
  });

  it("returns only the storefront-safe public product contract", async () => {
    const db = new Db();
    const response = await handlePublicCatalogRequest(
      new Request("https://api.example.test/v1/catalog?limit=20"),
      {
        DB: db,
        D1_PUBLIC_CATALOG_ENABLED: "true",
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const payload = (await response.json()) as {
      products: Array<Record<string, unknown>>;
    };
    expect(payload.products).toHaveLength(1);

    const product = payload.products[0];
    expect(product).toMatchObject({
      id: "HC-001",
      slug: "highland-cow",
      name: "Highland Cow",
      sku: "LP00001",
      priceMinor: 950,
      primaryCategory: "highland-cow",
      categories: ["highland-cow", "seasonal", "home-gifts"],
      purchasable: true,
      inventory: {
        tracked: true,
        available: 3,
      },
      publishedVersionId: "pver-1",
    });

    for (const privateField of [
      "costMinor",
      "barcode",
      "supplier",
      "supplierUrl",
      "audit",
      "internalNote",
      "currentDraftVersionId",
    ]) {
      expect(product).not.toHaveProperty(privateField);
    }
  });

  it("returns a single product by legacy/public id", async () => {
    const db = new Db();
    const response = await handlePublicCatalogRequest(
      new Request("https://api.example.test/v1/catalog/HC-001"),
      {
        DB: db,
        D1_PUBLIC_CATALOG_ENABLED: "true",
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      product: {
        id: "HC-001",
        productId: "prd-1",
        name: "Highland Cow",
      },
    });
    expect(db.prepared[0].values).toEqual([
      "HC-001",
      "HC-001",
    ]);
  });

  it("returns the published Homepage merchandising contract", async () => {
    const db = new Db();
    const response = await handlePublicCatalogRequest(
      new Request("https://api.example.test/v1/homepage-merchandising"),
      {
        DB: db,
        D1_PUBLIC_CATALOG_ENABLED: "true",
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      contract: "homepage-merchandising-published-v1",
      config: {
        enabled: true,
        mode: "FEATURED_PRODUCTS",
        heading: "Shop favourites",
        publishedVersionId: "hmv-live",
      },
      products: [
        {
          productId: "prd-1",
          title: "Highland Cow",
          slug: "highland-cow",
        },
      ],
    });
    expect(
      db.prepared.some((statement) =>
        statement.sql.includes("FROM homepage_merchandising hm"),
      ),
    ).toBe(true);
  });

  it("returns the published Storefront Structure contract", async () => {
    const db = new Db();
    const response = await handlePublicCatalogRequest(
      new Request("https://api.example.test/v1/storefront-structure"),
      {
        DB: db,
        D1_PUBLIC_CATALOG_ENABLED: "true",
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      contract: "storefront-structure-published-v1",
      nodes: [
        {
          id: "sfn_gifts",
          stableKey: "gifts",
          name: "Gifts & Souvenirs",
          slug: "gifts",
          parentNodeId: null,
          sortOrder: 10,
          showInNavigation: true,
          legacyPath: "/gifts.html",
          publishedVersionId: "sfv_gifts_1",
        },
      ],
    });
    expect(db.prepared[0].sql).toContain(
      "JOIN storefront_node_versions nv ON nv.id = n.current_published_version_id",
    );
    expect(db.prepared[0].sql).toContain(
      "WHERE n.publication_status = 'ACTIVE'",
    );
  });

  it("rejects non-GET requests without querying D1", async () => {
    const db = new Db();
    const response = await handlePublicCatalogRequest(
      new Request("https://api.example.test/v1/catalog", {
        method: "POST",
      }),
      {
        DB: db,
        D1_PUBLIC_CATALOG_ENABLED: "true",
      },
    );

    expect(response.status).toBe(405);
    expect(db.prepared).toHaveLength(0);
  });

  it("fails closed when D1 is unavailable", async () => {
    const response = await handlePublicCatalogRequest(
      new Request("https://api.example.test/v1/catalog"),
      { D1_PUBLIC_CATALOG_ENABLED: "true" },
    );

    expect(response.status).toBe(503);
  });
});
