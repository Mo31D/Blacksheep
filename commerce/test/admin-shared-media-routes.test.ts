import { describe, expect, it, vi } from "vitest";
import { handleAdminRequest } from "../src/routes/admin";
import { MediaUploadDb } from "./helpers/media-upload-db";
import type { SharedMediaDependencies } from "../src/routes/admin-shared-media";
import type { SharedMediaAsset, SharedMediaUsagePlace } from "../src/data/shared-media";

const identity = { email: "owner@example.test", subject: "owner" };
const access = async () => ({ ok: true as const, status: 200, identity });
const claim = { assetId: "asset-1", storageKey: "library/test.png", claimToken: "claim-1", alreadyDeleted: false };
function request(path = "/admin/api/media", method = "GET", body?: BodyInit) {
  return new Request("https://admin.example.test" + path, { method, body, headers: { origin: "https://admin.example.test" } });
}

describe("shared media through the Admin security boundary", () => {
  it("rejects unauthenticated requests before the extracted handler", async () => {
    const list = vi.fn(async () => []);
    const response = await handleAdminRequest(request(), { DB: new MediaUploadDb() }, { verifyAccessFn: async () => ({ ok: false, status: 401, code: "admin_unauthorized" }), listAdminSharedMediaFn: list });
    expect(response.status).toBe(401); expect(list).not.toHaveBeenCalled();
  });
  it("rejects foreign-origin mutations before access or media writes", async () => {
    const verify = vi.fn(access); const archive = vi.fn();
    const response = await handleAdminRequest(new Request("https://admin.example.test/admin/api/media/asset-1/archive", { method: "POST", headers: { origin: "https://foreign.example" } }), { DB: new MediaUploadDb() }, { verifyAccessFn: verify, archiveAdminSharedMediaAssetFn: archive });
    expect(response.status).toBe(403); expect(verify).not.toHaveBeenCalled(); expect(archive).not.toHaveBeenCalled();
  });
  it("keeps database availability before domain dispatch", async () => {
    const list = vi.fn(async () => []);
    const response = await handleAdminRequest(request(), {}, { verifyAccessFn: access, listAdminSharedMediaFn: list });
    expect(response.status).toBe(503); expect(list).not.toHaveBeenCalled();
  });
  it("preserves listing filters, JSON shape and private response headers", async () => {
    const db = new MediaUploadDb(); const list = vi.fn(async () => []);
    const response = await handleAdminRequest(request("/admin/api/media?includeArchived=1&context=PRODUCT&q=shop"), { DB: db }, { verifyAccessFn: access, listAdminSharedMediaFn: list });
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ assets: [] });
    expect(list).toHaveBeenCalledWith(db, { includeArchived: true, context: "PRODUCT", search: "shop" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
  it("shows current placements through the authenticated private usage route", async () => {
    const db = new MediaUploadDb();
    const usage = vi.fn(async () => ({ asset: { id: "asset-1", usageCount: 2, currentUsageCount: 1 } as SharedMediaAsset, places: [{ type: "SECTION", label: "Local Treats", published: true, draft: false }] as SharedMediaUsagePlace[] }));
    const response = await handleAdminRequest(request("/admin/api/media/asset-1/usage"), { DB: db }, { verifyAccessFn: access, getAdminSharedMediaUsageFn: usage });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json() as { places: unknown[] }).places).toHaveLength(1);
    expect(usage).toHaveBeenCalledWith(db, "asset-1");
  });
  it("uploads through the same library owner with the authenticated actor", async () => {
    const db = new MediaUploadDb(); const put = vi.fn(async () => {});
    const body = new FormData(); body.set("file", new File([new Uint8Array([137,80,78,71,13,10,26,10])], "image.png", { type: "image/png" })); body.set("context", "PRODUCT");
    const response = await handleAdminRequest(request(undefined, "POST", body), { DB: db, PRODUCT_MEDIA: { put, async get() { return null; }, async delete() {} } }, { verifyAccessFn: access });
    expect(response.status).toBe(201); expect(put).toHaveBeenCalledOnce();
    expect((await response.json() as { asset: unknown }).asset).toMatchObject({ createdBy: identity.email, context: "PRODUCT", status: "ACTIVE" });
  });
  it.each(["archive", "restore"])("keeps %s actor and domain error mapping", async operation => {
    const mutate = vi.fn(async () => { throw new Error("shared_media_not_found"); });
    const deps: Partial<SharedMediaDependencies> = operation === "archive" ? { archiveAdminSharedMediaAssetFn: mutate } : { restoreAdminSharedMediaAssetFn: mutate };
    const db = new MediaUploadDb();
    const response = await handleAdminRequest(request("/admin/api/media/asset-1/" + operation, "POST"), { DB: db }, { verifyAccessFn: access, ...deps });
    expect(response.status).toBe(404); expect(mutate).toHaveBeenCalledWith(db, "asset-1", identity.email);
    expect(await response.json()).toEqual({ error: { code: "shared_media_not_found", message: "Image not found." } });
  });
  it.each(["storage", "finalization"])("preserves retry response after %s failure", async failure => {
    const finalize = vi.fn(async () => { if (failure === "finalization") throw new Error("D1 unavailable"); });
    const record = vi.fn(async () => {});
    const response = await handleAdminRequest(request("/admin/api/media/asset-1", "DELETE"), {
      DB: new MediaUploadDb(), PRODUCT_MEDIA: { async put() {}, async get() { return null; }, async delete() { if (failure === "storage") throw new Error("R2 unavailable"); } },
    }, { verifyAccessFn: access, claimSharedMediaObjectDeletionFn: async () => claim, finalizeSharedMediaObjectDeletionFn: finalize, recordSharedMediaDeleteFailureFn: record });
    expect(response.status).toBe(503);
    expect((await response.json() as { error: { code: string } }).error.code).toBe(failure === "storage" ? "shared_media_delete_retry" : "shared_media_delete_finalize_pending");
    expect(finalize).toHaveBeenCalledTimes(failure === "storage" ? 0 : 1);
    expect(record).toHaveBeenCalledTimes(failure === "storage" ? 1 : 0);
  });
  it("leaves unsupported methods to the existing Admin fallback", async () => {
    const response = await handleAdminRequest(request(undefined, "PUT"), { DB: new MediaUploadDb() }, { verifyAccessFn: access });
    expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: { code: "not_found", message: "Not found." } });
  });
});
