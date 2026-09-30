import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteD1 } from "./helpers/sqlite-d1";
import { createAdminStorefrontNode, updateAdminStorefrontNode } from "../src/data/storefront-structure";
import { getAdminWebsiteAppearance, saveAdminWebsiteAppearanceDraft } from "../src/data/website-appearance";
import { claimSharedMediaObjectDeletion, createAdminSharedMediaAsset } from "../src/data/shared-media";

let db: SqliteD1;
const actor = "owner@example.test";
const url = "/media/asset-new";
const operations = ["create", "draft", "published", "hero"] as const;
type Operation = typeof operations[number];
beforeEach(async () => {
  db = new SqliteD1();
  await createAdminSharedMediaAsset(db, {
    assetId: "asset-new", storageKey: "library/new.png", publicUrl: url,
    mimeType: "image/png", fileSize: 8, checksumSha256: "hash", context: "SECTION",
  }, actor);
});
afterEach(() => db?.sqlite.close());

async function prepare(operation: Operation, initialUrl: string | null = null) {
  if (operation === "create") return (imageUrl: string | null) =>
    createAdminStorefrontNode(db, { name: "New section", imageUrl }, actor);
  if (operation === "draft" || operation === "published") {
    const { id } = await createAdminStorefrontNode(db, { name: "Existing section", imageUrl: initialUrl }, actor);
    if (operation === "published") {
      db.sqlite.prepare("UPDATE storefront_nodes SET current_published_version_id=current_draft_version_id, current_draft_version_id=NULL, publication_status='ACTIVE' WHERE id=?").run(id);
    }
    return (imageUrl: string | null) => updateAdminStorefrontNode(db, id, {
      expectedVersion: 1, imageUrl, shortDescription: "Edited text",
    }, actor);
  }
  if (initialUrl) {
    await saveAdminWebsiteAppearanceDraft(db, {
      expectedVersion: 1,
      hero: { imageUrl: initialUrl },
    }, actor);
  }
  const current = await getAdminWebsiteAppearance(db);
  return (imageUrl: string | null) => saveAdminWebsiteAppearanceDraft(db, {
    expectedVersion: current.version,
    hero: { imageUrl, heading: "Edited heading" },
  }, actor);
}

function snapshot() {
  return ["storefront_nodes", "storefront_node_versions", "storefront_audit_events",
    "website_appearance", "website_appearance_versions", "website_appearance_audit_events"]
    .map(table => db.sqlite.prepare("SELECT * FROM " + table + " ORDER BY id").all());
}

describe.each(operations)("%s image reference availability", operation => {
  it.each(["ARCHIVED", "DELETED", "CLAIMED", "FAILED", "DONE"])(
    "rejects an asset becoming %s before the batch without partial content/audit writes", async state => {
      const mutate = await prepare(operation);
      const before = snapshot();
      db.beforeBatch = () => {
        if (state === "ARCHIVED" || state === "DELETED") {
          db.sqlite.prepare("UPDATE shared_media_assets SET status=? WHERE id='asset-new'").run(state);
        } else {
          db.sqlite.prepare(`INSERT INTO shared_media_delete_jobs
            (asset_id,storage_key,state,attempt_count,claim_token,claimed_by,claimed_at,updated_at)
            VALUES('asset-new','library/new.png',?,1,'claim','owner','t','t')`).run(state);
        }
      };
      await expect(mutate(url)).rejects.toThrow();
      expect(snapshot()).toEqual(before);
    },
  );

  it("rejects attachment after an actual deletion claim wins", async () => {
    const mutate = await prepare(operation);
    const before = snapshot();
    db.beforeBatch = async () => {
      db.sqlite.exec("UPDATE shared_media_assets SET status='ARCHIVED' WHERE id='asset-new'");
      expect((await claimSharedMediaObjectDeletion(db, "asset-new", actor)).claimToken).toBeTruthy();
    };
    await expect(mutate(url)).rejects.toThrow();
    expect(snapshot()).toEqual(before);
  });

  it("protects a successfully saved image from subsequent deletion", async () => {
    const mutate = await prepare(operation);
    await mutate(url);
    db.sqlite.exec("UPDATE shared_media_assets SET status='ARCHIVED' WHERE id='asset-new'");
    await expect(claimSharedMediaObjectDeletion(db, "asset-new", actor)).rejects.toThrow("shared_media_delete_blocked");
  });

  it.each([null, "/images/legacy.png", "https://images.example.test/photo.png"])(
    "preserves non-library image support: %s", async imageUrl => {
      const mutate = await prepare(operation);
      await mutate(imageUrl);
    },
  );
});

describe.each(["draft", "published", "hero"] as const)(
  "%s existing archived reference", operation => {
    it("allows text edits retaining the already referenced image", async () => {
      const mutate = await prepare(operation, url);
      db.sqlite.exec("UPDATE shared_media_assets SET status='ARCHIVED' WHERE id='asset-new'");
      await mutate(url);
      await expect(claimSharedMediaObjectDeletion(db, "asset-new", actor)).rejects.toThrow("shared_media_delete_blocked");
    });
  },
);


it("rejects attempts to edit Section images through Appearance", async () => {
  const before = snapshot();
  await expect(saveAdminWebsiteAppearanceDraft(db, {
    expectedVersion: 1,
    sectionImages: { gifts: url },
  }, actor)).rejects.toThrow("appearance_section_images_owned_by_storefront");
  expect(snapshot()).toEqual(before);
});

