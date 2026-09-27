import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { handleDynamicSitemapRequest } from "../src/routes/storefront-sitemap";

class Statement implements D1PreparedStatementLike {
  constructor(private readonly rows: unknown[]) {}
  bind(): D1PreparedStatementLike {
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

class Db implements D1DatabaseLike {
  constructor(private readonly rows: unknown[]) {}
  prepare(): D1PreparedStatementLike {
    return new Statement(this.rows);
  }
  async batch<T>(): Promise<T[]> {
    return [] as T[];
  }
}

const publishedRows = [
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

describe("CARD 12 dynamic collection sitemap", () => {
  it("is unavailable while clean routes are disabled", async () => {
    const response = await handleDynamicSitemapRequest(
      new Request("https://example.test/sitemap-dynamic.xml"),
      { DB: new Db(publishedRows) },
    );
    expect(response.status).toBe(404);
  });

  it("contains published non-legacy collection canonicals only", async () => {
    const response = await handleDynamicSitemapRequest(
      new Request("https://example.test/sitemap-dynamic.xml"),
      {
        DB: new Db(publishedRows),
        STOREFRONT_CLEAN_COLLECTION_ROUTES_ENABLED: "true",
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/xml");
    const xml = await response.text();

    expect(xml).toContain(
      "<loc>https://theblacksheepshop.co.uk/collections/christmas</loc>",
    );
    expect(xml).toContain(
      "<loc>https://theblacksheepshop.co.uk/collections/new-and-special</loc>",
    );
    expect(xml).not.toContain("/collections/gifts");
    expect(xml).not.toContain("gifts.html");
    expect(xml.indexOf("/collections/christmas")).toBeLessThan(
      xml.indexOf("/collections/new-and-special"),
    );
  });

  it("rejects writes", async () => {
    const response = await handleDynamicSitemapRequest(
      new Request("https://example.test/sitemap-dynamic.xml", {
        method: "POST",
      }),
      {
        DB: new Db(publishedRows),
        STOREFRONT_CLEAN_COLLECTION_ROUTES_ENABLED: "true",
      },
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });
});
