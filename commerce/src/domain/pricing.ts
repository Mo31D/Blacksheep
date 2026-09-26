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
