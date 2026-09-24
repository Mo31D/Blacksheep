import { describe, expect, it } from "vitest";
import { ResendEmailSender } from "../src/notifications/resend-email";

describe("ResendEmailSender", () => {
  it("posts the expected payload without exposing the API key in the body", async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const sender = new ResendEmailSender(
      "re_test_secret",
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
      authorization: "Bearer re_test_secret",
      "content-type": "application/json",
    });

    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.from).toBe("The Black Sheep Shop <orders@theblacksheepshop.co.uk>");
    expect(body.to).toEqual(["Customer <customer@example.com>"]);
    expect(JSON.stringify(body)).not.toContain("re_test_secret");
  });

  it("throws a provider-safe error on non-success responses", async () => {
    const sender = new ResendEmailSender(
      "re_test_secret",
      async () => new Response("bad request", { status: 400 }),
    );

    await expect(
      sender.send({
        from: "orders@theblacksheepshop.co.uk",
        to: "customer@example.com",
        subject: "Order received",
        text: "Test",
        html: "<p>Test</p>",
      }),
    ).rejects.toThrow("resend_send_failed");
  });
});
