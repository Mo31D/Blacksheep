import type { D1DatabaseLike } from "../data/d1";
import { recordOrderEvent } from "../data/order-events";
import { resolveEmailSender, type EmailProviderEnv } from "./email-provider";
import { emailMoney, escapeEmailHtml, renderTransactionalEmail } from "./email-template";
import type { PaymentNotificationSnapshot } from "./payment";

export interface RefundNotificationEnv extends EmailProviderEnv {
  DB?: D1DatabaseLike;
  ORDER_EMAIL_FROM?: string;
}

export interface RefundNotificationDetails {
  refundId: string;
  amountMinor: number;
  reasonCode: string;
  refundMethod: string;
  externalReference: string | null;
  remainingRefundableMinor: number;
  fullyRefunded: boolean;
  cancelled: boolean;
}

function reasonLabel(code: string): string {
  const labels: Record<string, string> = {
    CUSTOMER_CANCELLED: "Customer cancellation",
    ITEM_UNAVAILABLE: "Item unavailable",
    QUANTITY_REDUCED: "Quantity reduced",
    RETURNED_GOODS: "Returned goods",
    FAULTY_OR_DAMAGED: "Faulty or damaged item",
    DELIVERY_ADJUSTMENT: "Delivery adjustment",
    PRICE_CORRECTION: "Price correction",
    GOODWILL: "Goodwill",
    OTHER: "Other",
  };
  return labels[code] ?? code.replace(/_/g, " ").toLowerCase();
}

export async function notifyRefundRecorded(
  env: RefundNotificationEnv,
  order: PaymentNotificationSnapshot,
  refund: RefundNotificationDetails,
): Promise<void> {
  const resolved = resolveEmailSender(env);
  if (!resolved || !env.DB || !env.ORDER_EMAIL_FROM) return;

  const statusLine = refund.cancelled
    ? "This order has also been cancelled."
    : refund.fullyRefunded
      ? "This completes the refund recorded for this order."
      : "Amount still not refunded from the recorded order total: " +
        emailMoney(refund.remainingRefundableMinor) +
        ".";

  const bodyHtml =
    '<div style="border:1px solid #ded6c8;border-radius:14px;padding:16px 18px;background:#eef7f1;margin:18px 0">' +
    '<div style="font-size:13px;color:#52705e">Refund amount</div>' +
    '<div style="font-size:28px;font-weight:800;margin-top:4px">' +
    emailMoney(refund.amountMinor) +
    "</div>" +
    '<div style="font-size:14px;margin-top:12px"><span style="color:#655f56">Reason</span><br><strong>' +
    escapeEmailHtml(reasonLabel(refund.reasonCode)) +
    "</strong></div>" +
    (refund.externalReference
      ? '<div style="font-size:14px;margin-top:10px"><span style="color:#655f56">Reference</span><br><strong>' +
        escapeEmailHtml(refund.externalReference) +
        "</strong></div>"
      : "") +
    "</div>" +
    '<p style="font-size:15px;line-height:1.65;margin:0">' +
    escapeEmailHtml(statusLine) +
    "</p>" +
    '<p style="font-size:14px;line-height:1.6;color:#655f56">The time for returned funds to appear can depend on the payment method or bank.</p>';

  const message = renderTransactionalEmail({
    preheader: "Refund recorded · " + order.publicReference,
    eyebrow: refund.cancelled ? "Refund and cancellation" : "Refund recorded",
    title: refund.cancelled
      ? "Your refund has been recorded and the order cancelled"
      : refund.fullyRefunded
        ? "Your refund has been recorded"
        : "A partial refund has been recorded",
    reference: order.publicReference,
    greeting: "Hello " + order.customerName + ",",
    intro:
      "We have recorded money returned to you for this order using the payment method agreed with you.",
    bodyText: [
      "Refund amount: " + emailMoney(refund.amountMinor),
      "Reason: " + reasonLabel(refund.reasonCode),
      refund.externalReference
        ? "Refund reference: " + refund.externalReference
        : null,
      "",
      statusLine,
      "",
      "The time for returned funds to appear can depend on the payment method or bank.",
    ]
      .filter((line) => line !== null)
      .join("\n"),
    bodyHtml,
  });

  const eventPrefix = refund.cancelled
    ? "REFUND_CANCELLATION_EMAIL"
    : "REFUND_EMAIL";

  for (let attemptNumber = 1; attemptNumber <= 2; attemptNumber += 1) {
    try {
      await resolved.sender.send({
        from: { email: env.ORDER_EMAIL_FROM, name: "The Black Sheep Shop" },
        to: { email: order.customerEmail, name: order.customerName },
        replyTo: { email: env.ORDER_EMAIL_FROM, name: "The Black Sheep Shop" },
        subject:
          (refund.cancelled
            ? "Refund and cancellation"
            : refund.fullyRefunded
              ? "Refund recorded"
              : "Partial refund recorded") +
          " · " +
          order.publicReference,
        text: message.text,
        html: message.html,
      });
      await recordOrderEvent(env.DB, {
        orderId: order.id,
        eventType: eventPrefix + "_SENT",
        metadata: {
          provider: resolved.provider,
          attempts: attemptNumber,
          refundId: refund.refundId,
          amountMinor: refund.amountMinor,
        },
      });
      return;
    } catch {
      if (attemptNumber === 2) {
        await recordOrderEvent(env.DB, {
          orderId: order.id,
          eventType: eventPrefix + "_FAILED",
          metadata: {
            provider: resolved.provider,
            attempts: attemptNumber,
            refundId: refund.refundId,
            amountMinor: refund.amountMinor,
            error: "send_failed",
          },
        });
      }
    }
  }
}
