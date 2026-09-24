import { describe, expect, it } from "vitest";
import { COMMERCE_CATALOG } from "../src/generated/catalog";
import { getCommerceProduct, requirePurchasableProduct } from "../src/domain/catalog";

describe("server-authoritative commerce catalogue", () => {
  it("has unique ids and slugs", () => {
    expect(new Set(COMMERCE_CATALOG.map((item) => item.id)).size).toBe(COMMERCE_CATALOG.length);
    expect(new Set(COMMERCE_CATALOG.map((item) => item.slug)).size).toBe(COMMERCE_CATALOG.length);
  });

  it("uses integer GBP minor-unit prices", () => {
    for (const item of COMMERCE_CATALOG) {
      expect(item.currency).toBe("GBP");
      if (item.priceMinor !== null) {
        expect(Number.isInteger(item.priceMinor)).toBe(true);
        expect(item.priceMinor).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("never marks unavailable or unpriced products as purchasable", () => {
    for (const item of COMMERCE_CATALOG) {
      if (item.status === "arriving-soon" || item.status === "out-of-stock" || item.priceMinor === null) {
        expect(item.purchasable).toBe(false);
      }
      if (item.purchasable) expect(item.priceMinor).not.toBeNull();
    }
  });

  it("resolves products by server catalogue id", () => {
    const first = COMMERCE_CATALOG[0];
    expect(getCommerceProduct(first.id)?.slug).toBe(first.slug);
    expect(getCommerceProduct("DOES-NOT-EXIST")).toBeNull();
  });

  it("rejects a known non-purchasable product", () => {
    const blocked = COMMERCE_CATALOG.find((item) => !item.purchasable);
    expect(blocked).toBeTruthy();
    expect(() => requirePurchasableProduct(blocked!.id)).toThrow();
  });
});
