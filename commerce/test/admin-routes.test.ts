import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { handleAdminRequest } from "../src/routes/admin";

class Statement implements D1PreparedStatementLike {
  values: unknown[] = [];
  constructor(
    public readonly sql: string,
    private readonly firstResult: unknown = null,
    private readonly results: unknown[] = [],
  ) {}
  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }
  async first<T>(): Promise<T | null> {
    return (this.firstResult as T | null) ?? null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.results as T[] };
  }
  async run(): Promise<unknown> {
    return {};
  }
}

class Db implements D1DatabaseLike {
  prepare(query: string): Statement {
    if (query.includes("FROM orders") && query.includes("ORDER BY created_at DESC LIMIT 100")) {
      return new Statement(query, null, []);
    }
    return new Statement(query);
  }
  async batch<T>(): Promise<T[]> {
    return [];
  }
}

const identity = async () => ({
  ok: true as const,
  status: 200,
  identity: { email: "owner@example.com", subject: "user-1" },
});

describe("admin routes", () => {
  it("serves a noindex dashboard only after access verification", async () => {
    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin"),
      { DB: new Db() },
      { verifyAccessFn: identity },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    const html = await response.text();
    expect(html).toContain("Black Sheep Shop");
    expect(html).toContain("Reports");
    expect(html).toContain("Record refund");
  });

  it("returns an authenticated order list", async () => {
    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/orders"),
      { DB: new Db() },
      { verifyAccessFn: identity },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ orders: [] });
  });

  it("returns authenticated report data with a safe default period", async () => {
    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/reports?days=31"),
      { DB: new Db() },
      { verifyAccessFn: identity },
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      periodDays: number;
      summary: { orderCount: number; revenueMinor: number };
    };
    expect(payload.periodDays).toBe(30);
    expect(payload.summary.orderCount).toBe(0);
    expect(payload.summary.revenueMinor).toBe(0);
  });

  it("shows the login page for an unauthenticated admin page request", async () => {
    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin"),
      { DB: new Db() },
      {
        verifyAccessFn: async () => ({
          ok: false,
          status: 401,
          code: "admin_session_missing",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Admin sign in");
  });

  it("rejects cross-origin admin POST requests before auth logic runs", async () => {
    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin/auth/request", {
        method: "POST",
        headers: { origin: "https://evil.example" },
      }),
      { DB: new Db() },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "admin_origin_forbidden" },
    });
  });

  it("fails closed for unauthenticated admin API requests", async () => {
    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/orders"),
      { DB: new Db() },
      {
        verifyAccessFn: async () => ({
          ok: false,
          status: 401,
          code: "admin_session_missing",
        }),
      },
    );

    expect(response.status).toBe(401);
  });
});
