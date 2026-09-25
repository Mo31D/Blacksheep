import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { handleResendWebhook } from "../src/routes/resend-webhook";

class Statement implements D1PreparedStatementLike {
  values: unknown[] = [];

  constructor(
    public readonly sql: string,
    private readonly firstValue: unknown = null,
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    return (this.firstValue as T | null) ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: [] };
  }

  async run(): Promise<unknown> {
    return {};
  }
}

class WebhookDb implements D1DatabaseLike {
  batched: Statement[] = [];

  prepare(query: string): Statement {
    if (query.includes("FROM email_webhook_events")) {
      return new Statement(query, null);
    }
    if (query.includes("FROM order_messages")) {
      return new Statement(query, {
        id: "message-1",
        orderId: "order-1",
      });
    }
    return new Statement(query);
  }

  async batch<T>(statements: D1PreparedStatementLike[]): Promise<T[]> {
    this.batched = statements as Statement[];
    return [] as T[];
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function signature(
  secretBytes: Uint8Array,
  id: string,
  timestamp: string,
  payload: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(id + "." + timestamp + "." + payload),
  );
  return "v1," + toBase64(new Uint8Array(signed));
}

describe("Resend webhook receiver", () => {
  it("verifies the raw signed payload and records a delivered event", async () => {
    const db = new WebhookDb();
    const secretBytes = new TextEncoder().encode(
      "0123456789abcdef0123456789abcdef",
    );
    const secret = "whsec_" + toBase64(secretBytes);
    const id = "msg_webhook_123";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const payload = JSON.stringify({
      type: "email.delivered",
      created_at: new Date().toISOString(),
      data: {
        email_id: "resend-message-123",
      },
    });
    const sig = await signature(secretBytes, id, timestamp, payload);

    const response = await handleResendWebhook(
      new Request("https://api.example.com/webhooks/resend", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "svix-id": id,
          "svix-timestamp": timestamp,
          "svix-signature": sig,
        },
        body: payload,
      }),
      {
        DB: db,
        RESEND_WEBHOOK_SECRET: secret,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      duplicate: false,
      tracked: true,
      status: "DELIVERED",
    });

    expect(db.batched).toHaveLength(3);
    expect(db.batched[0].sql).toContain("email_webhook_events");
    expect(db.batched[1].sql).toContain("UPDATE order_messages");
    expect(db.batched[1].values).toContain("DELIVERED");
    expect(db.batched[2].values).toContain("EMAIL_DELIVERED");
  });

  it("rejects a modified payload before parsing or database updates", async () => {
    const db = new WebhookDb();
    const secretBytes = new TextEncoder().encode(
      "0123456789abcdef0123456789abcdef",
    );
    const secret = "whsec_" + toBase64(secretBytes);
    const id = "msg_webhook_456";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const original = JSON.stringify({
      type: "email.sent",
      data: { email_id: "resend-message-456" },
    });
    const sig = await signature(secretBytes, id, timestamp, original);
    const tampered = JSON.stringify({
      type: "email.bounced",
      data: { email_id: "resend-message-456" },
    });

    const response = await handleResendWebhook(
      new Request("https://api.example.com/webhooks/resend", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "svix-id": id,
          "svix-timestamp": timestamp,
          "svix-signature": sig,
        },
        body: tampered,
      }),
      {
        DB: db,
        RESEND_WEBHOOK_SECRET: secret,
      },
    );

    expect(response.status).toBe(401);
    expect(db.batched).toHaveLength(0);
  });
});
