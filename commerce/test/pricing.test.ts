import { describe, expect, it } from "vitest";
import { COMMERCE_CATALOG } from "../src/generated/catalog";
import { priceRequestedCart } from "../src/domain/pricing";

describe("authoritative server pricing", () => {
  it("calculates subtotal from the server catalogue only", () => {
    const purchasable = COMMERCE_CATALOG.filter((item) => item.purchasable && item.priceMinor !== null);
    const first = purchasable[0];
    const second = purchasable[1];

    const priced = priceRequestedCart([
      { productId: first.id, quantity: 2 },
      { productId: second.id, quantity: 1 },
    ]);

    expect(priced.currency).toBe("GBP");
    expect(priced.lines[0].unitPriceMinor).toBe(first.priceMinor);
    expect(priced.lines[0].lineTotalMinor).toBe(first.priceMinor! * 2);
    expect(priced.itemsSubtotalMinor).toBe(first.priceMinor! * 2 + second.priceMinor!);
  });

  it("rejects unavailable catalogue products", () => {
    const blocked = COMMERCE_CATALOG.find((item) => !item.purchasable);
    expect(blocked).toBeTruthy();
    expect(() => priceRequestedCart([{ productId: blocked!.id, quantity: 1 }])).toThrow();
  });

  it("rejects invalid quantities and duplicate product lines", () => {
    const product = COMMERCE_CATALOG.find((item) => item.purchasable)!;
    expect(() => priceRequestedCart([{ productId: product.id, quantity: 0 }])).toThrow("invalid_quantity");
    expect(() =>
      priceRequestedCart([
        { productId: product.id, quantity: 1 },
        { productId: product.id, quantity: 1 },
      ]),
    ).toThrow("duplicate_cart_product");
  });
});
