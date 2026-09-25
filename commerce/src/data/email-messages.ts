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

  return id;
}
