import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
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

const config = {
  id: "site_appearance",
  version: 4,
  publishedVersionId: "wav-live",
  draftVersionId: "wav-draft",
  effectiveVersionId: "wav-draft",
  effectiveVersionNumber: 3,
  hasDraft: true,
  presetKey: "DEFAULT",
  tokens: {
    background: "#f8f4ea",
    surface: "#fffefa",
    text: "#151512",
    mutedText: "#706b61",
    accent: "#b7904c",
    button: "#151512",
    border: "#ddd5c6",
    header: "#f8f4ea",
  },
  hero: {
    imageUrl: "/images/1.png",
    heading: "A gift shop full of character.",
    text: "Homepage copy",
    buttonLabel: "Browse all products",
    buttonHref: "/all-products.html",
  },
  sectionImages: {},
  scheduledStartAt: null,
  scheduledEndAt: null,
  createdAt: "2026-09-27T09:30:00.000Z",
  publishedAt: null,
};

function jsonRequest(path: string, method: string, body?: unknown) {
  return new Request("https://admin.example.com" + path, {
    method,
    headers: {
      origin: "https://admin.example.com",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("CARD 08 Website Appearance Admin API", () => {
  it("returns current Appearance and published history", async () => {
    const response = await handleAdminRequest(
      jsonRequest("/admin/api/appearance", "GET"),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        getAdminWebsiteAppearanceFn: async () => config,
        listWebsiteAppearanceHistoryFn: async () => [
          {
            versionId: "wav-live",
            versionNumber: 2,
            presetKey: "DEFAULT",
            createdAt: "2026-09-27T09:00:00.000Z",
            publishedAt: "2026-09-27T09:00:00.000Z",
            supersededAt: null,
            createdBy: "owner@example.com",
            isCurrent: true,
          },
        ],
      },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      config: { presetKey: "DEFAULT", hasDraft: true },
      history: [{ versionId: "wav-live", isCurrent: true }],
      presets: [
        { key: "DEFAULT", label: "Default" },
        { key: "WINTER", label: "Winter" },
        { key: "CHRISTMAS", label: "Christmas" },
        { key: "SUMMER", label: "Summer" },
        { key: "ICE_CREAM", label: "Ice Cream" },
      ],
    });
  });

  it("saves a private draft using optimistic version input", async () => {
    let saved: Record<string, unknown> | null = null;
    const response = await handleAdminRequest(
      jsonRequest("/admin/api/appearance/draft", "PATCH", {
        expectedVersion: 4,
        presetKey: "DEFAULT",
        tokens: { accent: "#b7904c" },
        hero: { heading: "Seasonal heading" },
        sectionImages: { gifts: "/images/gifts.webp" },
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        saveAdminWebsiteAppearanceDraftFn: async (_db, raw, actorEmail) => {
          saved = { ...(raw as unknown as Record<string, unknown>), actorEmail };
        },
        getAdminWebsiteAppearanceFn: async () => ({ ...config, version: 5 }),
      },
    );
    expect(response.status).toBe(200);
    expect(saved).toMatchObject({
      expectedVersion: 4,
      presetKey: "DEFAULT",
      actorEmail: "owner@example.com",
    });
  });

  it("publishes and restores only through guarded owner actions", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const publish = await handleAdminRequest(
      jsonRequest("/admin/api/appearance/publish", "POST", {
        expectedVersion: 5,
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        publishAdminWebsiteAppearanceFn: async (_db, expectedVersion, actorEmail) => {
          calls.push({ op: "publish", expectedVersion, actorEmail });
        },
        getAdminWebsiteAppearanceFn: async () => ({
          ...config,
          version: 6,
          draftVersionId: null,
          hasDraft: false,
        }),
        listWebsiteAppearanceHistoryFn: async () => [],
      },
    );
    expect(publish.status).toBe(200);

    const restore = await handleAdminRequest(
      jsonRequest("/admin/api/appearance/restore", "POST", {
        expectedVersion: 6,
        versionId: "wav-old",
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        restoreAdminWebsiteAppearanceFn: async (
          _db,
          versionId,
          expectedVersion,
          actorEmail,
        ) => {
          calls.push({ op: "restore", versionId, expectedVersion, actorEmail });
        },
        getAdminWebsiteAppearanceFn: async () => ({ ...config, version: 7 }),
        listWebsiteAppearanceHistoryFn: async () => [],
      },
    );
    expect(restore.status).toBe(200);
    expect(calls).toEqual([
      {
        op: "publish",
        expectedVersion: 5,
        actorEmail: "owner@example.com",
      },
      {
        op: "restore",
        versionId: "wav-old",
        expectedVersion: 6,
        actorEmail: "owner@example.com",
      },
    ]);
  });

  it("surfaces stale Appearance edits as a conflict", async () => {
    const response = await handleAdminRequest(
      jsonRequest("/admin/api/appearance/draft", "PATCH", {
        expectedVersion: 2,
        tokens: { accent: "#000000" },
      }),
      { DB: new Db() },
      {
        verifyAccessFn: identity,
        saveAdminWebsiteAppearanceDraftFn: async () => {
          throw new Error("appearance_version_conflict");
        },
      },
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "appearance_version_conflict" },
    });
  });
});
