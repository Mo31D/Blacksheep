import { describe, expect, it } from "vitest";
import worker from "../src/index";

const env = {
  ENVIRONMENT: "test",
  ALLOWED_ORIGINS: "https://theblacksheepshop.co.uk,http://localhost:8787",
  DB: {
    prepare() {
      throw new Error("Health route must not query D1.");
    },
    batch() {
      throw new Error("Health route must not query D1.");
    },
  },
};

describe("commerce worker", () => {
  it("returns a healthy service response and reports the D1 binding", async () => {
    const response = await worker.fetch(
      new Request("https://api.example.test/health"),
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      service: "black-sheep-commerce-api",
      status: "ok",
      environment: "test",
      database: "bound",
      notifications: {
        provider: "unconfigured",
        fromConfigured: false,
        ownerConfigured: false,
      },
    });
  });

  it("returns structured 404 responses", async () => {
    const response = await worker.fetch(
      new Request("https://api.example.test/unknown"),
      env,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "not_found", message: "Route not found." },
    });
  });

  it("allows configured CORS origins", async () => {
    const response = await worker.fetch(
      new Request("https://api.example.test/health", {
        headers: { Origin: "https://theblacksheepshop.co.uk" },
      }),
      env,
    );

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://theblacksheepshop.co.uk",
    );
    expect(response.headers.get("vary")).toContain("Origin");
  });

  it("does not grant CORS to unconfigured origins", async () => {
    const response = await worker.fetch(
      new Request("https://api.example.test/health", {
        headers: { Origin: "https://evil.example" },
      }),
      env,
    );

    expect(response.headers.has("access-control-allow-origin")).toBe(false);
  });

  it("rejects preflight from unconfigured origins", async () => {
    const response = await worker.fetch(
      new Request("https://api.example.test/v1/orders", {
        method: "OPTIONS",
        headers: { Origin: "https://evil.example" },
      }),
      env,
    );

    expect(response.status).toBe(403);
  });
});
