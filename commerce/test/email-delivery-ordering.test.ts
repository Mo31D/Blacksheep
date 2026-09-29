import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { applyResendDeliveryEvent } from "../src/data/email-delivery";
import type { D1DatabaseLike, D1PreparedStatementLike } from "../src/data/d1";

class SqliteStatement implements D1PreparedStatementLike {
  values: unknown[] = [];
  constructor(readonly sqlite: DatabaseSync, readonly sql: string) {}
  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }
  async first<T>(): Promise<T | null> {
    return (this.sqlite.prepare(this.sql).get(...this.values as any[]) as T | undefined) ?? null;
  }
  async run(): Promise<unknown> {
    return { meta: { changes: Number(this.sqlite.prepare(this.sql).run(...this.values as any[]).changes) } };
  }
}

class SqliteDb implements D1DatabaseLike {
  readonly sqlite = new DatabaseSync(":memory:");
  constructor() {
    this.sqlite.exec(`
      CREATE TABLE email_webhook_events (
        webhook_event_id TEXT PRIMARY KEY, provider TEXT, event_type TEXT,
        provider_message_id TEXT, received_at TEXT, provider_created_at TEXT, claim_token TEXT
      );
      CREATE TABLE order_messages (
        id TEXT PRIMARY KEY, order_id TEXT, provider TEXT, provider_message_id TEXT,
        created_at TEXT, delivery_status TEXT, delivered_at TEXT, updated_at TEXT
      );
      CREATE TABLE order_events (
        order_id TEXT, event_type TEXT, from_status TEXT, to_status TEXT,
        actor_type TEXT, actor_id TEXT, note TEXT, metadata_json TEXT, created_at TEXT
      );
      INSERT INTO order_messages VALUES (
        'message-1', 'order-1', 'resend', 'provider-1',
        '2026-01-01T00:00:00Z', 'SENT', NULL, '2026-01-01T00:00:00Z'
      );
    `);
  }
  prepare(query: string): D1PreparedStatementLike {
    return new SqliteStatement(this.sqlite, query);
  }
  async batch<T>(statements: D1PreparedStatementLike[]): Promise<T[]> {
    this.sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec("COMMIT");
      return results as T[];
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
  status(): string {
    return String(this.sqlite.prepare("SELECT delivery_status FROM order_messages WHERE id = 'message-1'").get()?.delivery_status);
  }
}

describe("Resend delivery audit ordering", () => {
  it("keeps a terminal delivery state when earlier sent/delayed events arrive later", async () => {
    const db = new SqliteDb();
    const event = (id: string, eventType: string) => applyResendDeliveryEvent(db, {
      webhookEventId: id,
      eventType,
      providerMessageId: "provider-1",
      receivedAt: "2026-01-01T00:01:00Z",
    });

    expect((await event("event-delivered", "email.delivered")).tracked).toBe(true);
    expect(db.status()).toBe("DELIVERED");
    await event("event-sent-late", "email.sent");
    await event("event-delayed-late", "email.delivery_delayed");
    expect(db.status()).toBe("DELIVERED");
    await event("event-complained", "email.complained");
    expect(db.status()).toBe("COMPLAINED");
    await event("event-delayed-last", "email.delivery_delayed");
    expect(db.status()).toBe("COMPLAINED");
    db.sqlite.close();
  });

  it("keeps a delay when an earlier sent event arrives later", async () => {
    const db = new SqliteDb();
    await applyResendDeliveryEvent(db, {
      webhookEventId: "event-delay", eventType: "email.delivery_delayed",
      providerMessageId: "provider-1", receivedAt: "2026-01-01T00:01:00Z",
    });
    await applyResendDeliveryEvent(db, {
      webhookEventId: "event-sent", eventType: "email.sent",
      providerMessageId: "provider-1", receivedAt: "2026-01-01T00:02:00Z",
    });
    expect(db.status()).toBe("DELAYED");
    db.sqlite.close();
  });
});
