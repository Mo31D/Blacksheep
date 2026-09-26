import type { D1DatabaseLike } from "./d1";
import {
  getPublicCommerceProduct,
  getPublicCommerceProductsByIds,
  type PublicCommerceProduct,
} from "./public-catalog";
import type {
  AuthoritativePriceSummary,
  RequestedCartLine,
} from "../domain/pricing";

export function purchasabilityError(
  product: PublicCommerceProduct,
): string {
  switch (product.nonPurchasableReason) {
    case "arriving_soon":
      return "arriving_soon";
    case "out_of_stock":
      return "out_of_stock";
    case "price_unavailable":
      return "price_unavailable";
    default:
      return "catalog_product_not_purchasable";
  }
}

export async function requirePurchasableCommerceProductFromD1(
  db: D1DatabaseLike,
  productId: string,
): Promise<PublicCommerceProduct> {
  const id = String(productId ?? "").trim();
  if (!id) throw new Error("catalog_product_not_found");

  const product = await getPublicCommerceProduct(db, id);
  if (!product) throw new Error("catalog_product_not_found");
  if (!product.purchasable) {
    throw new Error(purchasabilityError(product));
  }
  if (product.priceMinor === null) {
    throw new Error("price_unavailable");
  }
  return product;
}

export async function priceRequestedCartFromD1(
  db: D1DatabaseLike,
  requested: readonly RequestedCartLine[],
): Promise<AuthoritativePriceSummary> {
  if (!requested.length) throw new Error("cart_empty");

  const seen = new Set<string>();
  for (const { productId, quantity } of requested) {
    const id = String(productId ?? "").trim();
    if (!id) throw new Error("catalog_product_not_found");
    if (seen.has(id)) throw new Error("duplicate_cart_product");
    seen.add(id);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new Error("invalid_quantity");
    }
  }

  const products = await getPublicCommerceProductsByIds(
    db,
    requested.map((line) => line.productId),
  );
  const byId = new Map<string, PublicCommerceProduct>();
  for (const product of products) {
    byId.set(product.id, product);
    byId.set(product.productId, product);
  }

  const lines = requested.map(({ productId, quantity }) => {
    const product = byId.get(productId);
    if (!product) throw new Error("catalog_product_not_found");
    if (!product.purchasable) {
      throw new Error(purchasabilityError(product));
    }
    if (product.priceMinor === null) {
      throw new Error("price_unavailable");
    }
    if (
      product.inventory.tracked &&
      (product.inventory.available === null ||
        product.inventory.available < quantity)
    ) {
      throw new Error("out_of_stock");
    }

    return {
      productId: product.id,
      sku: product.sku,
      slug: product.slug,
      productName: product.name,
      unitPriceMinor: product.priceMinor,
      quantity,
      lineTotalMinor: product.priceMinor * quantity,
    };
  });

  return {
    currency: "GBP",
    itemsSubtotalMinor: lines.reduce(
      (sum, line) => sum + line.lineTotalMinor,
      0,
    ),
    lines,
  };
}
