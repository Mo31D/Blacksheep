import { describe, expect, it, vi } from "vitest";
import type { D1DatabaseLike } from "../src/data/d1";
import { handleAdminRequest } from "../src/routes/admin";
import { cleanupUnownedMediaUpload } from "../src/data/media-upload-cleanup";

describe.each(["upload", "replace"])("Product image %s failure cleanup", (operation) => {
  it.each(["committed", "uncertain", "unowned"])("protects storage when D1 ownership is %s", async (ownership) => {
    const deleteObject = vi.fn(async (_key: string) => {});
    let storedKey = "";
    let reads = 0;
    const db: D1DatabaseLike = {
      prepare(sql) {
        return {
          bind(...values: unknown[]) {
            if (sql.includes("FROM product_media")) expect(values).toEqual([storedKey]);
            return this;
          },
          async first<T>() {
            if (sql.includes("FROM product_media")) {
              if (ownership === "uncertain") throw new Error("D1 unavailable");
              return (ownership === "committed" ? { id: "saved-media" } : null) as T | null;
            }
            return null;
          },
          async run() {},
        };
      },
      async batch() { return []; },
    };
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
          if (++reads > 1) throw new Error("response_reload_failed");
          return { id: "prd-1", version: 4, draftVersionId: "draft-1", publicationStatus: "ACTIVE" };
        },
        addAdminProductMediaFn: async () => {
          if (ownership !== "committed") throw new Error("mutation_failed");
          return { mediaId: "saved-media" };
        },
        replaceAdminProductMediaFn: async () => {
          if (ownership !== "committed") throw new Error("mutation_failed");
          return { mediaId: "saved-media", oldStorageKey: "old-key", oldStorageProvider: "R2", shouldDeleteOldObject: false };
        },
      },
    );
    expect(response.status).toBe(400);
    expect(storedKey).toContain("products/prd-1/");
    if (ownership === "unowned") expect(deleteObject).toHaveBeenCalledWith(storedKey);
    else expect(deleteObject).not.toHaveBeenCalled();
  });
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
