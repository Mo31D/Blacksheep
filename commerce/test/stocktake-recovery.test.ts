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
    await physicalInventoryCount(db, { variantId, countedOnHand: 7, reason: "Earlier attempt", expectedBalanceVersion: 1, idempotencyKey: operationKey({ ...detail.session, version: detail.session.version - 1 }) }, actor);
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



describe("completed Stocktake response recovery", () => {
  it.each([true, false])("retries a committed final summary for tracked=%s without writes", async tracked => {
    const detail = await fixture(tracked);
    const batch = db.batch.bind(db);
    let calls = 0;
    db.batch = async <T>(statements: Parameters<typeof db.batch>[0]) => {
      const result = await batch<T>(statements);
      if (++calls === 2) throw new Error("response_lost");
      return result;
    };
    await expect(finalizeStocktakeSession(db, detail.session.id, actor)).rejects.toThrow("response_lost");
    db.batch = batch;
    const saved = await getStocktakeSession(db, detail.session.id);
    expect(saved.session.status).toBe("COMPLETED");
    await adjustInventory(db, { variantId, delta: 2, reasonCode: "RESTOCK", expectedBalanceVersion: tracked ? 2 : 1, idempotencyKey: "after:complete" }, actor);
    const before = ledger();
    db.batch = async () => { throw new Error("completed_retry_must_not_write"); };
    const retry = await finalizeStocktakeSession(db, detail.session.id, actor);
    expect(retry.session).toEqual(saved.session);
    expect(retry.result.success.map(row => row.variantId)).toEqual([variantId]);
    expect(retry.result.unchanged).toEqual([]);
    expect(retry.result.conflicts).toEqual([]);
    expect(retry.items[0].currentOnHand).toBe(9);
    expect(ledger()).toEqual(before);
  });
  it("returns the same saved no-op outcome without inventing a batch receipt", async () => {
    await initialInventoryCount(db, { variantId, quantity: 7, reason: "Seed", idempotencyKey: "seed:no-op" }, actor);
    const detail = await fixture(false);
    const first = await finalizeStocktakeSession(db, detail.session.id, actor);
    const retry = await finalizeStocktakeSession(db, detail.session.id, actor);
    expect(retry).toEqual(first);
    expect(retry.result.success).toEqual([]);
    expect(retry.result.unchanged.map(row => row.variantId)).toEqual([variantId]);
    expect(retry.result.batchId).toBeNull();
  });
});


it("projects all saved outcomes after REVIEW, including earlier applied and skipped items", async () => {
  const ids = [variantId];
  for (let i = 0; i < 3; i++) {
    const product = await createAdminProduct(db, { title: "Completion fixture " + i }, actor);
    ids.push(String(db.sqlite.prepare("SELECT id FROM product_variants WHERE product_id=?").get(product.id)?.id));
  }
  for (const id of ids) await initialInventoryCount(db, { variantId: id, quantity: 10, reason: "Seed", idempotencyKey: "seed:" + id }, actor);
  let detail = await createStocktakeSession(db, { scopeType: "CUSTOM", customVariantIds: ids }, actor);
  for (let i = 0; i < ids.length; i++) detail = await saveStocktakeItem(db, detail.session.id, ids[i], {
    expectedItemVersion: 1, action: i === 3 ? "SKIP" : "COUNT", countedOnHand: i === 1 ? 10 : 7,
  });
  await adjustInventory(db, { variantId: ids[2], delta: 2, reasonCode: "RESTOCK", expectedBalanceVersion: 1, idempotencyKey: "concurrent:delivery" }, actor);
  const review = await finalizeStocktakeSession(db, detail.session.id, actor);
  expect(review.session.status).toBe("REVIEW");
  const conflict = review.items.find(item => item.variantId === ids[2])!;
  await saveStocktakeItem(db, detail.session.id, ids[2], { expectedItemVersion: conflict.version, action: "COUNT", countedOnHand: 7 });
  const completed = await finalizeStocktakeSession(db, detail.session.id, actor);
  const before = ledger();
  const replay = await finalizeStocktakeSession(db, detail.session.id, actor);
  expect(replay).toEqual(completed);
  expect(replay.session.status).toBe("COMPLETED");
  expect(replay.result.success.map(row => row.variantId).sort()).toEqual([ids[0], ids[2]].sort());
  expect(replay.result.unchanged.map(row => row.variantId)).toEqual([ids[1]]);
  expect(replay.session.skippedItems).toBe(1);
  expect(ledger()).toEqual(before);
});
