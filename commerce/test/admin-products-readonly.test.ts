import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { handleAdminRequest } from "../src/routes/admin";
import { adminHtml } from "../src/admin/ui";

class Statement implements D1PreparedStatementLike {
  bind(): D1PreparedStatementLike {
    return this;
  }
  async first<T>(): Promise<T | null> {
    return null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: [] };
  }
  async run(): Promise<unknown> {
    return {};
  }
}

class Db implements D1DatabaseLike {
  prepare(): D1PreparedStatementLike {
    return new Statement();
  }
  async batch<T>(): Promise<T[]> {
    return [];
  }
}

const identity = async () => ({
  ok: true as const,
  status: 200,
  identity: { email: "owner@example.com", subject: "owner-1" },
});

const product = {
  id: "prd-1",
  legacyId: "PR-001",
  slug: "peter-rabbit",
  title: "Peter Rabbit",
  publicationStatus: "ACTIVE",
  sellStatus: "AUTO",
  onlineOrderingEnabled: true,
  featured: false,
  version: 4,
  draftVersionId: null,
  variantId: "var-1",
  variantVersion: 2,
  sku: "SKU-1",
  barcode: null,
  priceMinor: 995,
  trackInventory: false,
  categories: [],
  media: [],
  attributes: [],
  sources: [],
  history: [],
};

describe("Phase 2 Product Admin", () => {
  it("renders premium editing controls and mobile polish hooks", () => {
    const html = adminHtml("owner@example.com");
    expect(html).toContain('data-nav="products"');
    expect(html).toContain('id="view-products"');
    expect(html).toContain("Phase 2 · Editing");
    expect(html).toContain('id="addProduct"');
    expect(html).toContain("Quick edit");
    expect(html).toContain("Edit details");
    expect(html).toContain("product-mobile-sticky");
    expect(html).toContain("Unique products needing action");
  });

  it("returns actionable quality metrics without treating in-store pricing as missing", async () => {
    const response = await handleAdminRequest(
      new Request(
        "https://admin.example.com/admin/api/products?q=peter&quality=missing-image&limit=100",
      ),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        listAdminProductsFn: async () => ({
          products: [
            {
              id: "prd-1",
              legacyId: "PR-001",
              slug: "peter-rabbit",
              title: "Peter Rabbit",
              thumbnailUrl: null,
              sku: "SKU-1",
              barcode: null,
              priceMinor: 995,
              currency: "GBP",
              publicationStatus: "ACTIVE",
              sellStatus: "AUTO",
              onlineOrderingEnabled: true,
              inventory: {
                tracked: false,
                onHand: null,
                reserved: null,
                available: null,
                incoming: 0,
              },
              qualityFlags: ["MISSING_IMAGE"],
              version: 4,
              updatedAt: "2026-09-25T00:00:00.000Z",
            },
          ],
          nextCursor: null,
          summary: {
            total: 146,
            outOfStock: 4,
            arrivingSoon: 14,
            untracked: 146,
            missingImage: 14,
            missingPrice: 2,
            needsData: 15,
            dataWarnings: 19,
          },
        }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      products: [{ legacyId: "PR-001", priceMinor: 995 }],
      summary: { total: 146, missingPrice: 2, needsData: 15 },
    });
  });

  it("creates a draft product through the authenticated write route", async () => {
    let called = false;
    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/products", {
        method: "POST",
        headers: {
          origin: "https://admin.example.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "New Product",
          priceMinor: 1295,
          categoryIds: [],
        }),
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        createAdminProductFn: async () => {
          called = true;
          return { id: "prd-new" };
        },
        getAdminProductDetailFn: async () => ({
          ...product,
          id: "prd-new",
          title: "New Product",
          publicationStatus: "DRAFT",
          draftVersionId: "pver-new",
        }),
      },
    );

    expect(called).toBe(true);
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      product: { id: "prd-new", publicationStatus: "DRAFT" },
    });
  });

  it("quick-edits price, SKU, barcode and selling state atomically", async () => {
    let input: Record<string, unknown> | null = null;
    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/products/prd-1/quick-edit", {
        method: "PATCH",
        headers: {
          origin: "https://admin.example.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          expectedVersion: 4,
          expectedVariantVersion: 2,
          priceMinor: 1095,
          sku: "SKU-2",
          barcode: "5022259602977",
          sellStatus: "OUT_OF_STOCK",
          onlineOrderingEnabled: true,
        }),
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        quickEditAdminProductFn: async (_db, _id, raw) => {
          input = raw as unknown as Record<string, unknown>;
        },
        getAdminProductDetailFn: async () => ({
          ...product,
          priceMinor: 1095,
          sku: "SKU-2",
          barcode: "5022259602977",
          sellStatus: "OUT_OF_STOCK",
          version: 5,
          variantVersion: 3,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(input).toMatchObject({
      expectedVersion: 4,
      expectedVariantVersion: 2,
      priceMinor: 1095,
      sellStatus: "OUT_OF_STOCK",
    });
    await expect(response.json()).resolves.toMatchObject({
      product: {
        priceMinor: 1095,
        sku: "SKU-2",
        sellStatus: "OUT_OF_STOCK",
        version: 5,
        variantVersion: 3,
      },
    });
  });

  it("saves a private content draft and publishes it explicitly", async () => {
    const draftResponse = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/products/prd-1/draft", {
        method: "PATCH",
        headers: {
          origin: "https://admin.example.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          expectedVersion: 4,
          changes: { title: "Peter Rabbit Updated", categoryIds: [] },
        }),
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        saveAdminProductDraftFn: async () => undefined,
        getAdminProductDetailFn: async () => ({
          ...product,
          title: "Peter Rabbit Updated",
          draftVersionId: "pver-draft",
          version: 5,
        }),
      },
    );

    expect(draftResponse.status).toBe(200);
    await expect(draftResponse.json()).resolves.toMatchObject({
      product: { draftVersionId: "pver-draft", version: 5 },
    });

    const publishResponse = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/products/prd-1/publish", {
        method: "POST",
        headers: {
          origin: "https://admin.example.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({ expectedVersion: 5 }),
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        publishAdminProductFn: async () => undefined,
        getAdminProductDetailFn: async () => ({
          ...product,
          title: "Peter Rabbit Updated",
          draftVersionId: null,
          version: 6,
        }),
      },
    );

    expect(publishResponse.status).toBe(200);
    await expect(publishResponse.json()).resolves.toMatchObject({
      product: { draftVersionId: null, version: 6 },
    });
  });

  it("rejects cross-origin Product mutations", async () => {
    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/products", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "No" }),
      }),
      { DB: new Db() },
      { verifyAccessFn: identity },
    );

    expect(response.status).toBe(403);
  });
});
