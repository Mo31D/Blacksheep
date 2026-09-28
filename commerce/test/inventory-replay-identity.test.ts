import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteD1 } from "./helpers/sqlite-d1";
import { createAdminProduct } from "../src/data/product-editor";
import { initialInventoryCount, adjustInventory, physicalInventoryCount } from "../src/data/inventory";

let db: SqliteD1;
let target: string;
let other: string;
const actor = "owner@example.test";
const key = "inventory:shared:request";
const operations = ["initial", "adjust", "physical"] as const;
type Operation = typeof operations[number];

async function product(title: string) {
  const p = await createAdminProduct(db, { title }, actor);
  return String(db.sqlite.prepare("SELECT id FROM product_variants WHERE product_id=?").get(p.id)?.id);
}
async function seed(variantId: string) {
  await initialInventoryCount(db, { variantId, quantity: 10, reason: "Fixture", idempotencyKey: "seed:" + variantId }, actor);
}
function perform(op: Operation, variantId = target, requestKey = key) {
  const common = { variantId, idempotencyKey: requestKey };
  if (op === "initial") return initialInventoryCount(db, { ...common, quantity: 7, reason: "Count" }, actor);
  if (op === "adjust") return adjustInventory(db, { ...common, delta: 2, reasonCode: "RESTOCK", expectedBalanceVersion: 1 }, actor);
  return physicalInventoryCount(db, { ...common, countedOnHand: 7, reason: "Count", expectedBalanceVersion: 1 }, actor);
}
function state() {
  return {
    variants: db.sqlite.prepare("SELECT id,track_inventory,version FROM product_variants ORDER BY id").all(),
    balances: db.sqlite.prepare("SELECT * FROM inventory_balances ORDER BY variant_id,location_id").all(),
    movements: db.sqlite.prepare("SELECT * FROM inventory_movements ORDER BY id").all(),
  };
}
beforeEach(async () => { db = new SqliteD1(); target = await product("Target"); other = await product("Other"); });
afterEach(() => db.sqlite.close());

describe.each(operations)("%s inventory replay identity", op => {
  async function prepare() { if (op !== "initial") { await seed(target); await seed(other); } }

  it.each(["before request", "before batch"] as const)("rejects another variant's key %s without applying the losing write", async timing => {
    await prepare();
    let expected: ReturnType<typeof state>;
    const competitor = async () => { await perform(op, other); expected = state(); };
    if (timing === "before request") await competitor();
    else db.beforeBatch = competitor;
    await expect(perform(op)).rejects.toThrow("inventory_idempotency_conflict");
    expect(state()).toEqual(expected!);
  });

  it("still replays a matching request without a second stock movement", async () => {
    await prepare();
    const first = await perform(op);
    const expected = state();
    const second = await perform(op);
    expect(second).toMatchObject({ replayed: true, movementId: first.movementId, snapshot: { variantId: target } });
    expect(state()).toEqual(expected);
  });

  it("recovers a committed matching write when the batch response is lost", async () => {
    await prepare();
    const batch = db.batch.bind(db);
    db.batch = async statements => { await batch(statements); throw new Error("response_lost"); };
    const result = await perform(op);
    expect(result).toMatchObject({ replayed: true, snapshot: { variantId: target } });
    expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM inventory_movements WHERE idempotency_key=?").get(key)).toMatchObject({ n: 1 });
  });

  it("preserves a database failure when no matching movement was committed", async () => {
    await prepare();
    const expected = state();
    db.batch = async () => { throw new Error("database_unavailable"); };
    await expect(perform(op)).rejects.toThrow("database_unavailable");
    expect(state()).toEqual(expected);
  });
});

