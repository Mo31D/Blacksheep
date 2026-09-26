export const ORDER_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "QUOTED",
  "AWAITING_PAYMENT",
  "PAID",
  "PREPARING",
  "SHIPPED",
  "READY_FOR_COLLECTION",
  "COMPLETED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type FulfilmentMethod = "delivery" | "collection";
export type OrderDataClass = "BUSINESS" | "TEST" | "E2E";

export interface DeliveryAddress {
  line1: string;
  line2?: string | null;
  town: string;
  county?: string | null;
  postcode: string;
  country: string;
}

export interface OrderItemSnapshot {
  catalogProductId: string;
  sku?: string | null;
  slug: string;
  productName: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  optionsJson?: string;
}

export interface SubmittedOrderInput {
  id: string;
  publicReference: string;
  idempotencyKey: string;
  dataClass?: OrderDataClass;
  currency: string;
  fulfilmentMethod: FulfilmentMethod;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  deliveryAddress?: DeliveryAddress | null;
  customerNote?: string | null;
  itemsSubtotalMinor: number;
  items: OrderItemSnapshot[];
  createdAt?: string;
}

export interface CreatedOrder {
  id: string;
  publicReference: string;
  status: "SUBMITTED";
  createdAt: string;
}

export interface ExistingOrderByIdempotency {
  id: string;
  publicReference: string;
  status: OrderStatus;
  createdAt: string;
}
