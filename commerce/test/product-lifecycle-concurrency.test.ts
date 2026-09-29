import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SqliteD1 } from "./helpers/sqlite-d1";
import { createAdminProduct, quickEditAdminProduct, publishAdminProduct, archiveAdminProduct } from "../src/data/product-editor";
import { addAdminProductMedia, updateAdminProductMedia, reorderAdminProductMedia, removeAdminProductMedia, replaceAdminProductMedia } from "../src/data/product-media";

let db: SqliteD1, productId: string;
const actor = "owner@example.test";
const media = { altText: null, storageKey: "products/new.png", publicUrl: "/media/new", mimeType: "image/png", fileSize: 8, checksumSha256: "hash" };
beforeEach(async () => {
  db = new SqliteD1(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-29T12:00:00.000Z"));
  productId = (await createAdminProduct(db, { title: "Original", priceMinor: 100 }, actor)).id;
  await addAdminProductMedia(db, productId, { ...media, expectedVersion: 1, mediaId: "old", storageKey: "products/old.png" }, actor);
  await addAdminProductMedia(db, productId, { ...media, expectedVersion: 2, mediaId: "second", storageKey: "products/second.png" }, actor);
  const draft = db.sqlite.prepare("SELECT current_draft_version_id AS id FROM products WHERE id=?").get(productId)?.id;
  db.sqlite.exec("INSERT INTO categories(id,slug,name,created_at,updated_at) VALUES('test','test','Test','t','t')");
  db.sqlite.prepare("INSERT INTO product_version_categories(product_version_id,category_id,is_primary) VALUES(?,'test',1)").run(String(draft));
});
afterEach(() => { db.sqlite.close(); vi.useRealTimers(); });
function snapshot() {
  return Object.fromEntries(["products", "product_variants", "product_versions", "product_media", "product_version_media", "product_audit_events"].map(table => [table, db.sqlite.prepare("SELECT * FROM " + table + " ORDER BY rowid").all()]));
}
function mutate(kind: string) {
  const version = { expectedVersion: 3 };
  switch (kind) {
    case "publish": return publishAdminProduct(db, productId, version, actor);
    case "archive": return archiveAdminProduct(db, productId, version, actor);
    case "add": return addAdminProductMedia(db, productId, { ...media, ...version, mediaId: "new" }, actor);
    case "replace": return replaceAdminProductMedia(db, productId, "old", { ...media, ...version, mediaId: "new" }, actor);
    case "metadata": return updateAdminProductMedia(db, productId, "old", { ...version, altText: "Changed" }, actor);
    case "reorder": return reorderAdminProductMedia(db, productId, { ...version, mediaIds: ["second", "old"] }, actor);
    default: return removeAdminProductMedia(db, productId, "old", version, actor);
  }
}
describe.each(["publish", "archive", "add", "replace", "metadata", "reorder", "remove"])("Product %s transaction", kind => {
  it("rejects a stale same-millisecond write and preserves all winner state", async () => {
    let committed: ReturnType<typeof snapshot>;
    db.beforeBatch = async () => {
      await quickEditAdminProduct(db, productId, { expectedVersion: 3, expectedVariantVersion: 1, priceMinor: 200 }, actor);
      committed = snapshot();
    };
    await expect(mutate(kind)).rejects.toThrow("product_version_conflict");
    expect(snapshot()).toEqual(committed!);
  });
  it("accepts the current version", async () => {
    await mutate(kind);
    expect(db.sqlite.prepare("SELECT version FROM products WHERE id=?").get(productId)).toEqual({ version: 4 });
    expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM product_audit_events WHERE product_id=?").get(productId)).toEqual({ n: 4 });
  });
});
