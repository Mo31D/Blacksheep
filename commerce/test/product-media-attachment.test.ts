import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteD1 } from "./helpers/sqlite-d1";
import { addAdminProductMedia, replaceAdminProductMedia } from "../src/data/product-media";
import { claimSharedMediaObjectDeletion, createAdminSharedMediaAsset } from "../src/data/shared-media";

let db: SqliteD1;
const actor = "owner@example.test";
const input = {
  expectedVersion: 2, mediaId: "new", storageKey: "library/new.png",
  publicUrl: "/media/asset-new", mimeType: "image/png", fileSize: 8,
  checksumSha256: "hash",
};
beforeEach(async () => {
  db = new SqliteD1();
  db.sqlite.exec(`
    INSERT INTO products(id,current_slug,publication_status,current_draft_version_id,created_at,updated_at)
      VALUES('p','product','DRAFT','draft','t','t');
    INSERT INTO product_versions(id,product_id,version_number,title,short_description,product_type,created_by,created_at)
      VALUES('draft','p',1,'Product','Description','gifts','owner','t'),
            ('history','p',2,'Product','Description','gifts','owner','t');
  `);
  await addAdminProductMedia(db, "p", {
    ...input, expectedVersion: 1, mediaId: "old", storageKey: "products/p/old.png", publicUrl: "/media/old",
    altText: "Original alt",
  }, actor);
  db.sqlite.exec(`
    UPDATE product_version_media SET position=3, display_fit='COVER';
    INSERT INTO product_version_media SELECT 'history',media_id,position,is_primary,alt_text,display_fit
      FROM product_version_media WHERE product_version_id='draft';
  `);
  await createAdminSharedMediaAsset(db, { ...input, assetId: "asset-new", context: "PRODUCT" }, actor);
});
afterEach(() => db?.sqlite.close());

describe.each(["add", "replace"] as const)("atomic Product %s media attachment", operation => {
  const mutate = () => operation === "add"
    ? addAdminProductMedia(db, "p", { ...input, altText: null }, actor)
    : replaceAdminProductMedia(db, "p", "old", input, actor);

  it.each(["ARCHIVED", "DELETED", "CLAIMED", "FAILED", "DONE"])(
    "rejects an asset becoming %s between read and write without changing Product/history", async state => {
      db.beforeBatch = () => {
        if (state === "ARCHIVED" || state === "DELETED") {
          db.sqlite.prepare("UPDATE shared_media_assets SET status=? WHERE id='asset-new'").run(state);
        } else {
          db.sqlite.prepare(`INSERT INTO shared_media_delete_jobs
            (asset_id,storage_key,state,attempt_count,claim_token,claimed_by,claimed_at,updated_at)
            VALUES('asset-new','library/new.png',?,1,'claim','owner','t','t')`).run(state);
        }
      };
      await expect(mutate()).rejects.toThrow("product_version_conflict");
      expect(db.sqlite.prepare("SELECT version FROM products WHERE id='p'").get()).toMatchObject({ version: 2 });
      expect(db.sqlite.prepare("SELECT id FROM product_media ORDER BY id").all()).toEqual([{ id: "old" }]);
      expect(db.sqlite.prepare("SELECT media_id FROM product_version_media ORDER BY product_version_id").all())
        .toEqual([{ media_id: "old" }, { media_id: "old" }]);
      expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM product_audit_events").get()).toMatchObject({ count: 1 });
    },
  );

  it("rejects attachment when the real deletion claim wins before the batch", async () => {
    db.beforeBatch = async () => {
      db.sqlite.exec("UPDATE shared_media_assets SET status='ARCHIVED' WHERE id='asset-new'");
      const claim = await claimSharedMediaObjectDeletion(db, "asset-new", actor);
      expect(claim.claimToken).toBeTruthy();
    };
    await expect(mutate()).rejects.toThrow("product_version_conflict");
    expect(db.sqlite.prepare("SELECT id FROM product_media WHERE id='new'").get()).toBeUndefined();
    expect(db.sqlite.prepare("SELECT media_id FROM product_version_media WHERE product_version_id='draft'").get())
      .toMatchObject({ media_id: "old" });
  });

  it("attaches an active asset and then blocks destructive deletion", async () => {
    await mutate();
    db.sqlite.exec("UPDATE shared_media_assets SET status='ARCHIVED' WHERE id='asset-new'");
    await expect(claimSharedMediaObjectDeletion(db, "asset-new", actor)).rejects.toThrow("shared_media_delete_blocked");
    expect(db.sqlite.prepare("SELECT * FROM shared_media_delete_jobs").all()).toEqual([]);
    expect(db.sqlite.prepare("SELECT media_id FROM product_version_media WHERE product_version_id='history'").get())
      .toMatchObject({ media_id: "old" });
    if (operation === "replace") {
      expect(db.sqlite.prepare("SELECT * FROM product_version_media WHERE product_version_id='draft'").get())
        .toMatchObject({ media_id: "new", position: 3, is_primary: 1, alt_text: "Original alt", display_fit: "COVER" });
      expect(db.sqlite.prepare("SELECT deleted_at FROM product_media WHERE id='old'").get()).toMatchObject({ deleted_at: null });
    }
  });
});

