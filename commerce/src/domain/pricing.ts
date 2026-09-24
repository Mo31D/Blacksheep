import { requirePurchasableProduct } from "./catalog";

export interface RequestedCartLine {
  productId: string;
  quantity: number;
}

export interface AuthoritativePricedLine {
  productId: string;
  sku: string | null;
  slug: string;
  productName: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
}

export interface AuthoritativePriceSummary {
  currency: "GBP";
  itemsSubtotalMinor: number;
  lines: AuthoritativePricedLine[];
}

export function priceRequestedCart(
  requested: readonly RequestedCartLine[],
): AuthoritativePriceSummary {
  if (!requested.length) throw new Error("cart_empty");

  const seen = new Set<string>();
  const lines = requested.map(({ productId, quantity }) => {
    if (seen.has(productId)) throw new Error("duplicate_cart_product");
    seen.add(productId);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new Error("invalid_quantity");
    }

    const product = requirePurchasableProduct(productId);
    const unitPriceMinor = product.priceMinor;
    if (unitPriceMinor === null) throw new Error("price_unavailable");

    return {
      productId: product.id,
      sku: product.sku,
      slug: product.slug,
      productName: product.name,
      unitPriceMinor,
      quantity,
      lineTotalMinor: unitPriceMinor * quantity,
    };
  });

  return {
    currency: "GBP",
    itemsSubtotalMinor: lines.reduce((sum, line) => sum + line.lineTotalMinor, 0),
    lines,
  };
}
