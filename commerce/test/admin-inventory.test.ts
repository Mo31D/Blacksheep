import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { adminHtml } from "../src/admin/ui";
import { handleAdminRequest } from "../src/routes/admin";

class Statement implements D1PreparedStatementLike {
  bind(): D1PreparedStatementLike {
    return this;
  }
  async first<T>(): Promise<T | null> {
    return null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: [] };
  }
  async run(): Promise<unknown> {
    return {};
  }
}

class Db implements D1DatabaseLike {
  prepare(): D1PreparedStatementLike {
    return new Statement();
  }
  async batch<T>(): Promise<T[]> {
    return [];
  }
}

const identity = async () => ({
  ok: true as const,
  status: 200,
  identity: { email: "owner@example.com", subject: "owner-1" },
});

const snapshot = {
  variantId: "var-1",
  productId: "prd-1",
  locationId: "loc_ambleside",
  title: "Peter Rabbit",
  sku: "SKU-1",
  tracked: true,
  onHand: 7,
  reserved: 2,
  safetyStock: 0,
  available: 5,
  incoming: 3,
  lowStockThreshold: 2,
  low: false,
  out: false,
  balanceVersion: 4,
  variantVersion: 3,
  updatedAt: "2026-09-25T20:00:00.000Z",
};

function post(path: string, body: unknown): Request {
  return new Request("https://admin.example.com" + path, {
    method: "POST",
    headers: {
      origin: "https://admin.example.com",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("Phase 4 Inventory Core Admin", () => {
  it("renders the Stock workspace and stocktake controls", () => {
    const html = adminHtml("owner@example.com");
    expect(html).toContain('data-nav="stock"');
    expect(html).toContain('id="view-stock"');
    expect(html).toContain("Phase 4 · Staging");
    expect(html).toContain('id="startBulkCount"');
    expect(html).toContain("Start Initial Count");
    expect(html).toContain("Adjust stock");
    expect(html).toContain("Physical count");
    expect(html).toContain("Low-stock threshold");
    expect(html).toContain("Inventory history");
  });

  it("returns the Stock board contract", async () => {
    const response = await handleAdminRequest(
      new Request(
        "https://admin.example.com/admin/api/inventory?state=low&location=loc_ambleside",
      ),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        listAdminInventoryFn: (async () => ({
          items: [
            {
              ...snapshot,
              thumbnailUrl: null,
              productSlug: "peter-rabbit",
              publicationStatus: "ACTIVE",
              sellStatus: "AUTO",
            },
          ],
          summary: {
            total: 146,
            tracked: 1,
            untracked: 145,
            low: 0,
            out: 0,
            incoming: 1,
          },
          nextCursor: null,
          location: {
            id: "loc_ambleside",
            code: "AMBLESIDE",
            name: "Black Sheep Shop — Ambleside",
          },
        })) as never,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [{ variantId: "var-1", onHand: 7, available: 5 }],
      summary: { total: 146, tracked: 1, untracked: 145 },
    });
  });

  it("starts tracking only through Initial Count", async () => {
    let rawInput: Record<string, unknown> | null = null;
    const response = await handleAdminRequest(
      post("/admin/api/inventory/initial-count", {
        variantId: "var-1",
        locationId: "loc_ambleside",
        quantity: 7,
        reason: "Opening physical count",
        idempotencyKey: "inventory:test:initial:1",
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        initialInventoryCountFn: (async (_db, raw) => {
          rawInput = raw as unknown as Record<string, unknown>;
          return {
            snapshot,
            movementId: "imv-1",
            replayed: false,
          };
        }) as never,
      },
    );

    expect(response.status).toBe(201);
    expect(rawInput).toMatchObject({
      variantId: "var-1",
      quantity: 7,
      idempotencyKey: "inventory:test:initial:1",
    });
    await expect(response.json()).resolves.toMatchObject({
      snapshot: { tracked: true, onHand: 7, available: 5 },
      movementId: "imv-1",
    });
  });

  it("records audited delta adjustments with expected balance version", async () => {
    const response = await handleAdminRequest(
      post("/admin/api/inventory/adjustments", {
        variantId: "var-1",
        locationId: "loc_ambleside",
        delta: -2,
        reasonCode: "DAMAGE",
        note: "Damaged in shop",
        expectedBalanceVersion: 4,
        idempotencyKey: "inventory:test:adjust:1",
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        adjustInventoryFn: (async () => ({
          snapshot: {
            ...snapshot,
            onHand: 5,
            available: 3,
            balanceVersion: 5,
          },
          movementId: "imv-2",
          replayed: false,
        })) as never,
      },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      snapshot: { onHand: 5, available: 3, balanceVersion: 5 },
    });
  });

  it("records physical counts and exposes immutable history", async () => {
    const countResponse = await handleAdminRequest(
      post("/admin/api/inventory/count", {
        variantId: "var-1",
        locationId: "loc_ambleside",
        countedOnHand: 8,
        reason: "Shelf count",
        expectedBalanceVersion: 4,
        idempotencyKey: "inventory:test:count:1",
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        physicalInventoryCountFn: (async () => ({
          snapshot: {
            ...snapshot,
            onHand: 8,
            available: 6,
            balanceVersion: 5,
          },
          movementId: "imv-3",
          replayed: false,
        })) as never,
      },
    );
    expect(countResponse.status).toBe(201);

    const historyResponse = await handleAdminRequest(
      new Request(
        "https://admin.example.com/admin/api/variants/var-1/inventory/history?location=loc_ambleside",
      ),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        listInventoryHistoryFn: (async () => ({
          movements: [
            {
              id: "imv-3",
              movementType: "CORRECTION",
              onHandDelta: 1,
              reasonCode: "PHYSICAL_COUNT",
              onHandAfter: 8,
            },
          ],
          nextCursor: null,
        })) as never,
      },
    );

    expect(historyResponse.status).toBe(200);
    await expect(historyResponse.json()).resolves.toMatchObject({
      movements: [
        {
          movementType: "CORRECTION",
          onHandDelta: 1,
          onHandAfter: 8,
        },
      ],
    });
  });

  it("returns explicit bulk stocktake results", async () => {
    const response = await handleAdminRequest(
      post("/admin/api/inventory/bulk-count", {
        locationId: "loc_ambleside",
        reason: "Bulk physical stock count",
        idempotencyKey: "inventory:test:bulk:1",
        items: [
          {
            variantId: "var-1",
            countedOnHand: 7,
            expectedBalanceVersion: 4,
          },
        ],
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        bulkInventoryCountFn: (async () => ({
          batchId: "ibatch-1",
          success: [{ variantId: "var-1", snapshot }],
          conflicts: [],
          unchanged: [],
        })) as never,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      batchId: "ibatch-1",
      success: [{ variantId: "var-1" }],
      conflicts: [],
    });
  });

  it("rejects cross-origin stock mutations", async () => {
    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/inventory/adjustments", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          variantId: "var-1",
          delta: 1,
        }),
      }),
      { DB: new Db() },
      { verifyAccessFn: identity },
    );

    expect(response.status).toBe(403);
  });
});
