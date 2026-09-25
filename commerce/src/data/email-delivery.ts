import {
  d1StatementChanged,
  type D1DatabaseLike,
  type D1PreparedStatementLike,
} from "./d1";

export type EmailDeliveryStatus =
  | "SENT"
  | "DELIVERED"
  | "DELAYED"
  | "BOUNCED"
  | "COMPLAINED"
  | "FAILED";

export interface ResendDeliveryEvent {
  webhookEventId: string;
  eventType: string;
  providerMessageId: string;
  providerCreatedAt?: string | null;
  receivedAt: string;
}

function mapStatus(eventType: string): EmailDeliveryStatus | null {
  switch (eventType) {
    case "email.sent":
      return "SENT";
    case "email.delivered":
      return "DELIVERED";
    case "email.delivery_delayed":
      return "DELAYED";
    case "email.bounced":
      return "BOUNCED";
    case "email.complained":
      return "COMPLAINED";
    case "email.failed":
    case "email.suppressed":
      return "FAILED";
    default:
      return null;
  }
}

function orderEventType(status: EmailDeliveryStatus): string {
  return "EMAIL_" + status;
}

export async function applyResendDeliveryEvent(
  db: D1DatabaseLike,
  event: ResendDeliveryEvent,
): Promise<{
  duplicate: boolean;
  tracked: boolean;
  status: EmailDeliveryStatus | null;
}> {
  const existing = await db
    .prepare(
      "SELECT webhook_event_id AS webhookEventId FROM email_webhook_events WHERE webhook_event_id = ? LIMIT 1",
    )
    .bind(event.webhookEventId)
    .first<{ webhookEventId: string }>();

  if (existing) {
    return { duplicate: true, tracked: false, status: mapStatus(event.eventType) };
  }

  const status = mapStatus(event.eventType);
  const claimToken = crypto.randomUUID();
  const message = status
    ? await db
        .prepare(
          `SELECT id, order_id AS orderId
          FROM order_messages
          WHERE provider = 'resend' AND provider_message_id = ?
          ORDER BY created_at DESC
          LIMIT 1`,
        )
        .bind(event.providerMessageId)
        .first<{ id: string; orderId: string }>()
    : null;

  const statements: D1PreparedStatementLike[] = [
    db
      .prepare(
        `INSERT OR IGNORE INTO email_webhook_events (
          webhook_event_id, provider, event_type,
          provider_message_id, received_at, provider_created_at, claim_token
        ) VALUES (?, 'resend', ?, ?, ?, ?, ?)`,
      )
      .bind(
        event.webhookEventId,
        event.eventType,
        event.providerMessageId,
        event.receivedAt,
        event.providerCreatedAt ?? null,
        claimToken,
      ),
  ];

  if (status && message) {
    statements.push(
      db
        .prepare(
          `UPDATE order_messages
          SET delivery_status = ?,
              delivered_at = CASE WHEN ? = 'DELIVERED' THEN COALESCE(delivered_at, ?) ELSE delivered_at END,
              updated_at = ?
          WHERE id = ?
            AND EXISTS (
              SELECT 1 FROM email_webhook_events
              WHERE webhook_event_id = ? AND claim_token = ?
            )`,
        )
        .bind(
          status,
          status,
          event.receivedAt,
          event.receivedAt,
          message.id,
          event.webhookEventId,
          claimToken,
        ),
    );

    statements.push(
      db
        .prepare(
          `INSERT INTO order_events (
            order_id, event_type, from_status, to_status,
            actor_type, actor_id, note, metadata_json, created_at
          )
          SELECT ?, ?, NULL, NULL, 'system', NULL, NULL, ?, ?
          WHERE EXISTS (
            SELECT 1 FROM email_webhook_events
            WHERE webhook_event_id = ? AND claim_token = ?
          )`,
        )
        .bind(
          message.orderId,
          orderEventType(status),
          JSON.stringify({
            provider: "resend",
            providerMessageId: event.providerMessageId,
            webhookEventId: event.webhookEventId,
            sourceEventType: event.eventType,
            messageId: message.id,
          }),
          event.receivedAt,
          event.webhookEventId,
          claimToken,
        ),
    );
  }

  const results = await db.batch(statements);
  if (d1StatementChanged(results[0]) === false) {
    return { duplicate: true, tracked: false, status };
  }
  return { duplicate: false, tracked: Boolean(message), status };
}
