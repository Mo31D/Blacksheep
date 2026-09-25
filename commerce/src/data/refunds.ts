import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1";

export const REFUND_REASON_CODES = [
  "CUSTOMER_CANCELLED",
  "ITEM_UNAVAILABLE",
  "QUANTITY_REDUCED",
  "RETURNED_GOODS",
  "FAULTY_OR_DAMAGED",
  "DELIVERY_ADJUSTMENT",
  "PRICE_CORRECTION",
  "GOODWILL",
  "OTHER",
] as const;

export type RefundReasonCode = (typeof REFUND_REASON_CODES)[number];

export const REFUND_METHODS = [
  "ORIGINAL_METHOD",
  "BANK_TRANSFER",
  "CASH",
  "OTHER",
] as const;

export type RefundMethod = (typeof REFUND_METHODS)[number];

interface RefundOrderRow {
  id: string;
  publicReference: string;
  status: string;
  paymentStatus: string;
  currency: string;
  paidAmountMinor: number | null;
}

export interface RefundRecord {
  id: string;
  amountMinor: number;
  currency: string;
  reasonCode: RefundReasonCode;
  refundMethod: RefundMethod;
  externalReference: string | null;
  internalNote: string | null;
  createdBy: string;
  createdAt: string;
}

export interface RefundSummary {
  paidAmountMinor: number;
  refundedMinor: number;
  remainingRefundableMinor: number;
  fullyRefunded: boolean;
  refunds: RefundRecord[];
}

export interface RecordRefundInput {
  amountMinor: number;
  reasonCode: RefundReasonCode;
  refundMethod: RefundMethod;
  externalReference?: string | null;
  internalNote?: string | null;
  cancelOrder?: boolean;
}

function optionalText(
  value: unknown,
  maxLength: number,
  code: string,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(code);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(code);
  return text || null;
}

async function allRows<T>(statement: D1PreparedStatementLike): Promise<T[]> {
  if (!statement.all) throw new Error("d1_all_not_supported");
  return (await statement.all<T>()).results ?? [];
}

async function getRefundOrder(
  db: D1DatabaseLike,
  reference: string,
): Promise<RefundOrderRow | null> {
  return db
    .prepare(
      `SELECT
        o.id,
        o.public_reference AS publicReference,
        o.status,
        o.payment_status AS paymentStatus,
        o.currency,
        COALESCE(
          (
            SELECT r.final_total_minor
            FROM order_revisions r
            WHERE r.order_id = o.id AND r.state IN ('SENT', 'ACCEPTED')
            ORDER BY r.revision_number DESC
            LIMIT 1
          ),
          o.final_total_minor
        ) AS paidAmountMinor
      FROM orders o
      WHERE o.public_reference = ?
      LIMIT 1`,
    )
    .bind(reference)
    .first<RefundOrderRow>();
}

export async function getOrderRefundSummary(
  db: D1DatabaseLike,
  reference: string,
): Promise<RefundSummary | null> {
  const order = await getRefundOrder(db, reference);
  if (!order) return null;

  const refunds = await allRows<RefundRecord>(
    db
      .prepare(
        `SELECT
          r.id,
          r.amount_minor AS amountMinor,
          r.currency,
          r.reason_code AS reasonCode,
          r.refund_method AS refundMethod,
          r.external_reference AS externalReference,
          r.internal_note AS internalNote,
          r.created_by AS createdBy,
          r.created_at AS createdAt
        FROM refunds r
        WHERE r.order_id = ?
        ORDER BY r.created_at DESC, r.id DESC`,
      )
      .bind(order.id),
  );

  const paidAmountMinor = Number(order.paidAmountMinor ?? 0);
  const refundedMinor = refunds.reduce(
    (sum, refund) => sum + Number(refund.amountMinor || 0),
    0,
  );
  const remainingRefundableMinor = Math.max(0, paidAmountMinor - refundedMinor);

  return {
    paidAmountMinor,
    refundedMinor,
    remainingRefundableMinor,
    fullyRefunded: paidAmountMinor > 0 && remainingRefundableMinor === 0,
    refunds,
  };
}

export async function recordManualRefund(
  db: D1DatabaseLike,
  reference: string,
  input: RecordRefundInput,
  actorEmail: string,
): Promise<RefundSummary> {
  const order = await getRefundOrder(db, reference);
  if (!order) throw new Error("refund_order_not_found");
  if (!["PAID", "REFUNDED"].includes(order.paymentStatus)) {
    throw new Error("refund_requires_paid_order");
  }

  if (
    !Number.isInteger(input.amountMinor) ||
    input.amountMinor <= 0 ||
    input.amountMinor > 10_000_000
  ) {
    throw new Error("refund_invalid_amount");
  }
  if (!REFUND_REASON_CODES.includes(input.reasonCode)) {
    throw new Error("refund_invalid_reason");
  }
  if (!REFUND_METHODS.includes(input.refundMethod)) {
    throw new Error("refund_invalid_method");
  }
  if (input.cancelOrder && order.status === "COMPLETED") {
    throw new Error("refund_completed_order_cannot_cancel");
  }

  const current = await getOrderRefundSummary(db, reference);
  if (!current) throw new Error("refund_order_not_found");
  if (current.paidAmountMinor <= 0) throw new Error("refund_paid_amount_missing");
  if (input.amountMinor > current.remainingRefundableMinor) {
    throw new Error("refund_exceeds_remaining_amount");
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const externalReference = optionalText(
    input.externalReference,
    160,
    "refund_invalid_external_reference",
  );
  const internalNote = optionalText(
    input.internalNote,
    1000,
    "refund_invalid_internal_note",
  );
  const refundedAfter = current.refundedMinor + input.amountMinor;
  const fullyRefunded = refundedAfter === current.paidAmountMinor;
  const nextPaymentStatus = fullyRefunded ? "REFUNDED" : "PAID";
  const nextOrderStatus = input.cancelOrder ? "CANCELLED" : order.status;
  const eventType = input.cancelOrder
    ? "ORDER_REFUNDED_AND_CANCELLED"
    : fullyRefunded
      ? "PAYMENT_REFUNDED"
      : "PAYMENT_PARTIALLY_REFUNDED";

  const statements: D1PreparedStatementLike[] = [
    db
      .prepare(
        `INSERT INTO refunds (
          id, order_id, amount_minor, currency, reason_code,
          refund_method, external_reference, internal_note,
          created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        order.id,
        input.amountMinor,
        order.currency,
        input.reasonCode,
        input.refundMethod,
        externalReference,
        internalNote,
        actorEmail,
        now,
      ),
    db
      .prepare(
        `UPDATE orders
        SET payment_status = ?,
            status = ?,
            updated_at = ?,
            cancelled_at = CASE WHEN ? = 'CANCELLED' THEN COALESCE(cancelled_at, ?) ELSE cancelled_at END
        WHERE id = ?`,
      )
      .bind(
        nextPaymentStatus,
        nextOrderStatus,
        now,
        nextOrderStatus,
        now,
        order.id,
      ),
    db
      .prepare(
        `INSERT INTO order_events (
          order_id, event_type, from_status, to_status,
          actor_type, actor_id, note, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, 'admin', ?, ?, ?, ?)`,
      )
      .bind(
        order.id,
        eventType,
        order.status,
        nextOrderStatus,
        actorEmail,
        internalNote,
        JSON.stringify({
          refundId: id,
          amountMinor: input.amountMinor,
          refundedAfterMinor: refundedAfter,
          paidAmountMinor: current.paidAmountMinor,
          remainingRefundableMinor: current.paidAmountMinor - refundedAfter,
          reasonCode: input.reasonCode,
          refundMethod: input.refundMethod,
          externalReference,
          fullyRefunded,
        }),
        now,
      ),
  ];

  await db.batch(statements);

  return {
    paidAmountMinor: current.paidAmountMinor,
    refundedMinor: refundedAfter,
    remainingRefundableMinor: current.paidAmountMinor - refundedAfter,
    fullyRefunded,
    refunds: [
      {
        id,
        amountMinor: input.amountMinor,
        currency: order.currency,
        reasonCode: input.reasonCode,
        refundMethod: input.refundMethod,
        externalReference,
        internalNote,
        createdBy: actorEmail,
        createdAt: now,
      },
      ...current.refunds,
    ],
  };
}
