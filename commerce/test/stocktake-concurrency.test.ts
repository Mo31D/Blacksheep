import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteD1 } from "./helpers/sqlite-d1";
import { createAdminProduct } from "../src/data/product-editor";
import { initialInventoryCount, physicalInventoryCount } from "../src/data/inventory";
import { createStocktakeSession, saveStocktakeItem, finalizeStocktakeSession, cancelStocktakeSession, getStocktakeSession } from "../src/data/stocktake";
let db: SqliteD1;
let variantId: string;
const actor = "owner@example.test";
beforeEach(async () => {
  db = new SqliteD1();
  const p = await createAdminProduct(db, { title: "Concurrent count" }, actor);
  variantId = String(db.sqlite.prepare("SELECT id FROM product_variants WHERE product_id=?").get(p.id)?.id);
});
afterEach(() => db.sqlite.close());
async function fixture(tracked: boolean) {
  if (tracked) await initialInventoryCount(db, { variantId, quantity: 10, reason: "Seed", idempotencyKey: "fixture:count" }, actor);
  const detail = await createStocktakeSession(db, { scopeType: "CUSTOM", customVariantIds: [variantId] }, actor);
  return saveStocktakeItem(db, detail.session.id, variantId, { expectedItemVersion: 1, countedOnHand: 7 });
}
function ledger() { return db.sqlite.prepare("SELECT * FROM inventory_movements ORDER BY id").all(); }

describe.each([true, false])("Stocktake finalization fence, tracked=%s", tracked => {
  it.each(["edit", "cancel"] as const)("does not write stock when %s wins before the first mutation", async action => {
    const detail = await fixture(tracked);
    const before = ledger();
    db.beforeBatch = async () => {
      if (action === "edit") await saveStocktakeItem(db, detail.session.id, variantId, { expectedItemVersion: 2, countedOnHand: 8 });
      else await cancelStocktakeSession(db, detail.session.id, detail.session.version);
    };
    await expect(finalizeStocktakeSession(db, detail.session.id, actor)).rejects.toThrow("stocktake_session_version_conflict");
    expect(ledger()).toEqual(before);
    const current = await getStocktakeSession(db, detail.session.id);
    expect(current.session.status).toBe(action === "edit" ? "IN_PROGRESS" : "CANCELLED");
    expect(current.items[0].countedOnHand).toBe(action === "edit" ? 8 : 7);
  });

  it.each(["edit", "cancel"] as const)("blocks %s after stock commits and allows finalization recovery", async action => {
    const detail = await fixture(tracked);
    const batch = db.batch.bind(db);
    let calls = 0;
    db.batch = async statements => {
      if (++calls === 2) throw new Error("lost_session_save");
      return batch(statements);
    };
    await expect(finalizeStocktakeSession(db, detail.session.id, actor)).rejects.toThrow("lost_session_save");
    db.batch = batch;
    const before = ledger();
    const change = action === "edit"
      ? saveStocktakeItem(db, detail.session.id, variantId, { expectedItemVersion: 2, countedOnHand: 8 })
      : cancelStocktakeSession(db, detail.session.id, detail.session.version);
    await expect(change).rejects.toThrow("stocktake_finalization_in_progress");
    const result = await finalizeStocktakeSession(db, detail.session.id, actor);
    expect(result.session.status).toBe("COMPLETED");
    expect(result.items[0].itemStatus).toBe("APPLIED");
    expect(ledger()).toEqual(before);
  });

  it("does not let a stale finalizer overwrite a completed concurrent result", async () => {
    const detail = await fixture(tracked);
    db.beforeBatch = async () => {
      expect((await finalizeStocktakeSession(db, detail.session.id, actor)).session.status).toBe("COMPLETED");
    };
    await expect(finalizeStocktakeSession(db, detail.session.id, actor)).rejects.toThrow("stocktake_session_version_conflict");
    const current = await getStocktakeSession(db, detail.session.id);
    expect(current.session.status).toBe("COMPLETED");
    expect(current.items[0].itemStatus).toBe("APPLIED");
    expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM inventory_movements WHERE idempotency_key LIKE 'stocktake:%'").get()).toMatchObject({ n: 1 });
  });

  it("atomically blocks an edit when a receipt arrives after its preflight", async () => {
    const detail = await fixture(tracked);
    db.beforeBatch = async () => {
      const batch = db.batch.bind(db);
      let calls = 0;
      db.batch = async statements => { if (++calls === 2) throw new Error("pause"); return batch(statements); };
      await expect(finalizeStocktakeSession(db, detail.session.id, actor)).rejects.toThrow("pause");
      db.batch = batch;
    };
    await expect(saveStocktakeItem(db, detail.session.id, variantId, { expectedItemVersion: 2, countedOnHand: 8 })).rejects.toThrow("stocktake_finalization_in_progress");
    const current = await getStocktakeSession(db, detail.session.id);
    expect(current.session.version).toBe(detail.session.version);
    expect(current.items[0].countedOnHand).toBe(7);
    expect((await finalizeStocktakeSession(db, detail.session.id, actor)).session.status).toBe("COMPLETED");
  });

  if (tracked) it("rejects a stale finalizer even when the counted quantity needs no movement", async () => {
    const detail = await fixture(tracked);
    await saveStocktakeItem(db, detail.session.id, variantId, { expectedItemVersion: 2, countedOnHand: 10 });
    const current = await getStocktakeSession(db, detail.session.id);
    const before = ledger();
    db.beforeBatch = () => cancelStocktakeSession(db, detail.session.id, current.session.version).then(() => {});
    await expect(finalizeStocktakeSession(db, detail.session.id, actor)).rejects.toThrow("stocktake_session_version_conflict");
    expect(ledger()).toEqual(before);
  });

  it("recognizes a receipt committed between receipt lookup and balance preflight", async () => {
    const detail = await fixture(tracked);
    const prepare = db.prepare.bind(db);
    let fired = false;
    db.prepare = sql => {
      const statement = prepare(sql);
      if (sql.includes("SELECT v.id AS variantId")) {
        const first = statement.first.bind(statement);
        statement.first = async <T>() => {
          if (!fired) {
            fired = true;
            const key = "stocktake:" + detail.session.id + ":finalize:" + detail.session.version + ":chunk:1:" + variantId + ":loc_ambleside";
            if (tracked) await physicalInventoryCount(db, { variantId, countedOnHand: 7, reason: "Count", expectedBalanceVersion: 1, idempotencyKey: key }, actor);
            else await initialInventoryCount(db, { variantId, quantity: 7, reason: "Count", idempotencyKey: key }, actor);
          }
          return first<T>();
        };
      }
      return statement;
    };
    const result = await finalizeStocktakeSession(db, detail.session.id, actor);
    expect(fired).toBe(true);
    expect(result.session.status).toBe("COMPLETED");
    expect(result.items[0].itemStatus).toBe("APPLIED");
    expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM inventory_movements WHERE idempotency_key LIKE 'stocktake:%'").get()).toMatchObject({ n: 1 });
  });
});

