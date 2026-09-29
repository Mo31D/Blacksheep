import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteD1 } from "./helpers/sqlite-d1";
import { reservationActor, reservationFixture, reservationState } from "./helpers/reservation-fixture";
import { returnConsumedReservationToStock } from "../src/data/order-reservations";
import { adjustInventory } from "../src/data/inventory";

let db: SqliteD1;
beforeEach(() => { db = new SqliteD1(); });
afterEach(() => db.sqlite.close());
async function fixture(tracked = true) {
  const ids = await reservationFixture(db, "CONSUMED", tracked);
  db.sqlite.exec("UPDATE orders SET payment_status='REFUNDED' WHERE id='ord'");
  return ids;
}
function refundReturn() { return returnConsumedReservationToStock(db, "RES-TEST", reservationActor); }
function assertSingleReturn(tracked = true) {
  expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM inventory_movements WHERE movement_type='RETURN'").get()?.n).toBe(tracked ? 2 : 0);
  expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM order_events WHERE event_type='INVENTORY_RETURNED_TO_STOCK'").get()?.n).toBe(1);
  for (const row of db.sqlite.prepare("SELECT on_hand,reserved FROM inventory_balances").all()) expect(row).toMatchObject({ on_hand: 10, reserved: 0 });
}

describe("reservation return real-schema concurrency", () => {
  it.each([true, false])("returns once and replays with tracked=%s", async tracked => {
    await fixture(tracked);
    const first = await refundReturn();
    const before = reservationState(db);
    const replay = await refundReturn();
    expect(first.idempotentReplay).toBe(false);
    expect(replay).toEqual({ ...first, idempotentReplay: true });
    expect(reservationState(db)).toEqual(before);
    assertSingleReturn(tracked);
  });
  it("recovers a competing return without a second ledger or event", async () => {
    await fixture();
    db.beforeBatch = async () => { await refundReturn(); };
    expect((await refundReturn()).idempotentReplay).toBe(true);
    assertSingleReturn();
  });
  it("recovers a committed but lost batch response", async () => {
    await fixture();
    const batch = db.batch.bind(db);
    db.batch = async <T>(statements: Parameters<typeof db.batch>[0]): Promise<T[]> => {
      await batch<T>(statements);
      throw new Error("response_lost");
    };
    expect((await refundReturn()).idempotentReplay).toBe(true);
    assertSingleReturn();
  });
  it("never reapplies a return over later inventory adjustments", async () => {
    const ids = await fixture();
    await refundReturn();
    await adjustInventory(db, { variantId: ids[0], delta: 3, reasonCode: "RESTOCK", expectedBalanceVersion: 2, idempotencyKey: "later:delivery" }, reservationActor);
    const before = reservationState(db);
    expect((await refundReturn()).idempotentReplay).toBe(true);
    expect(reservationState(db)).toEqual(before);
  });
  it.each(["second-balance", "refund", "order-version", "reservation"])("rolls back all local changes for a competing %s change", async conflict => {
    const ids = await fixture();
    let competingState: ReturnType<typeof reservationState>;
    db.beforeBatch = () => {
      if (conflict === "second-balance") db.sqlite.prepare("UPDATE inventory_balances SET version=version+1,on_hand=on_hand+1 WHERE variant_id=?").run(ids[1]);
      if (conflict === "refund") db.sqlite.exec("UPDATE orders SET payment_status='PAID' WHERE id='ord'");
      if (conflict === "order-version") db.sqlite.exec("UPDATE orders SET updated_at='competing' WHERE id='ord'");
      if (conflict === "reservation") db.sqlite.exec("UPDATE inventory_reservations SET version=version+1 WHERE id='res'");
      competingState = reservationState(db);
    };
    await expect(refundReturn()).rejects.toThrow("inventory_reservations.mutation_token");
    expect(reservationState(db)).toEqual(competingState!);
  });
  it("rejects non-refunded orders without any writes", async () => {
    await reservationFixture(db, "CONSUMED");
    const before = reservationState(db);
    await expect(refundReturn()).rejects.toThrow("return_to_stock_requires_refund");
    expect(reservationState(db)).toEqual(before);
  });
});
