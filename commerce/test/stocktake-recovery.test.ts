import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteD1 } from "./helpers/sqlite-d1";
import { createAdminProduct } from "../src/data/product-editor";
import { initialInventoryCount, adjustInventory, physicalInventoryCount } from "../src/data/inventory";
import { createStocktakeSession, saveStocktakeItem, finalizeStocktakeSession, getStocktakeSession } from "../src/data/stocktake";

let db: SqliteD1;
let variantId: string;
const actor = "owner@example.test";
beforeEach(async () => {
  db = new SqliteD1();
  const product = await createAdminProduct(db, { title: "Stocktake fixture" }, actor);
  variantId = String(db.sqlite.prepare("SELECT id FROM product_variants WHERE product_id=?").get(product.id)?.id);
});
afterEach(() => db.sqlite.close());
async function fixture(tracked: boolean) {
  if (tracked) await initialInventoryCount(db, { variantId, quantity: 10, reason: "Seed", idempotencyKey: "fixture:seed" }, actor);
  const detail = await createStocktakeSession(db, { scopeType: "CUSTOM", customVariantIds: [variantId] }, actor);
  return saveStocktakeItem(db, detail.session.id, variantId, { expectedItemVersion: 1, action: "COUNT", countedOnHand: 7 });
}
function ledger() { return db.sqlite.prepare("SELECT * FROM inventory_movements ORDER BY id").all(); }
function operationKey(session: { id: string; version: number }, chunk = 1) {
  return "stocktake:" + session.id + ":finalize:" + session.version + ":chunk:" + chunk + ":" + variantId + ":loc_ambleside";
}
async function loseSessionSave(sessionId: string) {
  const batch = db.batch.bind(db);
  let calls = 0;
  db.batch = async statements => {
    if (++calls === 2) throw new Error("session_save_unavailable");
    return batch(statements);
  };
  await expect(finalizeStocktakeSession(db, sessionId, actor)).rejects.toThrow("session_save_unavailable");
  db.batch = batch;
}
describe("Stocktake recovery from committed inventory and missing session results", () => {
  it.each([true, false])("recovers a %s tracked baseline without another movement", async tracked => {
    const detail = await fixture(tracked);
    await loseSessionSave(detail.session.id);
    const before = ledger();
    const result = await finalizeStocktakeSession(db, detail.session.id, actor);
    expect(result.session.status).toBe("COMPLETED");
    expect(result.items[0].itemStatus).toBe("APPLIED");
    expect(result.result.conflicts).toEqual([]);
    expect(result.result.success).toHaveLength(1);
    expect(ledger()).toEqual(before);
  });
  it("recovers the receipt without reverting a later stock adjustment", async () => {
    const detail = await fixture(true);
    await loseSessionSave(detail.session.id);
    await adjustInventory(db, { variantId, delta: 2, reasonCode: "RESTOCK", expectedBalanceVersion: 2, idempotencyKey: "later:delivery" }, actor);
    const before = ledger();
    const result = await finalizeStocktakeSession(db, detail.session.id, actor);
    expect(result.session.status).toBe("COMPLETED");
    expect(result.items[0]).toMatchObject({ itemStatus: "APPLIED", currentOnHand: 9 });
    expect(ledger()).toEqual(before);
  });
  it("finds receipts from later chunks using the original operation namespace", async () => {
    const detail = await fixture(true);
    const movement = await physicalInventoryCount(db, { variantId, countedOnHand: 7, reason: "Stocktake", expectedBalanceVersion: 1, idempotencyKey: operationKey(detail.session, 2), batchId: "original-batch" }, actor);
    const before = ledger();
    const result = await finalizeStocktakeSession(db, detail.session.id, actor);
    expect(result.session.status).toBe("COMPLETED");
    expect(result.result.batchId).toBe("original-batch");
    expect(result.result.success).toHaveLength(1);
    expect(ledger()).toEqual(before);
    expect(movement.replayed).toBe(false);
  });
  it("retains a real conflict when no receipt belongs to this attempt", async () => {
    const detail = await fixture(true);
    await adjustInventory(db, { variantId, delta: 2, reasonCode: "RESTOCK", expectedBalanceVersion: 1, idempotencyKey: "unrelated:delivery" }, actor);
    const result = await finalizeStocktakeSession(db, detail.session.id, actor);
    expect(result.session.status).toBe("REVIEW");
    expect(result.items[0]).toMatchObject({ itemStatus: "CONFLICT", currentOnHand: 12 });
  });
  it("does not reuse an earlier session version's receipt", async () => {
    const detail = await fixture(true);
    await loseSessionSave(detail.session.id);
    await saveStocktakeItem(db, detail.session.id, variantId, { expectedItemVersion: 2, action: "COUNT", countedOnHand: 8 });
    const before = ledger();
    const result = await finalizeStocktakeSession(db, detail.session.id, actor);
    expect(result.session.status).toBe("REVIEW");
    expect(result.items[0].itemStatus).toBe("CONFLICT");
    expect(ledger()).toEqual(before);
  });
  it("does not claim an equal quantity alone is a committed count", async () => {
    const detail = await fixture(true);
    await physicalInventoryCount(db, { variantId, countedOnHand: 7, reason: "Other count", expectedBalanceVersion: 1, idempotencyKey: "unrelated:count" }, actor);
    const result = await finalizeStocktakeSession(db, detail.session.id, actor);
    expect(result.session.status).toBe("REVIEW");
    expect((await getStocktakeSession(db, detail.session.id)).items[0].conflictCode).toBe("inventory_concurrency_conflict");
  });

  it.each(["quantity", "type", "duplicate", "chunk"] as const)("fails closed for a mismatched %s receipt", async mismatch => {
    const detail = await fixture(true);
    if (mismatch === "type") {
      await adjustInventory(db, { variantId, delta: -3, reasonCode: "OTHER", expectedBalanceVersion: 1, idempotencyKey: operationKey(detail.session) }, actor);
    } else {
      const requestKey = mismatch === "chunk" ? operationKey(detail.session).replace(":chunk:1:", ":chunk:bad:") : operationKey(detail.session);
      await physicalInventoryCount(db, { variantId, countedOnHand: mismatch === "quantity" ? 8 : 7, reason: "Receipt", expectedBalanceVersion: 1, idempotencyKey: requestKey }, actor);
      if (mismatch === "duplicate") {
        await physicalInventoryCount(db, { variantId, countedOnHand: 7, reason: "Duplicate", expectedBalanceVersion: 2, idempotencyKey: operationKey(detail.session, 2) }, actor);
      }
    }
    const before = ledger();
    const result = await finalizeStocktakeSession(db, detail.session.id, actor);
    expect(result.items[0]).toMatchObject({ itemStatus: "CONFLICT", conflictCode: "inventory_idempotency_conflict" });
    expect(ledger()).toEqual(before);
  });

  it("recovers a committed item and applies a remaining item after interrupted finalization", async () => {
    await initialInventoryCount(db, { variantId, quantity: 10, reason: "Seed", idempotencyKey: "fixture:seed" }, actor);
    const product = await createAdminProduct(db, { title: "Z remaining" }, actor);
    const remainingId = String(db.sqlite.prepare("SELECT id FROM product_variants WHERE product_id=?").get(product.id)?.id);
    const detail = await createStocktakeSession(db, { scopeType: "CUSTOM", customVariantIds: [variantId, remainingId] }, actor);
    await saveStocktakeItem(db, detail.session.id, variantId, { expectedItemVersion: 1, action: "COUNT", countedOnHand: 7 });
    await saveStocktakeItem(db, detail.session.id, remainingId, { expectedItemVersion: 1, action: "COUNT", countedOnHand: 4 });
    const batch = db.batch.bind(db);
    let calls = 0;
    db.batch = async statements => {
      if (++calls > 1) throw new Error("interrupted");
      return batch(statements);
    };
    await expect(finalizeStocktakeSession(db, detail.session.id, actor)).rejects.toThrow("interrupted");
    db.batch = batch;
    const firstReceipt = db.sqlite.prepare("SELECT id FROM inventory_movements WHERE variant_id=? AND movement_type='CORRECTION'").get(variantId);
    const result = await finalizeStocktakeSession(db, detail.session.id, actor);
    expect(result.session.status).toBe("COMPLETED");
    expect(result.items.map(item => item.itemStatus)).toEqual(["APPLIED", "APPLIED"]);
    expect(result.result.success).toHaveLength(2);
    expect(db.sqlite.prepare("SELECT id FROM inventory_movements WHERE variant_id=? AND movement_type='CORRECTION'").all(variantId)).toEqual([firstReceipt]);
    expect(db.sqlite.prepare("SELECT on_hand FROM inventory_balances WHERE variant_id=?").get(remainingId)).toMatchObject({ on_hand: 4 });
  });
});

