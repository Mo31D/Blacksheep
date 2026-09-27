import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { handleAdminRequest } from "../src/routes/admin";

class Statement implements D1PreparedStatementLike {
  bind(): D1PreparedStatementLike { return this; }
  async first<T>(): Promise<T | null> { return null; }
  async all<T>(): Promise<{ results: T[] }> { return { results: [] }; }
  async run(): Promise<unknown> { return {}; }
}
class Db implements D1DatabaseLike {
  prepare(): D1PreparedStatementLike { return new Statement(); }
  async batch<T>(): Promise<T[]> { return []; }
}

const identity = async () => ({
  ok: true as const,
  status: 200,
  identity: { email: "owner@example.com", subject: "owner-1" },
});

const config = {
  id: "home_product_rail",
  version: 4,
  publishedVersionId: "hmv-live",
  draftVersionId: "hmv-draft",
  effectiveVersionId: "hmv-draft",
  effectiveVersionNumber: 3,
  hasDraft: true,
  enabled: true,
  mode: "FEATURED_PRODUCTS" as const,
  productLimit: 8,
  heading: "Popular picks",
  selectedStorefrontNodeId: null,
  selectedStorefrontNodeName: null,
  featuredProducts: [
    {
      productId: "prd-1",
      title: "Highland Cow",
      slug: "highland-cow",
      legacyId: "HC-001",
      priceMinor: 950,
      primaryImageUrl: "/media/med-1",
      position: 0,
    },
  ],
};

function jsonRequest(path: string, method: string, body?: unknown) {
  return new Request("https://admin.example.com" + path, {
    method,
    headers: {
      origin: "https://admin.example.com",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("CARD 06 Homepage Merchandising Admin API", () => {
  it("returns the current owner-facing homepage configuration", async () => {
    const response = await handleAdminRequest(
      jsonRequest("/admin/api/homepage-merchandising", "GET"),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        getAdminHomepageMerchandisingFn: async () => config,
      },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      config: {
        enabled: true,
        mode: "FEATURED_PRODUCTS",
        heading: "Popular picks",
      },
    });
  });

  it("saves a draft without publishing it", async () => {
    let saved: Record<string, unknown> | null = null;
    const response = await handleAdminRequest(
      jsonRequest("/admin/api/homepage-merchandising/draft", "PATCH", {
        expectedVersion: 4,
        enabled: true,
        mode: "NEW_ARRIVALS",
        productLimit: 6,
        heading: "New in",
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        saveAdminHomepageMerchandisingDraftFn: async (_db, raw, actorEmail) => {
          saved = { ...(raw as unknown as Record<string, unknown>), actorEmail };
        },
        getAdminHomepageMerchandisingFn: async () => ({
          ...config,
          version: 5,
          mode: "NEW_ARRIVALS",
        }),
      },
    );
    expect(response.status).toBe(200);
    expect(saved).toMatchObject({
      expectedVersion: 4,
      mode: "NEW_ARRIVALS",
      productLimit: 6,
      actorEmail: "owner@example.com",
    });
  });

  it("returns a private preview resolved from the draft", async () => {
    const response = await handleAdminRequest(
      jsonRequest("/admin/api/homepage-merchandising/preview", "GET"),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        previewAdminHomepageMerchandisingFn: async () => ({
          config,
          products: config.featuredProducts,
        }),
      },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      config: { mode: "FEATURED_PRODUCTS" },
      products: [{ productId: "prd-1", title: "Highland Cow" }],
    });
  });

  it("publishes only with optimistic version input", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const response = await handleAdminRequest(
      jsonRequest("/admin/api/homepage-merchandising/publish", "POST", {
        expectedVersion: 5,
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        publishAdminHomepageMerchandisingFn: async (
          _db,
          expectedVersion,
          actorEmail,
        ) => {
          calls.push({ expectedVersion, actorEmail });
        },
        getAdminHomepageMerchandisingFn: async () => ({
          ...config,
          version: 6,
          draftVersionId: null,
          hasDraft: false,
        }),
      },
    );
    expect(response.status).toBe(200);
    expect(calls).toEqual([
      { expectedVersion: 5, actorEmail: "owner@example.com" },
    ]);
  });

  it("surfaces publish readiness conflicts in owner language", async () => {
    const response = await handleAdminRequest(
      jsonRequest("/admin/api/homepage-merchandising/publish", "POST", {
        expectedVersion: 5,
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        publishAdminHomepageMerchandisingFn: async () => {
          throw new Error("homepage_featured_product_not_live");
        },
      },
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "homepage_featured_product_not_live",
        message:
          "Publish every Featured product before publishing this homepage draft.",
      },
    });
  });
});
