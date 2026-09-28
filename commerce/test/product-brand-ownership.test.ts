import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteD1 } from "./helpers/sqlite-d1";
import { createAdminProduct, duplicateAdminProduct, saveAdminProductDraft } from "../src/data/product-editor";

let db: SqliteD1;
let productId: string;
const actor = "owner@example.test";
function brand(id = productId) {
  return db.sqlite.prepare("SELECT pv.brand FROM products p JOIN product_versions pv ON pv.id=p.current_draft_version_id WHERE p.id=?").get(id)?.brand;
}
beforeEach(async () => {
  db = new SqliteD1();
  db.sqlite.prepare("INSERT INTO categories(id,slug,name,category_type,created_at,updated_at) VALUES('range','range',?,'BRAND_RANGE','t','t')").run("Romney's");
  productId = (await createAdminProduct(db, { title: "Toffee", brand: "Walker's Nonsuch", categoryIds: ["range"] }, actor)).id;
});
afterEach(() => db?.sqlite.close());

describe("versioned brand and range ownership", () => {
  it("preserves the independent maker through category edits and duplication", async () => {
    expect(brand()).toBe("Walker's Nonsuch");
    await saveAdminProductDraft(db, productId, { expectedVersion: 1, changes: { categoryIds: [], shortDescription: "Edited" } }, actor);
    expect(brand()).toBe("Walker's Nonsuch");
    const copy = await duplicateAdminProduct(db, productId, { expectedVersion: 2 }, actor);
    expect(brand(copy.id)).toBe("Walker's Nonsuch");
  });

  it("changes or clears the maker only when explicitly requested", async () => {
    await saveAdminProductDraft(db, productId, { expectedVersion: 1, changes: { brand: "New maker" } }, actor);
    expect(brand()).toBe("New maker");
    await saveAdminProductDraft(db, productId, { expectedVersion: 2, changes: { brand: null } }, actor);
    expect(brand()).toBeNull();
    expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM product_version_categories").get()).toMatchObject({ count: 1 });
  });
});

