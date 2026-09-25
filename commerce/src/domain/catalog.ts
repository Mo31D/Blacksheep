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


export function listPurchasableProducts(
  query = "",
  limit = 50,
): CommerceCatalogProduct[] {
  const normalized = query.trim().toLowerCase();
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit) || 50));

  return COMMERCE_CATALOG.filter((product) => {
    if (!product.purchasable || product.priceMinor === null) return false;
    if (!normalized) return true;
    return [product.id, product.sku, product.slug, product.name, product.type]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalized));
  }).slice(0, safeLimit);
}
