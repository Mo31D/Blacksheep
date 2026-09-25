import type { D1DatabaseLike } from "../data/d1";
import { recordOrderEvent } from "../data/order-events";
import {
  providerMessageIdFromResult,
  recordOutboundEmailAudit,
} from "../data/email-messages";
import { resolveEmailSender, type EmailProviderEnv } from "./email-provider";
import {
  emailMoney,
  escapeEmailHtml,
  renderTransactionalEmail,
} from "./email-template";
import type { PaymentNotificationSnapshot } from "./payment";

export interface LifecycleNotificationEnv extends EmailProviderEnv {
  DB?: D1DatabaseLike;
  ORDER_EMAIL_FROM?: string;
}

export type LifecycleNotificationKind =
  | "ready_for_collection"
  | "shipped"
  | "cancelled"
  | "refunded"
  | "refunded_and_cancelled";

interface LifecycleCopy {
  subject: string;
  eyebrow: string;
  title: string;
  intro: string;
  detail: string;
}

function copyFor(
  kind: LifecycleNotificationKind,
  order: PaymentNotificationSnapshot,
): LifecycleCopy {
  switch (kind) {
    case "ready_for_collection":
      return {
        subject: `Ready for collection · ${order.publicReference}`,
        eyebrow: "Ready for collection",
        title: "Your order is ready",
        intro:
          "Your order is ready to collect from The Black Sheep Shop in Ambleside.",
        detail: order.fulfilmentMessage
          ? `Collection timing: ${order.fulfilmentMessage}`
          : "Reply to this email if you need to arrange collection.",
      };
    case "shipped":
      return {
        subject: `Your order has been dispatched · ${order.publicReference}`,
        eyebrow: "Order dispatched",
        title: "Your order is on its way",
        intro: "We have dispatched your Black Sheep Shop order.",
        detail: order.fulfilmentMessage
          ? `Delivery timing: ${order.fulfilmentMessage}`
          : "We will use the delivery details confirmed with your order.",
      };
    case "cancelled":
      return {
        subject: `Order cancelled · ${order.publicReference}`,
        eyebrow: "Order cancelled",
        title: "Your order has been cancelled",
        intro:
          "This order request has been cancelled and will not be fulfilled.",
        detail:
          "If you did not expect this cancellation, reply to this email and we will check it.",
      };
    case "refunded":
      return {
        subject: `Refund recorded · ${order.publicReference}`,
        eyebrow: "Refund",
        title: "Your refund has been recorded",
        intro:
          "We have recorded the refund for this order using the payment method agreed with you.",
        detail:
          "The time for returned funds to appear can depend on the original payment method or bank.",
      };
    case "refunded_and_cancelled":
      return {
        subject: `Refund and cancellation · ${order.publicReference}`,
        eyebrow: "Refund and cancellation",
        title: "Your order has been refunded and cancelled",
        intro:
          "We have recorded the refund and cancelled this order so it will not be fulfilled.",
        detail:
          "The time for returned funds to appear can depend on the original payment method or bank.",
      };
  }
}

export async function notifyLifecycleUpdate(
  env: LifecycleNotificationEnv,
  order: PaymentNotificationSnapshot,
  kind: LifecycleNotificationKind,
): Promise<void> {
  const resolved = resolveEmailSender(env);
  if (!resolved || !env.DB || !env.ORDER_EMAIL_FROM) return;

  const copy = copyFor(kind, order);
  const amount =
    (kind === "refunded" || kind === "refunded_and_cancelled") &&
    order.finalTotalMinor !== null
      ? `Order total: ${emailMoney(order.finalTotalMinor)}`
      : null;

  const message = renderTransactionalEmail({
    preheader: copy.subject,
    eyebrow: copy.eyebrow,
    title: copy.title,
    reference: order.publicReference,
    greeting: `Hello ${order.customerName},`,
    intro: copy.intro,
    bodyText: [copy.detail, amount].filter(Boolean).join("\n"),
    bodyHtml: `
      <div style="border:1px solid #ded6c8;border-radius:14px;padding:16px 18px;background:#f8f4eb;margin:18px 0">
        <div style="font-size:15px;line-height:1.65">${escapeEmailHtml(copy.detail)}</div>
        ${amount ? `<div style="margin-top:12px;font-size:15px;font-weight:700">${escapeEmailHtml(amount)}</div>` : ""}
      </div>
    `,
  });

  const eventPrefix = {
    ready_for_collection: "READY_FOR_COLLECTION_EMAIL",
    shipped: "SHIPPED_EMAIL",
    cancelled: "CANCELLATION_EMAIL",
    refunded: "REFUND_EMAIL",
    refunded_and_cancelled: "REFUND_CANCELLATION_EMAIL",
  }[kind];

  for (let attemptNumber = 1; attemptNumber <= 2; attemptNumber += 1) {
    let result: unknown;
    try {
      result = await resolved.sender.send({
        from: { email: env.ORDER_EMAIL_FROM, name: "The Black Sheep Shop" },
        to: { email: order.customerEmail, name: order.customerName },
        replyTo: {
          email: env.ORDER_EMAIL_FROM,
          name: "The Black Sheep Shop",
        },
        subject: copy.subject,
        text: message.text,
        html: message.html,
      });
    } catch {
      if (attemptNumber === 2) {
        try {
          await recordOrderEvent(env.DB, {
            orderId: order.id,
            eventType: `${eventPrefix}_FAILED`,
            metadata: {
              provider: resolved.provider,
              attempts: attemptNumber,
              error: "send_failed",
            },
          });
          await recordOutboundEmailAudit(env.DB, {
            orderId: order.id,
            subject: copy.subject,
            body: message.text,
            provider: resolved.provider,
            deliveryStatus: "FAILED",
          });
        } catch {
          // Preserve the provider failure even if audit storage is unavailable.
        }
      }
      continue;
    }

    const providerMessageId = providerMessageIdFromResult(result);
    try {
      await recordOrderEvent(env.DB, {
        orderId: order.id,
        eventType: `${eventPrefix}_SENT`,
        metadata: {
          provider: resolved.provider,
          attempts: attemptNumber,
          providerMessageId,
        },
      });
      await recordOutboundEmailAudit(env.DB, {
        orderId: order.id,
        subject: copy.subject,
        body: message.text,
        provider: resolved.provider,
        providerMessageId,
        deliveryStatus: "SENT",
      });
    } catch {
      // Never resend a successful customer email because audit storage failed.
    }
    return;
  }
}
