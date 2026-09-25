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

class Db implements D1DatabaseLike {
  readonly prepared: Statement[] = [];

  prepare(query: string): Statement {
    const statement = new Statement(
      query,
      publicRow,
      [publicRow],
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
