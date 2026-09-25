import { describe, expect, it } from "vitest";
import {
  validateAdminOrderAction,
  type AdminOrderState,
} from "../src/domain/admin-order";

const deliveryOrder: AdminOrderState = {
  id: "order-1",
  publicReference: "BSR-260924-ABCDEFGH",
  status: "UNDER_REVIEW",
  fulfilmentMethod: "delivery",
  itemsSubtotalMinor: 2500,
  deliveryAmountMinor: null,
  finalTotalMinor: null,
  paymentStatus: "UNPAID",
};

describe("admin order state machine", () => {
  it("calculates final totals server-side when quoting", () => {
    const action = validateAdminOrderAction(deliveryOrder, {
      action: "quote",
      deliveryAmountMinor: 495,
    });

    expect(action.nextStatus).toBe("QUOTED");
    expect(action.finalTotalMinor).toBe(2995);
    expect(action.deliveryAmountMinor).toBe(495);
  });

  it("requires zero delivery for collection quotes", () => {
    expect(() =>
      validateAdminOrderAction(
        { ...deliveryOrder, fulfilmentMethod: "collection" },
        { action: "quote", deliveryAmountMinor: 495 },
      ),
    ).toThrow("admin_collection_delivery_must_be_zero");
  });

  it("requires HTTPS payment request URLs", () => {
    expect(() =>
      validateAdminOrderAction(
        {
          ...deliveryOrder,
          status: "QUOTED",
          finalTotalMinor: 2995,
          deliveryAmountMinor: 495,
        },
        {
          action: "send_payment_request",
          paymentRequestUrl: "http://example.com/pay",
        },
      ),
    ).toThrow("admin_url_must_be_https");
  });

  it("requires fulfilment timing before sending a payment request", () => {
    expect(() =>
      validateAdminOrderAction(
        {
          ...deliveryOrder,
          status: "QUOTED",
          finalTotalMinor: 2995,
          deliveryAmountMinor: 495,
        },
        {
          action: "send_payment_request",
          paymentRequestUrl: "https://pay.example.test/order-1",
        },
      ),
    ).toThrow("admin_fulfilment_message_required");

    const action = validateAdminOrderAction(
      {
        ...deliveryOrder,
        status: "QUOTED",
        finalTotalMinor: 2995,
        deliveryAmountMinor: 495,
      },
      {
        action: "send_payment_request",
        paymentRequestUrl: "https://pay.example.test/order-1",
        fulfilmentMessage: "Expected dispatch within 2 working days",
      },
    );
    expect(action.fulfilmentMessage).toBe("Expected dispatch within 2 working days");
  });

  it("does not allow marking unpaid submitted orders as paid", () => {
    expect(() =>
      validateAdminOrderAction(
        { ...deliveryOrder, status: "SUBMITTED" },
        { action: "mark_paid" },
      ),
    ).toThrow("admin_transition_not_allowed");
  });

  it("routes fulfilment completion through shipped or ready-for-collection", () => {
    expect(
      validateAdminOrderAction(
        { ...deliveryOrder, status: "PREPARING" },
        { action: "mark_shipped" },
      ).nextStatus,
    ).toBe("SHIPPED");

    expect(
      validateAdminOrderAction(
        {
          ...deliveryOrder,
          status: "PREPARING",
          fulfilmentMethod: "collection",
        },
        { action: "ready_for_collection" },
      ).nextStatus,
    ).toBe("READY_FOR_COLLECTION");
  });

  it("records a manual full refund without pretending to move money", () => {
    const action = validateAdminOrderAction(
      {
        ...deliveryOrder,
        status: "COMPLETED",
        paymentStatus: "PAID",
        finalTotalMinor: 2995,
      },
      { action: "record_refund", note: "Refund sent by original payment method" },
    );

    expect(action.nextStatus).toBe("COMPLETED");
    expect(action.paymentStatus).toBe("REFUNDED");
    expect(action.eventType).toBe("PAYMENT_REFUNDED");
  });

  it("can record a refund and cancel a paid order before completion", () => {
    const action = validateAdminOrderAction(
      {
        ...deliveryOrder,
        status: "PREPARING",
        paymentStatus: "PAID",
        finalTotalMinor: 2995,
      },
      { action: "refund_and_cancel", note: "Customer changed mind" },
    );

    expect(action.nextStatus).toBe("CANCELLED");
    expect(action.paymentStatus).toBe("REFUNDED");
    expect(action.eventType).toBe("ORDER_REFUNDED_AND_CANCELLED");
    expect(action.timestampField).toBe("cancelled_at");
  });

  it("rejects refund recording when no paid payment exists", () => {
    expect(() =>
      validateAdminOrderAction(
        { ...deliveryOrder, status: "COMPLETED", paymentStatus: "UNPAID" },
        { action: "record_refund" },
      ),
    ).toThrow("admin_refund_requires_paid");
  });
});
