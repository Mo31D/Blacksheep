import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { getPublishedHomepageMerchandisingPreview } from "../src/data/homepage-merchandising";

class Statement implements D1PreparedStatementLike {
  values: unknown[] = [];
  constructor(
    public readonly sql: string,
    private readonly db: HomepagePublicDb,
  ) {}
  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }
  async first<T>(): Promise<T | null> {
    if (this.sql.includes("FROM homepage_merchandising hm")) {
      return this.db.snapshot as T;
    }
    return null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    if (this.sql.includes("FROM homepage_merchandising_products hp")) {
      return { results: this.db.featured as T[] };
    }
    if (this.sql.includes("FROM homepage_merchandising_modules")) {
      return { results: this.db.modules as T[] };
    }
    if (
      this.sql.includes("ORDER BY pv.published_at DESC")
    ) {
      return { results: this.db.newArrivals as T[] };
    }
    if (
      this.sql.includes("JOIN product_version_storefront_placements ps")
    ) {
      return { results: this.db.collection as T[] };
    }
    return { results: [] };
  }
  async run(): Promise<unknown> {
    return {};
  }
}

class HomepagePublicDb implements D1DatabaseLike {
  prepared: Statement[] = [];
  snapshot: Record<string, unknown>;
  featured: Record<string, unknown>[] = [];
  newArrivals: Record<string, unknown>[] = [];
  collection: Record<string, unknown>[] = [];
  modules: Record<string, unknown>[] = [
    { moduleKey: "HERO", enabled: 1, position: 10 },
    { moduleKey: "COLLECTIONS", enabled: 1, position: 20 },
    { moduleKey: "PRODUCT_RAIL", enabled: 1, position: 30 },
    { moduleKey: "LOCAL_FAVOURITES", enabled: 1, position: 40 },
    { moduleKey: "VISIT_SHOP", enabled: 1, position: 50 },
  ];

  constructor(mode: string) {
    this.snapshot = {
      id: "home_product_rail",
      version: 7,
      publishedVersionId: "hmv-live",
      draftVersionId: null,
      effectiveVersionId: "hmv-live",
      effectiveVersionNumber: 3,
      enabled: 1,
      mode,
      productLimit: 4,
      heading: "From the shop",
      selectedStorefrontNodeId:
        mode === "SELECTED_COLLECTION" ? "sfn_gifts_highland_cows" : null,
      selectedStorefrontNodeName:
        mode === "SELECTED_COLLECTION" ? "Highland Cows" : null,
    };
  }

  prepare(sql: string): Statement {
    const statement = new Statement(sql, this);
    this.prepared.push(statement);
    return statement;
  }

  async batch<T>(): Promise<T[]> {
    return [] as T[];
  }
}

function product(id: string, position = 0) {
  return {
    productId: id,
    title: "Product " + id,
    slug: "product-" + id,
    legacyId: null,
    priceMinor: 999,
    primaryImageUrl: "/images/" + id + ".webp",
    position,
  };
}

describe("CARD 07 published Homepage product rail", () => {
  it("uses newest published products for NEW_ARRIVALS", async () => {
    const db = new HomepagePublicDb("NEW_ARRIVALS");
    db.newArrivals = [product("new-1"), product("new-2")];

    const result = await getPublishedHomepageMerchandisingPreview(db);

    expect(result.config).toMatchObject({
      enabled: true,
      mode: "NEW_ARRIVALS",
      publishedVersionId: "hmv-live",
    });
    expect(result.products.map((row) => row.productId)).toEqual([
      "new-1",
      "new-2",
    ]);
    expect(result.config.modules.map((row) => row.key)).toEqual([
      "HERO",
      "COLLECTIONS",
      "PRODUCT_RAIL",
      "LOCAL_FAVOURITES",
      "VISIT_SHOP",
    ]);
    expect(
      db.prepared.some((statement) =>
        statement.sql.includes("ORDER BY pv.published_at DESC"),
      ),
    ).toBe(true);
  });

  it("preserves the owner-defined Featured product order", async () => {
    const db = new HomepagePublicDb("FEATURED_PRODUCTS");
    db.featured = [product("featured-b", 0), product("featured-a", 10)];

    const result = await getPublishedHomepageMerchandisingPreview(db);

    expect(result.products.map((row) => row.productId)).toEqual([
      "featured-b",
      "featured-a",
    ]);
    const featuredQuery = db.prepared.find((statement) =>
      statement.sql.includes("FROM homepage_merchandising_products hp"),
    );
    expect(featuredQuery?.sql).toContain("ORDER BY hp.position");
  });

  it("resolves a published Storefront collection without duplicating products", async () => {
    const db = new HomepagePublicDb("SELECTED_COLLECTION");
    db.collection = [product("cow-1"), product("cow-2")];

    const result = await getPublishedHomepageMerchandisingPreview(db);

    expect(result.config.selectedStorefrontNodeId).toBe(
      "sfn_gifts_highland_cows",
    );
    expect(result.products.map((row) => row.productId)).toEqual([
      "cow-1",
      "cow-2",
    ]);
    const collectionQuery = db.prepared.find((statement) =>
      statement.sql.includes("JOIN product_version_storefront_placements ps"),
    );
    expect(collectionQuery?.sql).toContain("SELECT DISTINCT");
    expect(collectionQuery?.values).toEqual([
      "sfn_gifts_highland_cows",
      "sfn_gifts_highland_cows",
      4,
    ]);
  });

  it("returns no products when the published rail is disabled", async () => {
    const db = new HomepagePublicDb("NEW_ARRIVALS");
    db.snapshot.enabled = 0;
    db.newArrivals = [product("hidden")];

    const result = await getPublishedHomepageMerchandisingPreview(db);

    expect(result.config.enabled).toBe(false);
    expect(result.products).toEqual([]);
  });
});
