import { describe, expect, it } from "vitest";
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

const node = {
  id: "sfn_test",
  stableKey: "owner/test",
  publicationStatus: "DRAFT" as const,
  version: 1,
  publishedVersionId: null,
  draftVersionId: "sfv_test_1",
  effectiveVersionId: "sfv_test_1",
  effectiveVersionNumber: 1,
  hasDraft: true,
  name: "Test section",
  slug: "test-section",
  parentNodeId: null,
  sortOrder: 50,
  showInNavigation: true,
  shortDescription: null,
  imageUrl: null,
  legacyPath: null,
  productCount: 0,
  childCount: 0,
};

function jsonRequest(path: string, method: string, body: unknown) {
  return new Request("https://admin.example.com" + path, {
    method,
    headers: {
      origin: "https://admin.example.com",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("Admin Storefront Structure API", () => {
  it("lists the owner-facing Storefront Structure including archived rows when requested", async () => {
    let includeArchived = false;
    const response = await handleAdminRequest(
      new Request(
        "https://admin.example.com/admin/api/storefront-structure?includeArchived=1",
      ),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        listAdminStorefrontNodesFn: async (_db, options) => {
          includeArchived = options?.includeArchived === true;
          return [node];
        },
      },
    );

    expect(response.status).toBe(200);
    expect(includeArchived).toBe(true);
    await expect(response.json()).resolves.toMatchObject({
      nodes: [{ id: "sfn_test", name: "Test section" }],
    });
  });

  it("creates a main section with the signed-in owner recorded by the data layer", async () => {
    let actor = "";
    let input: Record<string, unknown> | null = null;
    const response = await handleAdminRequest(
      jsonRequest("/admin/api/storefront-structure", "POST", {
        name: "Seasonal gifts",
        showInNavigation: true,
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        createAdminStorefrontNodeFn: async (_db, raw, actorEmail) => {
          actor = actorEmail;
          input = raw as Record<string, unknown>;
          return { id: "sfn_test" };
        },
        getAdminStorefrontNodeFn: async () => node,
      },
    );

    expect(response.status).toBe(201);
    expect(actor).toBe("owner@example.com");
    expect(input).toMatchObject({
      name: "Seasonal gifts",
      showInNavigation: true,
    });
  });

  it("updates, moves, publishes, archives and restores with optimistic version input", async () => {
    const calls: Array<Record<string, unknown>> = [];

    const update = await handleAdminRequest(
      jsonRequest("/admin/api/storefront-structure/sfn_test", "PATCH", {
        expectedVersion: 7,
        name: "Renamed",
        showInNavigation: false,
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        updateAdminStorefrontNodeFn: async (_db, id, raw, actorEmail) => {
          calls.push({ op: "update", id, raw, actorEmail });
        },
        getAdminStorefrontNodeFn: async () => ({ ...node, version: 8 }),
      },
    );
    expect(update.status).toBe(200);

    const move = await handleAdminRequest(
      jsonRequest(
        "/admin/api/storefront-structure/sfn_test/move",
        "POST",
        { expectedVersion: 8, direction: "DOWN" },
      ),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        moveAdminStorefrontNodeFn: async (
          _db,
          id,
          direction,
          expectedVersion,
          actorEmail,
        ) => {
          calls.push({
            op: "move",
            id,
            direction,
            expectedVersion,
            actorEmail,
          });
        },
      },
    );
    expect(move.status).toBe(200);

    const publish = await handleAdminRequest(
      jsonRequest(
        "/admin/api/storefront-structure/sfn_test/publish",
        "POST",
        { expectedVersion: 9 },
      ),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        publishAdminStorefrontNodeFn: async (
          _db,
          id,
          expectedVersion,
          actorEmail,
        ) => {
          calls.push({
            op: "publish",
            id,
            expectedVersion,
            actorEmail,
          });
        },
        getAdminStorefrontNodeFn: async () => ({
          ...node,
          publicationStatus: "ACTIVE",
          version: 10,
          publishedVersionId: node.draftVersionId,
          draftVersionId: null,
          hasDraft: false,
        }),
      },
    );
    expect(publish.status).toBe(200);

    const archive = await handleAdminRequest(
      jsonRequest(
        "/admin/api/storefront-structure/sfn_test/archive",
        "POST",
        { expectedVersion: 10 },
      ),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        archiveAdminStorefrontNodeFn: async (
          _db,
          id,
          expectedVersion,
          actorEmail,
        ) => {
          calls.push({
            op: "archive",
            id,
            expectedVersion,
            actorEmail,
          });
        },
      },
    );
    expect(archive.status).toBe(200);

    const restore = await handleAdminRequest(
      jsonRequest(
        "/admin/api/storefront-structure/sfn_test/restore",
        "POST",
        { expectedVersion: 11 },
      ),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        restoreAdminStorefrontNodeFn: async (
          _db,
          id,
          expectedVersion,
          actorEmail,
        ) => {
          calls.push({
            op: "restore",
            id,
            expectedVersion,
            actorEmail,
          });
        },
      },
    );
    expect(restore.status).toBe(200);

    expect(calls).toEqual([
      expect.objectContaining({
        op: "update",
        id: "sfn_test",
        actorEmail: "owner@example.com",
      }),
      {
        op: "move",
        id: "sfn_test",
        direction: "DOWN",
        expectedVersion: 8,
        actorEmail: "owner@example.com",
      },
      {
        op: "publish",
        id: "sfn_test",
        expectedVersion: 9,
        actorEmail: "owner@example.com",
      },
      {
        op: "archive",
        id: "sfn_test",
        expectedVersion: 10,
        actorEmail: "owner@example.com",
      },
      {
        op: "restore",
        id: "sfn_test",
        expectedVersion: 11,
        actorEmail: "owner@example.com",
      },
    ]);
  });

  it("returns a guarded owner-facing conflict instead of hiding a structure version race", async () => {
    const response = await handleAdminRequest(
      jsonRequest("/admin/api/storefront-structure/sfn_test", "PATCH", {
        expectedVersion: 2,
        name: "Conflict",
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        updateAdminStorefrontNodeFn: async () => {
          throw new Error("storefront_version_conflict");
        },
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "storefront_version_conflict",
        message:
          "This section changed while you were editing it. Refresh and try again.",
      },
    });
  });
});
