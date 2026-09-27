import { describe, expect, it } from "vitest";
import type { D1DatabaseLike } from "../src/data/d1";
import { sharedMediaStorageOwnedByLibrary } from "../src/data/shared-media";

function database(first: () => Promise<any>): D1DatabaseLike {
  return { prepare() { return { bind() { return this; }, first, async run() {} }; }, async batch() { return []; } };
}

describe("Shared media cleanup ownership guard", () => {
  it.each(["D1 daily row read limit", "no such table: shared_media_assets", "connection reset"])(
    "preserves the object when ownership cannot be determined: %s", async (message) => {
      const db = database(async () => { throw new Error(message); });
      expect(await sharedMediaStorageOwnedByLibrary(db, "library/photo.webp")).toBe(true);
    },
  );
  it("permits cleanup only after a successful lookup finds no owner", async () => {
    expect(await sharedMediaStorageOwnedByLibrary(database(async () => null), "products/photo.webp")).toBe(false);
    expect(await sharedMediaStorageOwnedByLibrary(database(async () => ({ id: "asset-1" })), "library/photo.webp")).toBe(true);
  });
});
