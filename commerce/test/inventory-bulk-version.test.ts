import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteD1 } from "./helpers/sqlite-d1";
import { createAdminProduct } from "../src/data/product-editor";
import { initialInventoryCount, adjustInventory, bulkInventoryCount } from "../src/data/inventory";

let db: SqliteD1;
let variantId: string;
const actor = "owner@example.test";
beforeEach(async () => {
  db = new SqliteD1();
  const product = await createAdminProduct(db, { title: "Counted product" }, actor);
  variantId = String(db.sqlite.prepare("SELECT id FROM product_variants WHERE product_id=?").get(product.id)?.id);
  await initialInventoryCount(db, { variantId, quantity: 10, reason: "Seed", idempotencyKey: "count:seed" }, actor);
});
afterEach(() => db.sqlite.close());
function count(quantity: number, expectedBalanceVersion: unknown, key = "bulk:count:test") {
  return bulkInventoryCount(db, { reason: "Stocktake", idempotencyKey: key, items: [{ variantId, countedOnHand: quantity, expectedBalanceVersion }] }, actor);
}
function ledger() { return db.sqlite.prepare("SELECT * FROM inventory_movements ORDER BY id").all(); }

describe("bulk count version and replay semantics", () => {
  it("rejects stale equal quantities after an intervening stock write", async () => {
    await adjustInventory(db, { variantId, delta: 2, reasonCode: "RESTOCK", expectedBalanceVersion: 1, idempotencyKey: "other:restock" }, actor);
    const before = ledger();
    const result = await count(12, 1);
    expect(result.conflicts).toEqual([{ variantId, code: "inventory_balance_version_conflict" }]);
    expect(result.unchanged).toEqual([]);
    expect(ledger()).toEqual(before);
  });
  it("keeps a current unchanged count free of additional movements", async () => {
    const before = ledger();
    expect((await count(10, 1)).unchanged).toHaveLength(1);
    expect(ledger()).toEqual(before);
  });
  it("retains the existing optional-version contract", async () => {
    expect((await count(10, undefined)).unchanged).toHaveLength(1);
  });
  it("does not silently accept an invalid version on an unchanged count", async () => {
    expect((await count(10, "bad")).conflicts).toEqual([{ variantId, code: "inventory_expected_balance_version_invalid" }]);
  });
  it("replays an applied count after stock subsequently changes without overwriting it", async () => {
    expect((await count(7, 1)).success).toHaveLength(1);
    await adjustInventory(db, { variantId, delta: 2, reasonCode: "RESTOCK", expectedBalanceVersion: 2, idempotencyKey: "later:restock" }, actor);
    const before = ledger();
    const replay = await count(7, 1);
    expect(replay.conflicts).toEqual([]);
    expect(replay.success).toHaveLength(1);
    expect(ledger()).toEqual(before);
    expect(db.sqlite.prepare("SELECT on_hand FROM inventory_balances WHERE variant_id=?").get(variantId)).toMatchObject({ on_hand: 9 });
  });
  it("accepts a retry of an applied equal count without an extra movement", async () => {
    await count(7, 1);
    const before = ledger();
    const replay = await count(7, 1);
    expect(replay.conflicts).toEqual([]);
    expect(replay.success.length + replay.unchanged.length).toBe(1);
    expect(ledger()).toEqual(before);
  });
});

