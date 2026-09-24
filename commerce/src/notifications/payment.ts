import type { D1DatabaseLike } from "../data/d1";
import { recordOrderEvent } from "../data/order-events";
import { resolveEmailSender, type EmailProviderEnv } from "./email-provider";

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
}

function money(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

async function attempt(
  env: PaymentNotificationEnv,
  orderId: string,
  eventPrefix: string,
  provider: string,
  send: () => Promise<void>,
): Promise<void> {
  if (!env.DB || !env.ORDER_EMAIL_FROM) return;

  for (let attemptNumber = 1; attemptNumber <= 2; attemptNumber += 1) {
    try {
      await send();
      await recordOrderEvent(env.DB, {
        orderId,
        eventType: `${eventPrefix}_SENT`,
        metadata: {
          provider,
          attempts: attemptNumber,
        },
      });
      return;
    } catch {
      if (attemptNumber === 2) {
        await recordOrderEvent(env.DB, {
          orderId,
          eventType: `${eventPrefix}_FAILED`,
          metadata: {
            provider,
            attempts: attemptNumber,
            error: "send_failed",
          },
        });
      }
    }
  }
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

  const total = money(order.finalTotalMinor);
  await attempt(env, order.id, "PAYMENT_REQUEST_EMAIL", resolved.provider, async () => {
    await resolved.sender.send({
      from: { email: env.ORDER_EMAIL_FROM!, name: "The Black Sheep Shop" },
      to: { email: order.customerEmail, name: order.customerName },
      subject: `Payment request for ${order.publicReference}`,
      text: [
        `Hello ${order.customerName},`,
        "",
        `Your Black Sheep Shop order request ${order.publicReference} has been reviewed and the requested goods are available.`,
        `Final total: ${total}.`,
        `Delivery / collection timing: ${order.fulfilmentMessage}.`,
        "",
        "If you wish to proceed, use the secure payment request below:",
        order.paymentRequestUrl!,
        "",
        "Paying the request accepts the final total and places the order. No card or online-banking details are stored by The Black Sheep Shop.",
        "",
        "For most distance orders, you can cancel within 14 days after receiving the goods. Delivery, returns and the model cancellation form:",
        "https://theblacksheepshop.co.uk/delivery-returns.html",
        "Order terms: https://theblacksheepshop.co.uk/terms.html",
        "Privacy: https://theblacksheepshop.co.uk/privacy.html",
        "",
        "The Black Sheep Shop, 2 Lancaster House, Lake Road, Ambleside, LA22 0AD · 07776 185647 · orders@theblacksheepshop.co.uk",
      ].join("\n"),
      html: `<p>Hello ${escapeHtml(order.customerName)},</p><p>Your Black Sheep Shop order request <strong>${escapeHtml(order.publicReference)}</strong> has been reviewed and the requested goods are available.</p><p>Final total: <strong>${total}</strong>.</p><p>Delivery / collection timing: <strong>${escapeHtml(order.fulfilmentMessage!)}</strong>.</p><p><a href="${escapeHtml(order.paymentRequestUrl!)}">Open secure payment request</a></p><p>Paying the request accepts the final total and places the order. No card or online-banking details are stored by The Black Sheep Shop.</p><p>For most distance orders, you can cancel within 14 days after receiving the goods. See <a href="https://theblacksheepshop.co.uk/delivery-returns.html">Delivery &amp; returns and the model cancellation form</a>, <a href="https://theblacksheepshop.co.uk/terms.html">Order terms</a> and <a href="https://theblacksheepshop.co.uk/privacy.html">Privacy</a>.</p><p>The Black Sheep Shop<br>2 Lancaster House, Lake Road, Ambleside, LA22 0AD<br>07776 185647 · orders@theblacksheepshop.co.uk</p>`,
    });
  });
}

export async function notifyPaymentConfirmed(
  env: PaymentNotificationEnv,
  order: PaymentNotificationSnapshot,
): Promise<void> {
  const resolved = resolveEmailSender(env);
  if (!resolved || !env.ORDER_EMAIL_FROM) return;

  await attempt(env, order.id, "PAYMENT_CONFIRMED_EMAIL", resolved.provider, async () => {
    await resolved.sender.send({
      from: { email: env.ORDER_EMAIL_FROM!, name: "The Black Sheep Shop" },
      to: { email: order.customerEmail, name: order.customerName },
      subject: `Payment received for ${order.publicReference}`,
      text: [
        `Hello ${order.customerName},`,
        "",
        `Payment has been recorded for order ${order.publicReference}. Your order is now confirmed.`,
        order.fulfilmentMethod === "collection"
          ? "We will contact you when it is ready to collect."
          : "We will prepare your order for delivery.",
      ].join("\n"),
      html: `<p>Hello ${escapeHtml(order.customerName)},</p><p>Payment has been recorded for order <strong>${escapeHtml(order.publicReference)}</strong>. Your order is now confirmed.</p><p>${order.fulfilmentMethod === "collection" ? "We will contact you when it is ready to collect." : "We will prepare your order for delivery."}</p>`,
    });
  });
}
