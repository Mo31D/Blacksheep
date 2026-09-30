import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

const migrations = new URL("../migrations/", import.meta.url);
const migration = readFileSync(new URL("0030_consolidate_section_images.sql", migrations), "utf8");
const opened: DatabaseSync[] = [];

function beforeConsolidation(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  opened.push(db);
  db.exec("PRAGMA foreign_keys=ON");
  for (const name of readdirSync(migrations).filter((name) => name.endsWith(".sql") && name < "0030_").sort()) {
    db.exec(readFileSync(new URL(name, migrations), "utf8"));
  }
  return db;
}

afterEach(() => {
  for (const db of opened.splice(0)) db.close();
});

describe("forward Section image ownership transfer", () => {
  it("moves only Appearance-only images, keeps canonical choices and history", () => {
    const db = beforeConsolidation();
    const appearanceId = db.prepare("SELECT current_published_version_id AS id FROM website_appearance").get()!.id as string;
    const giftsId = db.prepare("SELECT current_published_version_id AS id FROM storefront_nodes WHERE stable_key='gifts'").get()!.id as string;
    const localId = db.prepare("SELECT current_published_version_id AS id FROM storefront_nodes WHERE stable_key='local-treats'").get()!.id as string;
    const placementsBefore = (db.prepare("SELECT COUNT(*) AS count FROM product_version_storefront_placements").get()!.count as number);
    db.prepare("UPDATE storefront_node_versions SET image_url='/media/local-canonical' WHERE id=?").run(localId);
    db.prepare("UPDATE website_appearance_versions SET section_images_json=? WHERE id=?")
      .run(JSON.stringify({ gifts: "/media/gifts-appearance", "local-treats": "/media/local-appearance" }), appearanceId);

    db.exec(migration);

    const image = (key: string) => db.prepare(
      "SELECT v.image_url AS imageUrl FROM storefront_nodes n JOIN storefront_node_versions v ON v.id=n.current_published_version_id WHERE n.stable_key=?",
    ).get(key)!.imageUrl;
    expect(image("gifts")).toBe("/media/gifts-appearance");
    expect(image("local-treats")).toBe("/media/local-canonical");
    expect(db.prepare("SELECT section_images_json AS images FROM website_appearance_versions WHERE id=(SELECT current_published_version_id FROM website_appearance)").get()!.images).toBe("{}");
    expect(db.prepare("SELECT section_images_json AS images FROM website_appearance_versions WHERE id=?").get(appearanceId)!.images)
      .toContain("/media/local-appearance");
    expect(db.prepare("SELECT COUNT(*) AS count FROM product_version_storefront_placements").get()!.count).toBe(placementsBefore);
  });

  it("stops before publication changes when an owner has a conflicting Section draft", () => {
    const db = beforeConsolidation();
    db.exec("UPDATE website_appearance_versions SET section_images_json='{\"gifts\":\"/media/gifts-appearance\"}' WHERE id=(SELECT current_published_version_id FROM website_appearance)");
    db.exec("UPDATE storefront_nodes SET current_draft_version_id='owner-draft' WHERE stable_key='gifts'");
    const before = db.prepare("SELECT current_published_version_id AS id FROM storefront_nodes WHERE stable_key='gifts'").get()!.id;
    expect(() => db.exec(migration)).toThrow();
    expect(db.prepare("SELECT current_published_version_id AS id FROM storefront_nodes WHERE stable_key='gifts'").get()!.id).toBe(before);
  });
});
