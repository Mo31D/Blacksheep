import { describe, expect, it, vi } from "vitest";
import type { D1DatabaseLike } from "../src/data/d1";
import { handleAdminRequest } from "../src/routes/admin";
import { cleanupUnownedMediaUpload } from "../src/data/media-upload-cleanup";
import { MediaUploadDb } from "./helpers/media-upload-db";

describe.each(["upload", "replace"])("Product image %s library ownership", (operation) => {
  it.each(["before", "after", "unknown", "attachment", "response", "success"] as const)(
    "protects library storage at failure stage: %s", async (stage) => {
      const db = new MediaUploadDb();
      if (stage === "before" || stage === "after" || stage === "unknown") db.failure = stage;
      const deleteObject = vi.fn(async (_key: string) => {});
      let storedKey = "";
      let reads = 0;
      const mutate = vi.fn(async (_db, _productId, raw) => {
        expect(db.asset).toMatchObject({ storageKey: storedKey, context: "PRODUCT", status: "ACTIVE" });
        expect(raw).toMatchObject({ storageKey: storedKey, publicUrl: db.asset!.publicUrl, expectedVersion: 4 });
        if (stage === "attachment") throw new Error("mutation_failed");
        return { mediaId: "saved-media", oldStorageKey: "old-key", oldStorageProvider: "R2", shouldDeleteOldObject: false };
      });
      const form = new FormData();
      form.set("expectedVersion", "4");
      form.set("file", new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "photo.png", { type: "image/png" }));
      const path = "/admin/api/products/prd-1/media" + (operation === "replace" ? "/old-media/replace" : "");
      const response = await handleAdminRequest(
        new Request("https://admin.example.com" + path, { method: "POST", headers: { origin: "https://admin.example.com" }, body: form }),
        { DB: db, PRODUCT_MEDIA: {
          async put(key) { storedKey = key; },
          async get() { return null; },
          delete: deleteObject,
        } },
        {
          verifyAccessFn: async () => ({ ok: true, status: 200, identity: { email: "owner@example.com", subject: "owner" } }),
          getAdminProductDetailFn: async () => {
            if (++reads > 1 && stage === "response") throw new Error("response_reload_failed");
            return { id: "prd-1", version: 4, draftVersionId: "draft-1", publicationStatus: "ACTIVE" };
          },
          addAdminProductMediaFn: mutate,
          replaceAdminProductMediaFn: async (database, id, _old, raw) => mutate(database, id, raw),
        },
      );
      expect(response.status).toBe(stage === "success" ? 201 : 400);
      expect(storedKey).toMatch(/^library\/\d{4}-\d{2}\/asset_.*\.png$/);
      expect(mutate).toHaveBeenCalledTimes(["attachment", "response", "success"].includes(stage) ? 1 : 0);
      if (stage === "before") expect(deleteObject).toHaveBeenCalledWith(storedKey);
      else expect(deleteObject).not.toHaveBeenCalled();
    },
  );
});

describe("upload compensation shared ownership", () => {
  it.each(["owned", "unknown", "absent"])("handles library ownership: %s", async (ownership) => {
    const deleteObject = vi.fn(async () => {});
    const db: D1DatabaseLike = {
      prepare(sql) {
        return {
          bind() { return this; },
          async first<T>() {
            if (sql.includes("shared_media_assets")) {
              if (ownership === "unknown") throw new Error("quota exhausted");
              return (ownership === "owned" ? { id: "asset-1" } : null) as T | null;
            }
            return null;
          },
          async run() {},
        };
      },
      async batch() { return []; },
    };
    await cleanupUnownedMediaUpload(db, { async put() {}, async get() { return null; }, delete: deleteObject }, "library/new-key.png");
    expect(deleteObject).toHaveBeenCalledTimes(ownership === "absent" ? 1 : 0);
    deleteObject.mockRejectedValueOnce(new Error("R2 unavailable"));
    await expect(cleanupUnownedMediaUpload(db, { async put() {}, async get() { return null; }, delete: deleteObject }, "library/new-key.png"))
      .resolves.toBeUndefined();
  });
});
