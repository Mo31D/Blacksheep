import { describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "../src/security/turnstile";

const input = {
  secret: "secret",
  token: "token",
  remoteIp: "203.0.113.10",
  idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
  expectedHostnames: ["theblacksheepshop.co.uk"],
  expectedAction: "order_request",
};

describe("Turnstile server verification", () => {
  it("accepts a valid token with expected hostname and action", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: true,
          hostname: "theblacksheepshop.co.uk",
          action: "order_request",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await verifyTurnstile(input, {
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result.success).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects a valid token returned for the wrong hostname", async () => {
    const result = await verifyTurnstile(input, {
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            success: true,
            hostname: "evil.example",
            action: "order_request",
          }),
          { status: 200 },
        )) as typeof fetch,
    });

    expect(result.success).toBe(false);
    expect(result["error-codes"]).toContain("hostname-mismatch");
  });

  it("rejects a valid token returned for the wrong action", async () => {
    const result = await verifyTurnstile(input, {
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            success: true,
            hostname: "theblacksheepshop.co.uk",
            action: "login",
          }),
          { status: 200 },
        )) as typeof fetch,
    });

    expect(result.success).toBe(false);
    expect(result["error-codes"]).toContain("action-mismatch");
  });

  it("preserves timeout-or-duplicate failures", async () => {
    const result = await verifyTurnstile(input, {
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            success: false,
            "error-codes": ["timeout-or-duplicate"],
          }),
          { status: 200 },
        )) as typeof fetch,
    });

    expect(result.success).toBe(false);
    expect(result["error-codes"]).toContain("timeout-or-duplicate");
  });
});
