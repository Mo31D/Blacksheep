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
  itemsText,
  renderItemsTable,
  renderTransactionalEmail,
} from "./email-template";

export interface PaymentNotificationEnv extends EmailProviderEnv {
  DB?: D1DatabaseLike;
  ORDER_EMAIL_FROM?: string;
}

export interface PaymentNotificationSnapshot {
  id: string;
  publicReference: string;
  customerName: string;
  customerEmail: string;
  finalTotalMinor: number | null;
  paymentRequestUrl: string | null;
  fulfilmentMethod: string;
  fulfilmentMessage: string | null;
  revisionNumber?: number | null;
  customerMessage?: string | null;
  reviewUrl?: string | null;
  items?: Array<{
    productName: string;
    quantity: number;
    lineTotalMinor: number;
  }>;
}

async function attempt(
  env: PaymentNotificationEnv,
  orderId: string,
  eventPrefix: string,
  provider: string,
  audit: { subject: string; text: string },
  send: () => Promise<unknown>,
): Promise<void> {
  if (!env.DB || !env.ORDER_EMAIL_FROM) return;

  for (let attemptNumber = 1; attemptNumber <= 2; attemptNumber += 1) {
    let result: unknown;
    try {
      result = await send();
    } catch {
      if (attemptNumber === 2) {
        try {
          await recordOrderEvent(env.DB, {
            orderId,
            eventType: `${eventPrefix}_FAILED`,
            metadata: {
              provider,
              attempts: attemptNumber,
              error: "send_failed",
            },
          });
          await recordOutboundEmailAudit(env.DB, {
            orderId,
            subject: audit.subject,
            body: audit.text,
            provider,
            deliveryStatus: "FAILED",
          });
        } catch {
          // Email delivery failure must not be hidden by audit persistence failure.
        }
      }
      continue;
    }

    const providerMessageId = providerMessageIdFromResult(result);
    try {
      await recordOrderEvent(env.DB, {
        orderId,
        eventType: `${eventPrefix}_SENT`,
        metadata: {
          provider,
          attempts: attemptNumber,
          providerMessageId,
        },
      });
      await recordOutboundEmailAudit(env.DB, {
        orderId,
        subject: audit.subject,
        body: audit.text,
        provider,
        providerMessageId,
        deliveryStatus: "SENT",
      });
    } catch {
      // Do not send the customer a duplicate email if audit persistence fails.
    }
    return;
  }
}

function summaryHtml(order: PaymentNotificationSnapshot): string {
  const items = order.items ?? [];
  const reviewed = order.revisionNumber
    ? `Reviewed version ${order.revisionNumber}`
    : "Confirmed order";

  return `
    ${order.customerMessage ? `<div style="border-left:4px solid #b9822f;background:#f8f4eb;border-radius:0 12px 12px 0;padding:14px 16px;margin:18px 0"><div style="font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#756f64;font-weight:700;margin-bottom:6px">Message from the shop</div><div style="font-size:15px;line-height:1.6">${escapeEmailHtml(order.customerMessage)}</div></div>` : ""}
    ${items.length ? renderItemsTable(items) : ""}
    <div style="border:1px solid #ded6c8;border-radius:14px;padding:16px 18px;background:#f8f4eb;margin:18px 0">
      <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;color:#756f64"><span>${escapeEmailHtml(reviewed)}</span><span>${order.fulfilmentMethod === "collection" ? "Collection" : "Delivery"}</span></div>
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:end;margin-top:12px"><span style="font-size:14px">Final total</span><strong style="font-size:28px">${order.finalTotalMinor === null ? "—" : emailMoney(order.finalTotalMinor)}</strong></div>
      <div style="border-top:1px solid #ded6c8;margin-top:13px;padding-top:13px;font-size:14px"><span style="color:#756f64">Timing</span><br><strong>${escapeEmailHtml(order.fulfilmentMessage || "To be confirmed")}</strong></div>
    </div>
  `;
}

export async function notifyPaymentRequest(
  env: PaymentNotificationEnv,
  order: PaymentNotificationSnapshot,
): Promise<void> {
  const resolved = resolveEmailSender(env);
  if (
    !resolved ||
    !env.ORDER_EMAIL_FROM ||
    order.finalTotalMinor === null ||
    !order.paymentRequestUrl ||
    !order.fulfilmentMessage
  ) {
    return;
  }

  const items = order.items ?? [];
  const reviewFirst = Boolean(order.revisionNumber && order.reviewUrl);
  const primaryUrl = reviewFirst ? order.reviewUrl! : order.paymentRequestUrl;
  const message = renderTransactionalEmail({
    preheader: `Final total ${emailMoney(order.finalTotalMinor)} · payment request`,
    eyebrow: order.revisionNumber ? "Reviewed order" : "Order reviewed",
    title: "Your order is ready for confirmation",
    reference: order.publicReference,
    greeting: `Hello ${order.customerName},`,
    intro: order.revisionNumber
      ? "We have reviewed your request and prepared the confirmed version below. Please check the changes and total before paying."
      : "We have reviewed your request and confirmed the final total below.",
    bodyText: [
      order.customerMessage ? `Message from the shop: ${order.customerMessage}` : null,
      order.customerMessage ? "" : null,
      items.length ? itemsText(items) : null,
      items.length ? "" : null,
      `Final total: ${emailMoney(order.finalTotalMinor)}`,
      `Fulfilment: ${order.fulfilmentMethod === "collection" ? "Collection" : "Delivery"}`,
      `Timing: ${order.fulfilmentMessage}`,
    ]
      .filter((line) => line !== null)
      .join("\n"),
    bodyHtml: summaryHtml(order),
    cta: {
      label: reviewFirst ? "Review changes & pay" : "Pay securely",
      url: primaryUrl,
    },
    afterCtaText: reviewFirst
      ? "Review the confirmed version before continuing to secure payment. Paying confirms the reviewed order and final total shown in this message. The Black Sheep Shop does not store your card or online-banking details."
      : "Paying confirms the reviewed order and final total shown in this message. The Black Sheep Shop does not store your card or online-banking details.",
    afterCtaHtml: reviewFirst
      ? '<p style="font-size:14px;line-height:1.65;color:#655f56;margin:4px 0 0">Review the confirmed version before continuing to secure payment. Paying confirms the reviewed order and final total shown above. The Black Sheep Shop does not store your card or online-banking details.</p>'
      : '<p style="font-size:14px;line-height:1.65;color:#655f56;margin:4px 0 0">Paying confirms the reviewed order and final total shown above. The Black Sheep Shop does not store your card or online-banking details.</p>',
  });

  const subject = `Payment request for ${order.publicReference}`;
  await attempt(
    env,
    order.id,
    "PAYMENT_REQUEST_EMAIL",
    resolved.provider,
    { subject, text: message.text },
    () =>
      resolved.sender.send({
        from: { email: env.ORDER_EMAIL_FROM!, name: "The Black Sheep Shop" },
        to: { email: order.customerEmail, name: order.customerName },
        replyTo: {
          email: env.ORDER_EMAIL_FROM!,
          name: "The Black Sheep Shop",
        },
        subject,
        text: message.text,
        html: message.html,
      }),
  );
}

export async function notifyPaymentConfirmed(
  env: PaymentNotificationEnv,
  order: PaymentNotificationSnapshot,
): Promise<void> {
  const resolved = resolveEmailSender(env);
  if (!resolved || !env.ORDER_EMAIL_FROM) return;

  const message = renderTransactionalEmail({
    preheader: `Payment received for ${order.publicReference}`,
    eyebrow: "Payment received",
    title: "Your order is confirmed",
    reference: order.publicReference,
    greeting: `Hello ${order.customerName},`,
    intro:
      "Payment has been recorded successfully. We are now moving your order into fulfilment.",
    bodyText: [
      order.finalTotalMinor !== null
        ? `Amount recorded: ${emailMoney(order.finalTotalMinor)}`
        : null,
      order.fulfilmentMessage ? `Timing: ${order.fulfilmentMessage}` : null,
      "",
      order.fulfilmentMethod === "collection"
        ? "We will let you know when your order is ready to collect in Ambleside."
        : "We will let you know when your order is dispatched.",
    ]
      .filter((line) => line !== null)
      .join("\n"),
    bodyHtml: `
      <div style="border:1px solid #ded6c8;border-radius:14px;padding:16px 18px;background:#eef7f1;margin:18px 0">
        <div style="font-size:13px;color:#52705e">Payment status</div>
        <div style="font-size:22px;font-weight:800;margin-top:4px">Paid</div>
        ${order.finalTotalMinor !== null ? `<div style="font-size:15px;margin-top:9px">Amount recorded: <strong>${emailMoney(order.finalTotalMinor)}</strong></div>` : ""}
      </div>
      <p style="font-size:15px;line-height:1.65;margin:0">${order.fulfilmentMethod === "collection" ? "We will let you know when your order is ready to collect in Ambleside." : "We will let you know when your order is dispatched."}</p>
      ${order.fulfilmentMessage ? `<p style="font-size:14px;line-height:1.6;color:#655f56">Current timing: <strong>${escapeEmailHtml(order.fulfilmentMessage)}</strong></p>` : ""}
    `,
  });

  const subject = `Payment received for ${order.publicReference}`;
  await attempt(
    env,
    order.id,
    "PAYMENT_CONFIRMED_EMAIL",
    resolved.provider,
    { subject, text: message.text },
    () =>
      resolved.sender.send({
        from: { email: env.ORDER_EMAIL_FROM!, name: "The Black Sheep Shop" },
        to: { email: order.customerEmail, name: order.customerName },
        replyTo: {
          email: env.ORDER_EMAIL_FROM!,
          name: "The Black Sheep Shop",
        },
        subject,
        text: message.text,
        html: message.html,
      }),
  );
}
