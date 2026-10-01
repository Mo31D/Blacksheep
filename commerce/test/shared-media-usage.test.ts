import { describe, expect, it } from "vitest";
import { SqliteD1 } from "./helpers/sqlite-d1";
import { createAdminSharedMediaAsset, getAdminSharedMediaUsage, listAdminSharedMedia } from "../src/data/shared-media";

describe("Image Library usage", () => {
  it("separates current Section placement from retained history and classification", async () => {
    const db = new SqliteD1();
    const asset = await createAdminSharedMediaAsset(db, {
      assetId: "asset-usage", storageKey: "library/usage.png", publicUrl: "/media/asset-usage",
      mimeType: "image/png", fileSize: 4, checksumSha256: "a".repeat(64),
      title: "Homepage hero", context: "HOMEPAGE",
    }, "owner@example.test");
    expect(asset.currentUsageCount).toBe(0);
    expect((await getAdminSharedMediaUsage(db, asset.id)).places).toEqual([]);

    const node = db.sqlite.prepare("SELECT n.id, n.current_published_version_id AS versionId, v.name FROM storefront_nodes n JOIN storefront_node_versions v ON v.id = n.current_published_version_id LIMIT 1").get() as { id: string; versionId: string; name: string };
    db.sqlite.prepare("UPDATE storefront_node_versions SET image_url = ? WHERE id = ?").run(asset.publicUrl, node.versionId);
    const placed = (await listAdminSharedMedia(db))[0];
    expect(placed.currentUsageCount).toBe(1);
    expect((await getAdminSharedMediaUsage(db, asset.id)).places).toEqual([
      { type: "SECTION", label: node.name, published: true, draft: false },
    ]);

    db.sqlite.prepare("UPDATE storefront_node_versions SET image_url = NULL WHERE id = ?").run(node.versionId);
    expect((await listAdminSharedMedia(db))[0]).toMatchObject({ currentUsageCount: 0, usageCount: 0 });
    db.sqlite.prepare("UPDATE storefront_node_versions SET image_url = ? WHERE id = ?").run(asset.publicUrl, node.versionId);
    db.sqlite.prepare("INSERT INTO storefront_node_versions (id,node_id,version_number,name,slug,created_by,created_at,image_url) SELECT 'historic-image-test',node_id,999,name,slug || '-historic-image-test',created_by,created_at,image_url FROM storefront_node_versions WHERE id = ?").run(node.versionId);
    db.sqlite.prepare("UPDATE storefront_node_versions SET image_url = NULL WHERE id = ?").run(node.versionId);
    expect((await listAdminSharedMedia(db))[0]).toMatchObject({ currentUsageCount: 0, usageCount: 1 });
    expect((await getAdminSharedMediaUsage(db, asset.id)).places).toEqual([]);
  });
});
