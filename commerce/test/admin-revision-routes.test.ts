import { describe, expect, it, vi } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
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
  prepare(): Statement {
    return new Statement();
  }
  async batch<T>(): Promise<T[]> {
    return [];
  }
}

const verifyAccessFn = async () => ({
  ok: true as const,
  status: 200,
  identity: { email: "owner@example.com", subject: "owner" },
});

const baseDependencies = {
  verifyAccessFn,
  listOrderRevisionsFn: vi.fn(async () => []),
  createDraftRevisionFromOriginalFn: vi.fn(async () => ({
    id: "rev-1",
    revisionNumber: 1,
    version: 1,
    state: "DRAFT" as const,
    itemsSubtotalMinor: 150,
    deliveryAmountMinor: 0,
    finalTotalMinor: 150,
  })),
  getOrderRevisionDetailFn: vi.fn(async () => ({
    id: "rev-1",
    revisionNumber: 1,
    state: "DRAFT",
    version: 1,
  })),
  updateDraftRevisionFn: vi.fn(async () => ({
    id: "rev-1",
    revisionNumber: 1,
    state: "DRAFT",
    version: 2,
  })),
  addCatalogItemToDraftRevisionFn: vi.fn(async () => ({
    id: "rev-1",
    revisionNumber: 1,
    state: "DRAFT",
    version: 2,
  })),
  addDraftRevisionAdjustmentFn: vi.fn(async () => ({
    id: "rev-1",
    revisionNumber: 1,
    state: "DRAFT",
    version: 2,
    adjustmentAmountMinor: -100,
    finalTotalMinor: 50,
  })),
  substituteDraftRevisionLineFn: vi.fn(async () => ({
    id: "rev-1",
    revisionNumber: 1,
    state: "DRAFT",
    version: 2,
  })),
  removeDraftRevisionAdjustmentFn: vi.fn(async () => ({
    id: "rev-1",
    revisionNumber: 1,
    state: "DRAFT",
    version: 3,
    adjustmentAmountMinor: 0,
    finalTotalMinor: 150,
  })),
  transitionOrderRevisionFn: vi.fn(async () => ({
    id: "rev-1",
    revisionNumber: 1,
    state: "SENT",
    version: 2,
  })),
};

describe("admin order revision routes", () => {
  it("lists revisions only after authenticated admin access", async () => {
    const listOrderRevisionsFn = vi.fn(async () => [
      { id: "rev-1", revisionNumber: 1, state: "DRAFT", version: 1 },
    ]);

    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/orders/BSR-1/revisions"),
      { DB: new Db() },
      { ...baseDependencies, listOrderRevisionsFn } as any,
    );

    expect(response.status).toBe(200);
    expect(listOrderRevisionsFn).toHaveBeenCalledWith(expect.any(Db), "BSR-1");
    await expect(response.json()).resolves.toMatchObject({
      revisions: [{ id: "rev-1", revisionNumber: 1 }],
    });
  });

  it("creates a draft revision through a same-origin admin POST", async () => {
    const createDraftRevisionFromOriginalFn = vi.fn(
      baseDependencies.createDraftRevisionFromOriginalFn,
    );

    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/orders/BSR-1/revisions", {
        method: "POST",
        headers: { origin: "https://admin.example.com" },
      }),
      { DB: new Db() },
      { ...baseDependencies, createDraftRevisionFromOriginalFn } as any,
    );

    expect(response.status).toBe(201);
    expect(createDraftRevisionFromOriginalFn).toHaveBeenCalledWith(
      expect.any(Db),
      "BSR-1",
      "owner@example.com",
    );
  });

  it("updates a draft using expected-version concurrency input", async () => {
    const updateDraftRevisionFn = vi.fn(baseDependencies.updateDraftRevisionFn);

    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/orders/BSR-1/revisions/rev-1", {
        method: "PATCH",
        headers: {
          origin: "https://admin.example.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          expectedVersion: 1,
          customerMessage: "One item is unavailable.",
          items: [
            {
              lineNumber: 1,
              confirmedQuantity: 0,
              availabilityStatus: "UNAVAILABLE",
            },
          ],
        }),
      }),
      { DB: new Db() },
      { ...baseDependencies, updateDraftRevisionFn } as any,
    );

    expect(response.status).toBe(200);
    expect(updateDraftRevisionFn).toHaveBeenCalledWith(
      expect.any(Db),
      "BSR-1",
      "rev-1",
      expect.objectContaining({ expectedVersion: 1 }),
      "owner@example.com",
    );
  });

  it("maps a stale revision version to HTTP 409", async () => {
    const updateDraftRevisionFn = vi.fn(async () => {
      throw new Error("revision_version_conflict");
    });

    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/orders/BSR-1/revisions/rev-1", {
        method: "PATCH",
        headers: {
          origin: "https://admin.example.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({ expectedVersion: 1 }),
      }),
      { DB: new Db() },
      { ...baseDependencies, updateDraftRevisionFn } as any,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "revision_version_conflict" },
    });
  });

  it("sends a revision through the explicit revision action endpoint", async () => {
    const transitionOrderRevisionFn = vi.fn(
      baseDependencies.transitionOrderRevisionFn,
    );

    const response = await handleAdminRequest(
      new Request(
        "https://admin.example.com/admin/api/orders/BSR-1/revisions/rev-1/send",
        {
          method: "POST",
          headers: {
            origin: "https://admin.example.com",
            "content-type": "application/json",
          },
          body: JSON.stringify({ expectedVersion: 1 }),
        },
      ),
      { DB: new Db() },
      { ...baseDependencies, transitionOrderRevisionFn } as any,
    );

    expect(response.status).toBe(200);
    expect(transitionOrderRevisionFn).toHaveBeenCalledWith(
      expect.any(Db),
      "BSR-1",
      "rev-1",
      "send",
      1,
      "owner@example.com",
    );
  });

  it("adds a catalogue-backed item through the owner API", async () => {
    const addCatalogItemToDraftRevisionFn = vi.fn(
      baseDependencies.addCatalogItemToDraftRevisionFn,
    );

    const response = await handleAdminRequest(
      new Request(
        "https://admin.example.com/admin/api/orders/BSR-1/revisions/rev-1/items",
        {
          method: "POST",
          headers: {
            origin: "https://admin.example.com",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            expectedVersion: 1,
            catalogProductId: "ROM-001",
            quantity: 2,
          }),
        },
      ),
      { DB: new Db() },
      { ...baseDependencies, addCatalogItemToDraftRevisionFn } as any,
    );

    expect(response.status).toBe(201);
    expect(addCatalogItemToDraftRevisionFn).toHaveBeenCalledWith(
      expect.any(Db),
      "BSR-1",
      "rev-1",
      expect.objectContaining({
        expectedVersion: 1,
        catalogProductId: "ROM-001",
        quantity: 2,
      }),
      "owner@example.com",
    );
  });

  it("substitutes a requested line with a server-priced catalogue product", async () => {
    const substituteDraftRevisionLineFn = vi.fn(
      baseDependencies.substituteDraftRevisionLineFn,
    );

    const response = await handleAdminRequest(
      new Request(
        "https://admin.example.com/admin/api/orders/BSR-1/revisions/rev-1/items/2/substitute",
        {
          method: "POST",
          headers: {
            origin: "https://admin.example.com",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            expectedVersion: 1,
            catalogProductId: "ROM-001",
            quantity: 1,
          }),
        },
      ),
      { DB: new Db() },
      { ...baseDependencies, substituteDraftRevisionLineFn } as any,
    );

    expect(response.status).toBe(200);
    expect(substituteDraftRevisionLineFn).toHaveBeenCalledWith(
      expect.any(Db),
      "BSR-1",
      "rev-1",
      expect.objectContaining({
        lineNumber: 2,
        expectedVersion: 1,
        catalogProductId: "ROM-001",
      }),
      "owner@example.com",
    );
  });

  it("removes a shop-added reviewed item with concurrency protection", async () => {
    const removeAddedRevisionLineFn = vi.fn(async () => ({
      id: "rev-1",
      revisionNumber: 1,
      state: "DRAFT",
      version: 3,
    }));

    const response = await handleAdminRequest(
      new Request(
        "https://admin.example.com/admin/api/orders/BSR-1/revisions/rev-1/items/3",
        {
          method: "DELETE",
          headers: {
            origin: "https://admin.example.com",
            "content-type": "application/json",
          },
          body: JSON.stringify({ expectedVersion: 2 }),
        },
      ),
      { DB: new Db() },
      { ...baseDependencies, removeAddedRevisionLineFn } as any,
    );

    expect(response.status).toBe(200);
    expect(removeAddedRevisionLineFn).toHaveBeenCalledWith(
      expect.any(Db),
      "BSR-1",
      "rev-1",
      3,
      2,
      "owner@example.com",
    );
  });

  it("restores an original requested item after a substitute", async () => {
    const restoreOriginalRevisionLineFn = vi.fn(async () => ({
      id: "rev-1",
      revisionNumber: 1,
      state: "DRAFT",
      version: 4,
    }));

    const response = await handleAdminRequest(
      new Request(
        "https://admin.example.com/admin/api/orders/BSR-1/revisions/rev-1/items/2/reset",
        {
          method: "POST",
          headers: {
            origin: "https://admin.example.com",
            "content-type": "application/json",
          },
          body: JSON.stringify({ expectedVersion: 3 }),
        },
      ),
      { DB: new Db() },
      { ...baseDependencies, restoreOriginalRevisionLineFn } as any,
    );

    expect(response.status).toBe(200);
    expect(restoreOriginalRevisionLineFn).toHaveBeenCalledWith(
      expect.any(Db),
      "BSR-1",
      "rev-1",
      2,
      3,
      "owner@example.com",
    );
  });

  it("adds a reviewed-order adjustment through the owner API", async () => {
    const addDraftRevisionAdjustmentFn = vi.fn(
      baseDependencies.addDraftRevisionAdjustmentFn,
    );

    const response = await handleAdminRequest(
      new Request(
        "https://admin.example.com/admin/api/orders/BSR-1/revisions/rev-1/adjustments",
        {
          method: "POST",
          headers: {
            origin: "https://admin.example.com",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            expectedVersion: 1,
            kind: "DISCOUNT",
            label: "Stock correction",
            amountMinor: -100,
            internalReason: "One requested item is unavailable.",
          }),
        },
      ),
      { DB: new Db() },
      { ...baseDependencies, addDraftRevisionAdjustmentFn } as any,
    );

    expect(response.status).toBe(201);
    expect(addDraftRevisionAdjustmentFn).toHaveBeenCalledWith(
      expect.any(Db),
      "BSR-1",
      "rev-1",
      expect.objectContaining({
        expectedVersion: 1,
        kind: "DISCOUNT",
        amountMinor: -100,
      }),
      "owner@example.com",
    );
  });

  it("removes a reviewed-order adjustment with expected-version protection", async () => {
    const removeDraftRevisionAdjustmentFn = vi.fn(
      baseDependencies.removeDraftRevisionAdjustmentFn,
    );

    const response = await handleAdminRequest(
      new Request(
        "https://admin.example.com/admin/api/orders/BSR-1/revisions/rev-1/adjustments/7",
        {
          method: "DELETE",
          headers: {
            origin: "https://admin.example.com",
            "content-type": "application/json",
          },
          body: JSON.stringify({ expectedVersion: 2 }),
        },
      ),
      { DB: new Db() },
      { ...baseDependencies, removeDraftRevisionAdjustmentFn } as any,
    );

    expect(response.status).toBe(200);
    expect(removeDraftRevisionAdjustmentFn).toHaveBeenCalledWith(
      expect.any(Db),
      "BSR-1",
      "rev-1",
      7,
      2,
      "owner@example.com",
    );
  });

  it("maps a stale adjustment mutation to HTTP 409", async () => {
    const addDraftRevisionAdjustmentFn = vi.fn(async () => {
      throw new Error("revision_version_conflict");
    });

    const response = await handleAdminRequest(
      new Request(
        "https://admin.example.com/admin/api/orders/BSR-1/revisions/rev-1/adjustments",
        {
          method: "POST",
          headers: {
            origin: "https://admin.example.com",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            expectedVersion: 1,
            kind: "SURCHARGE",
            label: "Delivery correction",
            amountMinor: 100,
            internalReason: "Stale mutation test.",
          }),
        },
      ),
      { DB: new Db() },
      { ...baseDependencies, addDraftRevisionAdjustmentFn } as any,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "revision_version_conflict" },
    });
  });

  it("rejects cross-origin PATCH before revision logic runs", async () => {
    const updateDraftRevisionFn = vi.fn(baseDependencies.updateDraftRevisionFn);

    const response = await handleAdminRequest(
      new Request("https://admin.example.com/admin/api/orders/BSR-1/revisions/rev-1", {
        method: "PATCH",
        headers: {
          origin: "https://evil.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({ expectedVersion: 1 }),
      }),
      { DB: new Db() },
      { ...baseDependencies, updateDraftRevisionFn } as any,
    );

    expect(response.status).toBe(403);
    expect(updateDraftRevisionFn).not.toHaveBeenCalled();
  });
});
