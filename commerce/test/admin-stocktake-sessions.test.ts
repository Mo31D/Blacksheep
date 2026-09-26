import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { adminHtml } from "../src/admin/ui";
import { handleAdminRequest } from "../src/routes/admin";

class Statement implements D1PreparedStatementLike {
  bind(): D1PreparedStatementLike { return this; }
  async first<T>(): Promise<T | null> { return null; }
  async all<T>(): Promise<{ results: T[] }> { return { results: [] }; }
  async run(): Promise<unknown> { return {}; }
}

class Db implements D1DatabaseLike {
  prepare(): D1PreparedStatementLike { return new Statement(); }
  async batch<T>(): Promise<T[]> { return []; }
}

const identity = async () => ({
  ok: true as const,
  status: 200,
  identity: { email: "owner@example.com", subject: "owner-1" },
});

const session = {
  id: "stk-1",
  locationId: "loc_ambleside",
  scopeType: "BRAND_RANGE",
  scopeRefId: "cat-romneys",
  scopeLabel: "Romney's",
  status: "IN_PROGRESS",
  totalItems: 52,
  countedItems: 7,
  skippedItems: 1,
  conflictItems: 0,
  currentPosition: 8,
  createdBy: "owner@example.com",
  createdAt: "2026-09-26T20:00:00.000Z",
  updatedAt: "2026-09-26T20:10:00.000Z",
  completedAt: null,
  version: 4,
};

const item = {
  sessionId: "stk-1",
  variantId: "var-1",
  productId: "prd-1",
  position: 8,
  title: "Romney's Kendal Mint Cake",
  sku: "ROM-1",
  thumbnailUrl: null,
  trackedSnapshot: true,
  systemOnHandSnapshot: 10,
  availableSnapshot: 10,
  expectedBalanceVersion: 3,
  variantVersionSnapshot: 2,
  countedOnHand: null,
  itemStatus: "PENDING",
  conflictCode: null,
  savedAt: null,
  appliedAt: null,
  version: 1,
  currentTracked: true,
  currentOnHand: 10,
  currentReserved: 0,
  currentSafetyStock: 0,
  currentBalanceVersion: 3,
  currentVariantVersion: 2,
  currentAvailable: 10,
};

function request(path: string, method = "POST", body: unknown = {}) {
  return new Request("https://admin.example.com" + path, {
    method,
    headers: {
      origin: "https://admin.example.com",
      "content-type": "application/json",
    },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
}

describe("CARD 05 persistent Stocktake Admin", () => {
  it("renders scoped, resumable and keyboard-stable Stocktake UX", () => {
    const html = adminHtml("owner@example.com");

    expect(html).toContain("Stocktake 2.0");
    expect(html).toContain("Continue unfinished");
    expect(html).toContain("Website section");
    expect(html).toContain("Brand / Range");
    expect(html).toContain("Product category / collection");
    expect(html).toContain("Custom products");
    expect(html).toContain("/admin/api/stocktakes/preview");
    expect(html).toContain("/admin/api/stocktakes/");
    expect(html).toContain("requestAnimationFrame(function(){try{input.focus");
    expect(html).toContain("e.preventDefault()");
    expect(html).toContain("Stock changed while you were counting.");
  });

  it("previews a Romney's-only scope before starting", async () => {
    let raw: Record<string, unknown> | null = null;
    const response = await handleAdminRequest(
      request("/admin/api/stocktakes/preview", "POST", {
        locationId: "loc_ambleside",
        scopeType: "BRAND_RANGE",
        scopeRefId: "cat-romneys",
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        previewStocktakeScopeFn: (async (
          _db: D1DatabaseLike,
          input: unknown,
        ) => {
          raw = input as Record<string, unknown>;
          return {
            locationId: "loc_ambleside",
            scopeType: "BRAND_RANGE",
            scopeRefId: "cat-romneys",
            scopeLabel: "Romney's",
            totalItems: 52,
          };
        }) as never,
      },
    );

    expect(response.status).toBe(200);
    expect(raw).toMatchObject({
      scopeType: "BRAND_RANGE",
      scopeRefId: "cat-romneys",
    });
    await expect(response.json()).resolves.toMatchObject({
      scopeLabel: "Romney's",
      totalItems: 52,
    });
  });

  it("creates and resumes a persistent stocktake session", async () => {
    const created = await handleAdminRequest(
      request("/admin/api/stocktakes", "POST", {
        locationId: "loc_ambleside",
        scopeType: "BRAND_RANGE",
        scopeRefId: "cat-romneys",
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        createStocktakeSessionFn: (async () => ({
          session,
          items: [item],
        })) as never,
      },
    );
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({
      session: { id: "stk-1", scopeLabel: "Romney's" },
      items: [{ variantId: "var-1" }],
    });

    const resumed = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/stocktakes/stk-1"),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        getStocktakeSessionFn: (async () => ({
          session,
          items: [item],
        })) as never,
      },
    );
    expect(resumed.status).toBe(200);
    await expect(resumed.json()).resolves.toMatchObject({
      session: { currentPosition: 8, countedItems: 7 },
    });
  });

  it("persists each physical count before moving to the next item", async () => {
    let captured: Record<string, unknown> | null = null;
    const response = await handleAdminRequest(
      request(
        "/admin/api/stocktakes/stk-1/items/var-1",
        "PATCH",
        {
          expectedItemVersion: 1,
          action: "COUNT",
          countedOnHand: 8,
        },
      ),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        saveStocktakeItemFn: (async (
          _db: D1DatabaseLike,
          sessionId: string,
          variantId: string,
          raw: unknown,
        ) => {
          captured = { sessionId, variantId, ...(raw as object) };
          return {
            session: { ...session, countedItems: 8, currentPosition: 9, version: 5 },
            items: [{ ...item, countedOnHand: 8, itemStatus: "COUNTED", version: 2 }],
          };
        }) as never,
      },
    );

    expect(response.status).toBe(200);
    expect(captured).toMatchObject({
      sessionId: "stk-1",
      variantId: "var-1",
      expectedItemVersion: 1,
      countedOnHand: 8,
    });
  });

  it("finalizes through the existing guarded inventory count engine and can return conflicts for review", async () => {
    const response = await handleAdminRequest(
      request("/admin/api/stocktakes/stk-1/finalize", "POST", {}),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        finalizeStocktakeSessionFn: (async () => ({
          session: { ...session, status: "REVIEW", conflictItems: 1, version: 5 },
          items: [{ ...item, itemStatus: "CONFLICT", conflictCode: "inventory_concurrency_conflict" }],
          result: {
            batchId: "ibatch-1",
            success: [],
            unchanged: [],
            conflicts: [
              { variantId: "var-1", code: "inventory_concurrency_conflict" },
            ],
          },
        })) as never,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      session: { status: "REVIEW", conflictItems: 1 },
      result: {
        conflicts: [
          { variantId: "var-1", code: "inventory_concurrency_conflict" },
        ],
      },
    });
  });

  it("lists unfinished sessions so refresh or closing the sheet does not lose progress", async () => {
    const response = await handleAdminRequest(
      new Request(
        "https://admin.example.com/admin/api/stocktakes?location=loc_ambleside",
      ),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        listOpenStocktakeSessionsFn: (async () => [session]) as never,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      sessions: [
        {
          id: "stk-1",
          scopeLabel: "Romney's",
          countedItems: 7,
          currentPosition: 8,
        },
      ],
    });
  });
});
