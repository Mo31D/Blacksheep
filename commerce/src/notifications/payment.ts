import type { D1DatabaseLike } from "../data/d1";
import { recordOrderEvent } from "../data/order-events";
import type { SendEmailBindingLike } from "./order-notifier";

export interface PaymentNotificationEnv {
  DB?: D1DatabaseLike;
  EMAIL?: SendEmailBindingLike;
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
  send: () => Promise<void>,
): Promise<void> {
  if (!env.DB || !env.EMAIL || !env.ORDER_EMAIL_FROM) return;

  for (let attemptNumber = 1; attemptNumber <= 2; attemptNumber += 1) {
    try {
      await send();
      await recordOrderEvent(env.DB, {
        orderId,
        eventType: `${eventPrefix}_SENT`,
        metadata: {
          provider: "cloudflare-email",
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
            provider: "cloudflare-email",
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
  if (
    !env.EMAIL ||
    !env.ORDER_EMAIL_FROM ||
    order.finalTotalMinor === null ||
    !order.paymentRequestUrl
  ) {
    return;
  }

  const total = money(order.finalTotalMinor);
  await attempt(env, order.id, "PAYMENT_REQUEST_EMAIL", async () => {
    await env.EMAIL!.send({
      from: { email: env.ORDER_EMAIL_FROM!, name: "The Black Sheep Shop" },
      to: { email: order.customerEmail, name: order.customerName },
      subject: `Payment request for ${order.publicReference}`,
      text: [
        `Hello ${order.customerName},`,
        "",
        `Your Black Sheep Shop order request ${order.publicReference} has been reviewed.`,
        `Final total: ${total}.`,
        "",
        "Use the secure payment request below:",
        order.paymentRequestUrl!,
        "",
        "Please only pay the amount shown above. If anything looks wrong, contact the shop before paying.",
      ].join("\n"),
      html: `<p>Hello ${escapeHtml(order.customerName)},</p><p>Your Black Sheep Shop order request <strong>${escapeHtml(order.publicReference)}</strong> has been reviewed.</p><p>Final total: <strong>${total}</strong>.</p><p><a href="${escapeHtml(order.paymentRequestUrl!)}">Open secure payment request</a></p><p>Please only pay the amount shown above. If anything looks wrong, contact the shop before paying.</p>`,
    });
  });
}

export async function notifyPaymentConfirmed(
  env: PaymentNotificationEnv,
  order: PaymentNotificationSnapshot,
): Promise<void> {
  if (!env.EMAIL || !env.ORDER_EMAIL_FROM) return;

  await attempt(env, order.id, "PAYMENT_CONFIRMED_EMAIL", async () => {
    await env.EMAIL!.send({
      from: { email: env.ORDER_EMAIL_FROM!, name: "The Black Sheep Shop" },
      to: { email: order.customerEmail, name: order.customerName },
      subject: `Payment received for ${order.publicReference}`,
      text: [
        `Hello ${order.customerName},`,
        "",
        `Payment has been recorded for order ${order.publicReference}.`,
        order.fulfilmentMethod === "collection"
          ? "We will contact you when it is ready to collect."
          : "We will prepare your order for delivery.",
      ].join("\n"),
      html: `<p>Hello ${escapeHtml(order.customerName)},</p><p>Payment has been recorded for order <strong>${escapeHtml(order.publicReference)}</strong>.</p><p>${order.fulfilmentMethod === "collection" ? "We will contact you when it is ready to collect." : "We will prepare your order for delivery."}</p>`,
    });
  });
}
