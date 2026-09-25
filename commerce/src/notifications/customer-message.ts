import type { D1DatabaseLike } from "../data/d1";
import { recordOrderEvent } from "../data/order-events";
import { resolveEmailSender, type EmailProviderEnv } from "./email-provider";
import {
  escapeEmailHtml,
  renderTransactionalEmail,
} from "./email-template";
import type { PaymentNotificationSnapshot } from "./payment";

export interface CustomerMessageEnv extends EmailProviderEnv {
  DB?: D1DatabaseLike;
  ORDER_EMAIL_FROM?: string;
}

export type OwnerCustomerMessageKind =
  | "CUSTOM_MESSAGE"
  | "AVAILABILITY_UPDATE"
  | "PAYMENT_REMINDER";

export interface OwnerCustomerMessageInput {
  kind: OwnerCustomerMessageKind;
  subject: string;
  body: string;
  actorEmail: string;
  reviewUrl?: string | null;
}

function messageIdFromResult(result: unknown): string | null {
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  const id = (result as Record<string, unknown>).id;
  return typeof id === "string" && id.length <= 200 ? id : null;
}

function validateText(
  value: string,
  min: number,
  max: number,
  code: string,
): string {
  const text = String(value ?? "").trim();
  if (text.length < min || text.length > max) throw new Error(code);
  return text;
}

function eventPrefix(kind: OwnerCustomerMessageKind): string {
  if (kind === "PAYMENT_REMINDER") return "PAYMENT_REMINDER_EMAIL";
  if (kind === "AVAILABILITY_UPDATE") return "AVAILABILITY_UPDATE_EMAIL";
  return "CUSTOMER_MESSAGE_EMAIL";
}

export async function sendOwnerCustomerMessage(
  env: CustomerMessageEnv,
  order: PaymentNotificationSnapshot,
  input: OwnerCustomerMessageInput,
): Promise<{
  messageId: string;
  providerMessageId: string | null;
  status: "SENT";
}> {
  if (!env.DB || !env.ORDER_EMAIL_FROM) {
    throw new Error("customer_message_not_configured");
  }

  const resolved = resolveEmailSender(env);
  if (!resolved) throw new Error("customer_message_not_configured");

  const subject = validateText(
    input.subject,
    2,
    150,
    "customer_message_invalid_subject",
  );
  const body = validateText(
    input.body,
    2,
    4000,
    "customer_message_invalid_body",
  );

  const reviewUrl =
    input.reviewUrl && input.reviewUrl.startsWith("https://")
      ? input.reviewUrl
      : null;
  const messageId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const title =
    input.kind === "PAYMENT_REMINDER"
      ? "A reminder about your order"
      : input.kind === "AVAILABILITY_UPDATE"
        ? "Your order has been reviewed"
        : "A message from The Black Sheep Shop";

  const message = renderTransactionalEmail({
    preheader: subject,
    eyebrow:
      input.kind === "PAYMENT_REMINDER"
        ? "Payment reminder"
        : input.kind === "AVAILABILITY_UPDATE"
          ? "Order update"
          : "Customer message",
    title,
    reference: order.publicReference,
    greeting: "Hello " + order.customerName + ",",
    bodyText: body,
    bodyHtml:
      '<div style="border-left:4px solid #b9822f;background:#f8f4eb;border-radius:0 12px 12px 0;padding:15px 17px;margin:18px 0;font-size:15px;line-height:1.7;white-space:pre-wrap">' +
      escapeEmailHtml(body) +
      "</div>",
    cta: reviewUrl
      ? {
          label:
            input.kind === "PAYMENT_REMINDER"
              ? "Review order & pay"
              : "Review order changes",
          url: reviewUrl,
        }
      : input.kind === "PAYMENT_REMINDER" && order.paymentRequestUrl
        ? { label: "Pay securely", url: order.paymentRequestUrl }
        : undefined,
    afterCtaText:
      input.kind === "PAYMENT_REMINDER"
        ? "If you have already paid or need to change anything, reply to this email."
        : "You can reply directly to this email if you need help.",
    afterCtaHtml:
      '<p style="font-size:14px;line-height:1.65;color:#655f56;margin:4px 0 0">' +
      (input.kind === "PAYMENT_REMINDER"
        ? "If you have already paid or need to change anything, reply to this email."
        : "You can reply directly to this email if you need help.") +
      "</p>",
  });

  const prefix = eventPrefix(input.kind);
  let lastError: unknown = null;

  for (let attemptNumber = 1; attemptNumber <= 2; attemptNumber += 1) {
    try {
      const result = await resolved.sender.send({
        from: { email: env.ORDER_EMAIL_FROM, name: "The Black Sheep Shop" },
        to: { email: order.customerEmail, name: order.customerName },
        replyTo: {
          email: env.ORDER_EMAIL_FROM,
          name: "The Black Sheep Shop",
        },
        subject,
        text: message.text,
        html: message.html,
      });

      const providerMessageId = messageIdFromResult(result);
      const sentAt = new Date().toISOString();

      await env.DB.batch([
        env.DB
          .prepare(
            `INSERT INTO order_messages (
              id, order_id, revision_id, direction, kind,
              subject, body, delivery_status, provider,
              provider_message_id, created_by, created_at,
              sent_at, delivered_at, updated_at
            ) VALUES (?, ?, NULL, 'SHOP_TO_CUSTOMER', ?, ?, ?, 'SENT', ?, ?, ?, ?, ?, NULL, ?)`,
          )
          .bind(
            messageId,
            order.id,
            input.kind,
            subject,
            body,
            resolved.provider,
            providerMessageId,
            input.actorEmail,
            createdAt,
            sentAt,
            sentAt,
          ),
        env.DB
          .prepare(
            `INSERT INTO order_events (
              order_id, event_type, from_status, to_status,
              actor_type, actor_id, note, metadata_json, created_at
            ) VALUES (?, ?, NULL, NULL, 'admin', ?, NULL, ?, ?)`,
          )
          .bind(
            order.id,
            prefix + "_SENT",
            input.actorEmail,
            JSON.stringify({
              provider: resolved.provider,
              providerMessageId,
              messageId,
              attempts: attemptNumber,
            }),
            sentAt,
          ),
      ]);

      return { messageId, providerMessageId, status: "SENT" };
    } catch (cause) {
      lastError = cause;
      if (attemptNumber === 2) {
        const failedAt = new Date().toISOString();
        await env.DB.batch([
          env.DB
            .prepare(
              `INSERT INTO order_messages (
                id, order_id, revision_id, direction, kind,
                subject, body, delivery_status, provider,
                provider_message_id, created_by, created_at,
                sent_at, delivered_at, updated_at
              ) VALUES (?, ?, NULL, 'SHOP_TO_CUSTOMER', ?, ?, ?, 'FAILED', ?, NULL, ?, ?, NULL, NULL, ?)`,
            )
            .bind(
              messageId,
              order.id,
              input.kind,
              subject,
              body,
              resolved.provider,
              input.actorEmail,
              createdAt,
              failedAt,
            ),
          env.DB
            .prepare(
              `INSERT INTO order_events (
                order_id, event_type, from_status, to_status,
                actor_type, actor_id, note, metadata_json, created_at
              ) VALUES (?, ?, NULL, NULL, 'admin', ?, NULL, ?, ?)`,
            )
            .bind(
              order.id,
              prefix + "_FAILED",
              input.actorEmail,
              JSON.stringify({
                provider: resolved.provider,
                messageId,
                attempts: attemptNumber,
                error: "send_failed",
              }),
              failedAt,
            ),
        ]);
      }
    }
  }

  void lastError;
  throw new Error("customer_message_send_failed");
}
