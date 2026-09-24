import { COMMERCE_CATALOG, type CommerceCatalogProduct } from "../generated/catalog";

const byId = new Map<string, CommerceCatalogProduct>(
  COMMERCE_CATALOG.map((product) => [product.id, product]),
);

export function getCommerceProduct(id: string): CommerceCatalogProduct | null {
  return byId.get(id) ?? null;
}

export function requirePurchasableProduct(id: string): CommerceCatalogProduct {
  const product = getCommerceProduct(id);
  if (!product) throw new Error("catalog_product_not_found");
  if (!product.purchasable || product.priceMinor === null) {
    throw new Error(product.nonPurchasableReason ?? "catalog_product_not_purchasable");
  }
  return product;
}
