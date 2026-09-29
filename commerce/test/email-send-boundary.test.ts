import { describe, expect, it } from "vitest";
import { sendEmailWithRetry } from "../src/notifications/send-attempt";
import { ResendEmailSender, ResendSendError } from "../src/notifications/resend-email";
import { sendOwnerCustomerMessage } from "../src/notifications/customer-message";
import { notifyOwnerCustomerQuestion } from "../src/notifications/customer-question";
import type { D1DatabaseLike, D1PreparedStatementLike } from "../src/data/d1";

const message = {
  from: "shop@example.com",
  to: "customer@example.com",
  subject: "Order update",
  text: "Update",
  html: "<p>Update</p>",
};

describe("email delivery boundary", () => {
  it("reuses a Resend idempotency key after an ambiguous transport failure", async () => {
    const keys: string[] = [];
    const sender = new ResendEmailSender("re_test_key", async (_url, init) => {
      keys.push((init?.headers as Record<string, string>)["Idempotency-Key"]);
      if (keys.length === 1) throw new TypeError("timeout");
      return new Response(JSON.stringify({ id: "accepted-1" }), { status: 200 });
    });

    await expect(sendEmailWithRetry(sender, message)).resolves.toMatchObject({
      attempts: 2,
      result: { id: "accepted-1" },
    });
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[0]).toBe(keys[1]);
  });

  it("does not retry permanent Resend rejection", async () => {
    let calls = 0;
    await expect(sendEmailWithRetry({ async send() {
      calls += 1;
      throw new ResendSendError(401, "invalid_api_key");
    } }, message)).rejects.toMatchObject({ attempts: 1 });
    expect(calls).toBe(1);
  });

  it("retries a transient rate limit with the same key", async () => {
    const keys: string[] = [];
    await expect(sendEmailWithRetry({ async send(input) {
      keys.push(input.idempotencyKey!);
      if (keys.length === 1) throw new ResendSendError(429, "rate_limit");
      return { id: "accepted-2" };
    } }, message)).resolves.toMatchObject({ attempts: 2 });
    expect(keys[0]).toBe(keys[1]);
  });

  it("never resends an accepted owner message after its audit batch fails", async () => {
    let sends = 0;
    const db: D1DatabaseLike = {
      prepare: (_sql) => ({
        bind: function (..._values: unknown[]): D1PreparedStatementLike { return this; },
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => ({}),
      }),
      batch: async () => { throw new Error("audit unavailable"); },
    };
    const result = await sendOwnerCustomerMessage({
      DB: db,
      EMAIL: { async send() { sends += 1; return { id: "accepted-3" }; } },
      ORDER_EMAIL_FROM: "shop@example.com",
    }, {
      id: "order-1", publicReference: "BSR-1", customerName: "Jane",
      customerEmail: "jane@example.com", finalTotalMinor: null,
      paymentRequestUrl: null, fulfilmentMethod: "collection",
      fulfilmentMessage: null,
    }, {
      kind: "CUSTOM_MESSAGE", subject: "An update", body: "Hello Jane",
      actorEmail: "owner@example.com",
    });
    expect(result.providerMessageId).toBe("accepted-3");
    expect(sends).toBe(1);
  });

  it("does not resend a customer question to the owner when event audit fails", async () => {
    let sends = 0;
    const db: D1DatabaseLike = {
      prepare: (_sql) => ({
        bind: function (..._values: unknown[]): D1PreparedStatementLike { return this; },
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => { throw new Error("audit unavailable"); },
      }),
      batch: async () => [],
    };
    await notifyOwnerCustomerQuestion({
      DB: db,
      EMAIL: { async send() { sends += 1; return { id: "accepted-4" }; } },
      ORDER_EMAIL_FROM: "shop@example.com",
      ORDER_OWNER_EMAIL: "owner@example.com",
    }, {
      orderId: "order-1", reference: "BSR-1", customerName: "Jane",
      customerEmail: "jane@example.com", body: "A question", messageId: "question-1",
    });
    expect(sends).toBe(1);
  });
});
