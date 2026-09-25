import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { getAdminProductDetail } from "../src/data/products";

class Statement implements D1PreparedStatementLike {
  constructor(private readonly sql: string) {}

  bind(): D1PreparedStatementLike {
    return this;
  }

  async first<T>(): Promise<T | null> {
    if (this.sql.includes("FROM products p")) {
      return {
        id: "prd-1",
        legacyId: "PR-001",
        slug: "mixed-media-product",
        publicationStatus: "ACTIVE",
        sellStatus: "AUTO",
        onlineOrderingEnabled: 1,
        featured: 0,
        version: 7,
        createdAt: "2026-09-25T00:00:00.000Z",
        updatedAt: "2026-09-25T00:00:00.000Z",
        draftVersionId: "pver-draft",
        effectiveVersionId: "pver-draft",
        publishedVersionId: "pver-live",
        effectiveVersionNumber: 2,
        title: "Mixed media product",
        shortDescription: "Test",
        longDescription: null,
        brand: null,
        collectionLabel: null,
        productType: "gifts",
        publicNote: null,
        seoTitle: null,
        seoDescription: null,
        variantId: "var-1",
        variantTitle: "Default",
        sku: "SKU-1",
        barcode: null,
        priceMinor: 995,
        compareAtPriceMinor: null,
        currency: "GBP",
        trackInventory: 0,
        lowStockThreshold: null,
        variantVersion: 1,
      } as T;
    }
    return null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    if (this.sql.includes("FROM product_version_media pvm")) {
      return {
        results: [
          {
            id: "med-legacy",
            storageProvider: "LEGACY_REPO",
            storageKey: "images/peter.webp",
            publicUrl: "https://theblacksheepshop.co.uk/images/peter.webp",
            mimeType: "image/webp",
            width: 800,
            height: 800,
            position: 0,
            isPrimary: 1,
            altText: "Legacy image",
            displayFit: "CONTAIN",
          },
          {
            id: "med-r2",
            storageProvider: "R2",
            storageKey: "products/prd-1/2026-09/med-r2.webp",
            publicUrl: "/media/med-r2",
            mimeType: "image/webp",
            width: null,
            height: null,
            position: 1,
            isPrimary: 0,
            altText: "New R2 image",
            displayFit: "CONTAIN",
          },
        ] as T[],
      };
    }
    return { results: [] };
  }

  async run(): Promise<unknown> {
    return {};
  }
}

class Db implements D1DatabaseLike {
  prepare(sql: string): D1PreparedStatementLike {
    return new Statement(sql);
  }

  async batch<T>(): Promise<T[]> {
    return [];
  }
}

describe("Product Media coexistence", () => {
  it("returns legacy repository and R2 images in one draft gallery", async () => {
    const product = await getAdminProductDetail(new Db(), "prd-1");
    expect(product).not.toBeNull();

    const media = (product?.media ?? []) as Array<Record<string, unknown>>;
    expect(media).toHaveLength(2);
    expect(media.map((item) => item.storageProvider)).toEqual([
      "LEGACY_REPO",
      "R2",
    ]);
    expect(media[0]).toMatchObject({
      id: "med-legacy",
      isPrimary: true,
      publicUrl: "https://theblacksheepshop.co.uk/images/peter.webp",
    });
    expect(media[1]).toMatchObject({
      id: "med-r2",
      isPrimary: false,
      publicUrl: "/media/med-r2",
    });
  });
});
