import { describe, expect, it, vi } from "vitest";
import { uploadSharedMediaImage } from "../src/data/media-upload";
import { MediaUploadDb } from "./helpers/media-upload-db";

const upload = {
  bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
  extension: "png", mimeType: "image/png", checksumSha256: "validated-hash",
  title: "Homepage", altText: "Shop", context: "HOMEPAGE",
};

describe("shared upload persistence", () => {
  it("persists one reusable asset and R2 metadata without a Product association", async () => {
    const db = new MediaUploadDb();
    const put = vi.fn(async () => {});
    const asset = await uploadSharedMediaImage(db, { put, async get() { return null; }, async delete() {} }, upload, "owner@example.test");
    expect(asset).toMatchObject({
      context: "HOMEPAGE", title: "Homepage", altText: "Shop", status: "ACTIVE",
      fileSize: 8, checksumSha256: upload.checksumSha256, createdBy: "owner@example.test",
      publicUrl: "/media/" + asset.id,
    });
    expect(put).toHaveBeenCalledExactlyOnceWith(asset.storageKey, upload.bytes, {
      httpMetadata: { contentType: "image/png", cacheControl: "public, max-age=31536000, immutable" },
      customMetadata: { assetId: asset.id, checksumSha256: upload.checksumSha256, mediaLibrary: "shared" },
    });
  });

  it.each([false, true])("preserves the original R2 error when cleanup fails: %s", async (cleanupFails) => {
    const db = new MediaUploadDb();
    const original = new Error("put_failed");
    const remove = vi.fn(async () => { if (cleanupFails) throw new Error("delete_failed"); });
    await expect(uploadSharedMediaImage(db, {
      async put() { throw original; }, async get() { return null; }, delete: remove,
    }, upload, "owner@example.test")).rejects.toBe(original);
    expect(db.asset).toBeNull();
    expect(remove).toHaveBeenCalledOnce();
  });

  it("uses a new immutable key for repeated uploads rather than overwriting bytes", async () => {
    const db = new MediaUploadDb();
    const bucket = { async put() {}, async get() { return null; }, async delete() {} };
    const first = await uploadSharedMediaImage(db, bucket, upload, "owner@example.test");
    const second = await uploadSharedMediaImage(db, bucket, upload, "owner@example.test");
    expect(first.storageKey).not.toBe(second.storageKey);
    expect(first.publicUrl).not.toBe(second.publicUrl);
  });
});

