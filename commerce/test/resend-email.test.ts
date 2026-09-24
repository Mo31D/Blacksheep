import { describe, expect, it } from "vitest";
import {
  ResendEmailSender,
  ResendSendError,
} from "../src/notifications/resend-email";

describe("ResendEmailSender", () => {
  it("trims the API key and posts the expected payload", async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const sender = new ResendEmailSender(
      "  re_test_secret\n",
      async (input, init) => {
        calls.push({ input, init });
        return new Response(JSON.stringify({ id: "email-1" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    );

    await sender.send({
      from: { email: "orders@theblacksheepshop.co.uk", name: "The Black Sheep Shop" },
      to: { email: "customer@example.com", name: "Customer" },
      subject: "Order received",
      text: "Test",
      html: "<p>Test</p>",
    });

    expect(calls).toHaveLength(1);
    expect(String(calls[0].input)).toBe("https://api.resend.com/emails");
    expect(calls[0].init?.headers).toMatchObject({
      Authorization: "Bearer re_test_secret",
      "Content-Type": "application/json",
    });

    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.from).toBe("The Black Sheep Shop <orders@theblacksheepshop.co.uk>");
    expect(body.to).toEqual(["Customer <customer@example.com>"]);
    expect(JSON.stringify(body)).not.toContain("re_test_secret");
  });

  it("reports HTTP rejections without persisting response text", async () => {
    const sender = new ResendEmailSender(
      "re_test_secret",
      async () =>
        new Response(JSON.stringify({ name: "invalid_api_key", message: "secret detail" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
    );

    try {
      await sender.send({
        from: "orders@theblacksheepshop.co.uk",
        to: "customer@example.com",
        subject: "Order received",
        text: "Test",
        html: "<p>Test</p>",
      });
      throw new Error("expected sender to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ResendSendError);
      expect((error as ResendSendError).status).toBe(401);
      expect((error as ResendSendError).providerCode).toBe("invalid_api_key");
      expect(String(error)).not.toContain("secret detail");
    }
  });

  it("reports transport failures safely", async () => {
    const sender = new ResendEmailSender(
      "re_test_secret",
      async () => {
        throw new TypeError("Invalid header value");
      },
    );

    await expect(
      sender.send({
        from: "orders@theblacksheepshop.co.uk",
        to: "customer@example.com",
        subject: "Order received",
        text: "Test",
        html: "<p>Test</p>",
      }),
    ).rejects.toMatchObject({
      status: 0,
      providerCode: "transport_error",
    });
  });
});
