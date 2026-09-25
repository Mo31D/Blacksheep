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

describe("Phase 1 read-only Product Admin", () => {
  it("renders the premium Products workspace without edit controls", () => {
    const html = adminHtml("owner@example.com");
    expect(html).toContain('data-nav="products"');
    expect(html).toContain('id="view-products"');
    expect(html).toContain("Phase 1 · Read only");
    expect(html).toContain("Search product, SKU, barcode or code");
    expect(html).toContain("Read-only Product Core");
    expect(html).not.toContain("Add product</button>");
  });

  it("returns the authenticated product list contract", async () => {
    const response = await handleAdminRequest(
      new Request(
        "https://admin.example.com/admin/api/products?q=peter&quality=missing-image&limit=100",
      ),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        listAdminProductsFn: async (_db, filters) => ({
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
              version: 1,
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
      summary: { total: 146, untracked: 146 },
    });
  });

  it("returns one authenticated product detail", async () => {
    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/products/prd-1"),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        getAdminProductDetailFn: async () => ({
          id: "prd-1",
          legacyId: "PR-001",
          title: "Peter Rabbit",
          publicationStatus: "ACTIVE",
          trackInventory: false,
        }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      product: { id: "prd-1", publicationStatus: "ACTIVE" },
    });
  });

  it("does not expose a Phase 1 product write route", async () => {
    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/products", {
        method: "POST",
        headers: {
          origin: "https://admin.example.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "Should not be writable" }),
      }),
      { DB: new Db() },
      { verifyAccessFn: identity },
    );

    expect(response.status).toBe(404);
  });
});
