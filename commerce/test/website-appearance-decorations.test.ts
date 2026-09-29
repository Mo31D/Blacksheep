import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteD1 } from "./helpers/sqlite-d1";
import {
  getAdminWebsiteAppearance,
  getPublishedWebsiteAppearance,
  publishAdminWebsiteAppearance,
  restoreAdminWebsiteAppearance,
  saveAdminWebsiteAppearanceDraft,
} from "../src/data/website-appearance";

const actor = "owner@example.test";
let db: SqliteD1;
beforeEach(() => { db = new SqliteD1(); });
afterEach(() => db.sqlite.close());

describe("versioned Appearance decoration control", () => {
  it("keeps old published versions off, previews a draft, publishes, and restores the prior choice", async () => {
    expect((await getPublishedWebsiteAppearance(db)).decorationsEnabled).toBe(false);

    await saveAdminWebsiteAppearanceDraft(db, { expectedVersion: 1, presetKey: "WINTER" }, actor);
    expect((await getAdminWebsiteAppearance(db)).decorationsEnabled).toBe(true);
    expect((await getPublishedWebsiteAppearance(db)).decorationsEnabled).toBe(false);

    await publishAdminWebsiteAppearance(db, 2, actor);
    expect((await getPublishedWebsiteAppearance(db)).decorationsEnabled).toBe(true);

    await restoreAdminWebsiteAppearance(db, "wav_default_1", 3, actor);
    const restored = await getPublishedWebsiteAppearance(db);
    expect(restored.presetKey).toBe("DEFAULT");
    expect(restored.decorationsEnabled).toBe(false);
  });

  it("keeps an explicit disabled choice across later draft edits", async () => {
    await saveAdminWebsiteAppearanceDraft(db, {
      expectedVersion: 1, presetKey: "CHRISTMAS", decorationsEnabled: false,
    }, actor);
    await saveAdminWebsiteAppearanceDraft(db, {
      expectedVersion: 2, hero: { heading: "Festive gifts" },
    }, actor);
    expect((await getAdminWebsiteAppearance(db)).decorationsEnabled).toBe(false);
    await expect(saveAdminWebsiteAppearanceDraft(db, {
      expectedVersion: 3, decorationsEnabled: "yes",
    }, actor)).rejects.toThrow("appearance_decorations_invalid");
  });
});
