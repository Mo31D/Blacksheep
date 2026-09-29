import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SqliteD1 } from "./helpers/sqlite-d1";
import { createAdminProduct, quickEditAdminProduct, updateAdminVariant, saveAdminProductDraft } from "../src/data/product-editor";

let db: SqliteD1, productId: string, variantId: string;
const actor = "owner@example.test";
beforeEach(async () => {
  db = new SqliteD1(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-29T12:00:00.000Z"));
  productId = (await createAdminProduct(db, { title: "Original", priceMinor: 100 }, actor)).id;
  variantId = String(db.sqlite.prepare("SELECT id FROM product_variants WHERE product_id=?").get(productId)?.id);
});
afterEach(() => { db.sqlite.close(); vi.useRealTimers(); });
function snapshot() {
  return Object.fromEntries(["products", "product_variants", "product_versions", "product_version_categories", "product_version_storefront_placements", "product_audit_events"].map(table => [table, db.sqlite.prepare("SELECT * FROM " + table + " ORDER BY rowid").all()]));
}
function edit(kind: string, winner = false) {
  if (kind === "draft") return saveAdminProductDraft(db, productId, { expectedVersion: 1, changes: { title: winner ? "Winner" : "Loser" } }, actor);
  if (kind === "variant") return updateAdminVariant(db, variantId, { expectedVersion: 1, priceMinor: winner ? 200 : 300 }, actor);
  return quickEditAdminProduct(db, productId, { expectedVersion: 1, expectedVariantVersion: 1, priceMinor: winner ? 200 : 300 }, actor);
}

describe("Product edit writers share version-conflict semantics", () => {
  for (const loser of ["draft", "quick", "variant"]) {
    for (const winner of ["draft", "quick", "variant"]) {
      it(loser + " cannot borrow a same-millisecond " + winner + " write", async () => {
        let committed: ReturnType<typeof snapshot>;
        db.beforeBatch = async () => { await edit(winner, true); committed = snapshot(); };
        await expect(edit(loser)).rejects.toThrow("product_version_conflict");
        expect(snapshot()).toEqual(committed!);
      });
    }
  }
  it.each(["quick", "variant"])("uses shared price validation for %s", async kind => {
    const before = snapshot();
    const request = kind === "quick"
      ? quickEditAdminProduct(db, productId, { expectedVersion: 1, expectedVariantVersion: 1, priceMinor: -1 }, actor)
      : updateAdminVariant(db, variantId, { expectedVersion: 1, priceMinor: -1 }, actor);
    await expect(request).rejects.toThrow("product_price_invalid"); expect(snapshot()).toEqual(before);
  });
});
