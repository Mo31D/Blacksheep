import type { D1DatabaseLike } from "./d1";

export interface OrderEventInput {
  orderId: string;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorType?: "system" | "customer" | "admin" | "payment_provider";
  actorId?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export async function recordOrderEvent(
  db: D1DatabaseLike,
  input: OrderEventInput,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO order_events (
        order_id,
        event_type,
        from_status,
        to_status,
        actor_type,
        actor_id,
        note,
        metadata_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.orderId,
      input.eventType,
      input.fromStatus ?? null,
      input.toStatus ?? null,
      input.actorType ?? "system",
      input.actorId ?? null,
      input.note ?? null,
      JSON.stringify(input.metadata ?? {}),
      input.createdAt ?? new Date().toISOString(),
    )
    .run();
}
