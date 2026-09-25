import type { FulfilmentMethod, OrderStatus } from "./order";

export type AdminOrderAction =
  | { action: "start_review" }
  | { action: "quote"; deliveryAmountMinor: number }
  | {
      action: "send_payment_request";
      paymentProvider?: string | null;
      paymentReference?: string | null;
      paymentRequestUrl: string;
      fulfilmentMessage: string;
    }
  | { action: "mark_paid"; paymentReference?: string | null }
  | { action: "start_preparing" }
  | {
      action: "mark_shipped";
      trackingReference?: string | null;
      trackingUrl?: string | null;
    }
  | { action: "ready_for_collection" }
  | { action: "complete" }
  | { action: "cancel"; note?: string | null }
  | { action: "record_refund"; note?: string | null }
  | { action: "refund_and_cancel"; note?: string | null };

export interface AdminOrderState {
  id: string;
  publicReference: string;
  status: OrderStatus;
  fulfilmentMethod: FulfilmentMethod;
  itemsSubtotalMinor: number;
  deliveryAmountMinor: number | null;
  finalTotalMinor: number | null;
  paymentStatus: string;
  activeRevisionId?: string | null;
}

export interface ValidatedAdminAction {
  nextStatus: OrderStatus;
  deliveryAmountMinor?: number | null;
  finalTotalMinor?: number | null;
  paymentStatus?: string;
  paymentProvider?: string | null;
  paymentReference?: string | null;
  paymentRequestUrl?: string | null;
  fulfilmentMessage?: string | null;
  trackingReference?: string | null;
  trackingUrl?: string | null;
  timestampField?: "quoted_at" | "paid_at" | "shipped_at" | "completed_at" | "cancelled_at";
  eventType: string;
  note?: string | null;
}

function requireStatus(
  current: OrderStatus,
  allowed: readonly OrderStatus[],
  action: string,
): void {
  if (!allowed.includes(current)) {
    throw new Error(`admin_transition_not_allowed:${action}:${current}`);
  }
}

function optionalText(value: unknown, max: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("admin_invalid_text");
  const text = value.trim();
  if (text.length > max) throw new Error("admin_text_too_long");
  return text || null;
}

function httpsUrl(value: unknown): string {
  if (typeof value !== "string") throw new Error("admin_payment_url_required");
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("admin_url_must_be_https");
  return url.toString();
}

function requirePaidForRefund(order: AdminOrderState, action: string): void {
  if (order.paymentStatus !== "PAID") {
    throw new Error(`admin_refund_requires_paid:${action}:${order.paymentStatus}`);
  }
}

export function validateAdminOrderAction(
  order: AdminOrderState,
  raw: unknown,
): ValidatedAdminAction {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("admin_invalid_action");
  }
  const input = raw as Record<string, unknown>;
  const action = input.action;

  switch (action) {
    case "start_review":
      requireStatus(order.status, ["SUBMITTED"], action);
      return {
        nextStatus: "UNDER_REVIEW",
        eventType: "ORDER_REVIEW_STARTED",
      };

    case "quote": {
      requireStatus(order.status, ["SUBMITTED", "UNDER_REVIEW", "QUOTED"], action);
      if (order.activeRevisionId) {
        throw new Error("admin_quote_revision_active");
      }
      const amount = input.deliveryAmountMinor;
      if (!Number.isInteger(amount) || Number(amount) < 0 || Number(amount) > 100000) {
        throw new Error("admin_invalid_delivery_amount");
      }
      if (order.fulfilmentMethod === "collection" && Number(amount) !== 0) {
        throw new Error("admin_collection_delivery_must_be_zero");
      }
      return {
        nextStatus: "QUOTED",
        deliveryAmountMinor: Number(amount),
        finalTotalMinor: order.itemsSubtotalMinor + Number(amount),
        paymentStatus: "UNPAID",
        timestampField: "quoted_at",
        eventType: "ORDER_QUOTED",
      };
    }

    case "send_payment_request": {
      requireStatus(order.status, ["QUOTED", "AWAITING_PAYMENT"], action);
      if (order.finalTotalMinor === null) throw new Error("admin_quote_required");
      const paymentRequestUrl = httpsUrl(input.paymentRequestUrl);
      const fulfilmentMessage = optionalText(input.fulfilmentMessage, 300);
      if (!fulfilmentMessage || fulfilmentMessage.length < 3) {
        throw new Error("admin_fulfilment_message_required");
      }
      return {
        nextStatus: "AWAITING_PAYMENT",
        paymentStatus: "PAYMENT_REQUESTED",
        paymentProvider: optionalText(input.paymentProvider, 80) ?? "manual",
        paymentReference: optionalText(input.paymentReference, 180),
        paymentRequestUrl,
        fulfilmentMessage,
        eventType: "PAYMENT_REQUEST_SENT",
      };
    }

    case "mark_paid":
      requireStatus(order.status, ["AWAITING_PAYMENT"], action);
      return {
        nextStatus: "PAID",
        paymentStatus: "PAID",
        paymentReference: optionalText(input.paymentReference, 180),
        timestampField: "paid_at",
        eventType: "PAYMENT_CONFIRMED",
      };

    case "start_preparing":
      requireStatus(order.status, ["PAID"], action);
      return {
        nextStatus: "PREPARING",
        eventType: "ORDER_PREPARING",
      };

    case "mark_shipped":
      requireStatus(order.status, ["PREPARING"], action);
      if (order.fulfilmentMethod !== "delivery") {
        throw new Error("admin_shipping_requires_delivery");
      }
      return {
        nextStatus: "SHIPPED",
        trackingReference: optionalText(input.trackingReference, 180),
        trackingUrl: input.trackingUrl ? httpsUrl(input.trackingUrl) : null,
        timestampField: "shipped_at",
        eventType: "ORDER_SHIPPED",
      };

    case "ready_for_collection":
      requireStatus(order.status, ["PREPARING"], action);
      if (order.fulfilmentMethod !== "collection") {
        throw new Error("admin_collection_action_requires_collection");
      }
      return {
        nextStatus: "READY_FOR_COLLECTION",
        eventType: "ORDER_READY_FOR_COLLECTION",
      };

    case "complete":
      requireStatus(order.status, ["SHIPPED", "READY_FOR_COLLECTION"], action);
      return {
        nextStatus: "COMPLETED",
        timestampField: "completed_at",
        eventType: "ORDER_COMPLETED",
      };

    case "cancel":
      requireStatus(
        order.status,
        ["SUBMITTED", "UNDER_REVIEW", "QUOTED", "AWAITING_PAYMENT"],
        action,
      );
      return {
        nextStatus: "CANCELLED",
        paymentStatus:
          order.paymentStatus === "PAYMENT_REQUESTED" ? "CANCELLED" : order.paymentStatus,
        timestampField: "cancelled_at",
        eventType: "ORDER_CANCELLED",
        note: optionalText(input.note, 1000),
      };

    case "record_refund":
      requireStatus(
        order.status,
        ["PAID", "PREPARING", "SHIPPED", "READY_FOR_COLLECTION", "COMPLETED"],
        action,
      );
      requirePaidForRefund(order, action);
      return {
        nextStatus: order.status,
        paymentStatus: "REFUNDED",
        eventType: "PAYMENT_REFUNDED",
        note: optionalText(input.note, 1000),
      };

    case "refund_and_cancel":
      requireStatus(
        order.status,
        ["PAID", "PREPARING", "SHIPPED", "READY_FOR_COLLECTION"],
        action,
      );
      requirePaidForRefund(order, action);
      return {
        nextStatus: "CANCELLED",
        paymentStatus: "REFUNDED",
        timestampField: "cancelled_at",
        eventType: "ORDER_REFUNDED_AND_CANCELLED",
        note: optionalText(input.note, 1000),
      };

    default:
      throw new Error("admin_unknown_action");
  }
}
