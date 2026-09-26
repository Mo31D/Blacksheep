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
    if (query.includes("COUNT(*) AS count FROM orders WHERE data_class")) {
      return new Statement(query, { count: 3 }, []);
    }
    if (query.includes("FROM orders") && query.includes("ORDER BY o.created_at DESC LIMIT 100")) {
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
    expect(html).toContain("Availability review");
    expect(html).toContain("Save & finalize quote");
    expect(html).toContain("catalogSheet");
    expect(html).toContain("Customer request");
  });

  it("returns an authenticated order list", async () => {
    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/orders"),
      { DB: new Db() },
      { verifyAccessFn: identity },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      orders: [],
      dataClass: "BUSINESS",
    });
  });

  it("allows staging to switch to test orders but keeps production business-only", async () => {
    const staging = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/orders?dataClass=TEST"),
      { DB: new Db(), ENVIRONMENT: "staging" },
      { verifyAccessFn: identity },
    );
    await expect(staging.json()).resolves.toMatchObject({ dataClass: "TEST" });

    const production = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/orders?dataClass=TEST"),
      { DB: new Db(), ENVIRONMENT: "production" },
      { verifyAccessFn: identity },
    );
    await expect(production.json()).resolves.toMatchObject({
      dataClass: "BUSINESS",
    });
  });

  it("requires explicit confirmation for staging test-order reset and forbids it in production", async () => {
    const stagingDenied = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/test-orders/reset", {
        method: "POST",
        headers: {
          origin: "https://admin.example.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({ confirmation: "no" }),
      }),
      { DB: new Db(), ENVIRONMENT: "staging" },
      { verifyAccessFn: identity },
    );
    expect(stagingDenied.status).toBe(400);

    const stagingReset = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/test-orders/reset", {
        method: "POST",
        headers: {
          origin: "https://admin.example.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({ confirmation: "RESET TEST ORDERS" }),
      }),
      { DB: new Db(), ENVIRONMENT: "staging" },
      { verifyAccessFn: identity },
    );
    expect(stagingReset.status).toBe(200);
    await expect(stagingReset.json()).resolves.toMatchObject({
      hiddenOrders: 3,
    });

    const production = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/test-orders/reset", {
        method: "POST",
        headers: {
          origin: "https://admin.example.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({ confirmation: "RESET TEST ORDERS" }),
      }),
      { DB: new Db(), ENVIRONMENT: "production" },
      { verifyAccessFn: identity },
    );
    expect(production.status).toBe(403);
  });

  it("records an explicit return-to-stock only when Phase 5 is enabled", async () => {
    const returnConsumedReservationToStockFn = async () => ({
      reservationId: "res-1",
      returnedAt: "2026-09-25T22:05:00.000Z",
      idempotentReplay: false,
    });

    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/orders/BSR-1/return-stock", {
        method: "POST",
        headers: {
          origin: "https://admin.example.com",
          "content-type": "application/json",
        },
        body: "{}",
      }),
      { DB: new Db(), ORDER_RESERVATIONS_ENABLED: "true" },
      {
        verifyAccessFn: identity,
        returnConsumedReservationToStockFn,
      } as any,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      result: {
        reservationId: "res-1",
        idempotentReplay: false,
      },
    });
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
