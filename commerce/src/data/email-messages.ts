import type { D1DatabaseLike } from "./d1";

export interface OutboundEmailAuditInput {
  orderId: string;
  kind?: "SYSTEM_NOTIFICATION" | "CUSTOM_MESSAGE" | "AVAILABILITY_UPDATE" | "PAYMENT_REMINDER";
  subject: string;
  body: string;
  provider: string;
  providerMessageId?: string | null;
  createdBy?: string;
  deliveryStatus?: "SENT" | "FAILED";
  createdAt?: string;
}

export function providerMessageIdFromResult(result: unknown): string | null {
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  const id = (result as Record<string, unknown>).id;
  return typeof id === "string" && id.length > 0 && id.length <= 200
    ? id
    : null;
}

export async function recordOutboundEmailAudit(
  db: D1DatabaseLike,
  input: OutboundEmailAuditInput,
): Promise<string> {
  const id = crypto.randomUUID();
  const createdAt = input.createdAt ?? new Date().toISOString();
  const status = input.deliveryStatus ?? "SENT";

  await db
    .prepare(
      `INSERT INTO order_messages (
        id, order_id, revision_id, direction, kind,
        subject, body, delivery_status, provider,
        provider_message_id, created_by, created_at,
        sent_at, delivered_at, updated_at
      ) VALUES (?, ?, NULL, 'SHOP_TO_CUSTOMER', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    )
    .bind(
      id,
      input.orderId,
      input.kind ?? "SYSTEM_NOTIFICATION",
      input.subject,
      input.body,
      status,
      input.provider,
      input.providerMessageId ?? null,
      input.createdBy ?? "system",
      createdAt,
      status === "SENT" ? createdAt : null,
      createdAt,
    )
    .run();

  if (input.provider === "resend" && input.providerMessageId) {
    const pending = await db
      .prepare(
        `SELECT event_type AS eventType, received_at AS receivedAt
        FROM email_webhook_events
        WHERE provider = 'resend' AND provider_message_id = ?
        ORDER BY received_at DESC
        LIMIT 1`,
      )
      .bind(input.providerMessageId)
      .first<{ eventType: string; receivedAt: string }>();

    const deliveryStatus =
      pending?.eventType === "email.delivered"
        ? "DELIVERED"
        : pending?.eventType === "email.delivery_delayed"
          ? "DELAYED"
          : pending?.eventType === "email.bounced"
            ? "BOUNCED"
            : pending?.eventType === "email.complained"
              ? "COMPLAINED"
              : pending?.eventType === "email.failed" ||
                  pending?.eventType === "email.suppressed"
                ? "FAILED"
                : pending?.eventType === "email.sent"
                  ? "SENT"
                  : null;

    if (deliveryStatus && pending) {
      await db
        .prepare(
          `UPDATE order_messages
          SET delivery_status = ?,
              delivered_at = CASE WHEN ? = 'DELIVERED' THEN COALESCE(delivered_at, ?) ELSE delivered_at END,
              updated_at = ?
          WHERE id = ?`,
        )
        .bind(
          deliveryStatus,
          deliveryStatus,
          pending.receivedAt,
          pending.receivedAt,
          id,
        )
        .run();
    }
  }

  return id;
}
