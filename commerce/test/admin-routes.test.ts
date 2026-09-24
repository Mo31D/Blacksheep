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
    if (query.includes("FROM orders") && query.includes("ORDER BY")) {
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
    expect(await response.text()).toContain("Black Sheep Shop");
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

  it("fails closed when access is denied", async () => {
    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin"),
      { DB: new Db() },
      {
        verifyAccessFn: async () => ({
          ok: false,
          status: 403,
          code: "admin_access_token_missing",
        }),
      },
    );

    expect(response.status).toBe(403);
  });
});
