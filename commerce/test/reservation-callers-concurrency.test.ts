import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SqliteD1 } from "./helpers/sqlite-d1";
import { reservationActor, reservationFixture, reservationState } from "./helpers/reservation-fixture";
import { getAdminOrderState, applyAdminOrderUpdate } from "../src/data/admin-orders";
import { validateAdminOrderAction } from "../src/domain/admin-order";
import { expireDueReservations } from "../src/data/order-reservations";
import { createCustomerReviewToken, declineCustomerReview } from "../src/data/customer-review";

let db: SqliteD1;
beforeEach(() => { db = new SqliteD1(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-29T12:00:00.000Z")); });
afterEach(() => { db.sqlite.close(); vi.useRealTimers(); });
async function fixture() {
  await reservationFixture(db, "ACTIVE");
  db.sqlite.exec("UPDATE orders SET status='AWAITING_PAYMENT',payment_status='PAYMENT_REQUESTED',final_total_minor=400,delivery_amount_minor=0 WHERE id='ord'");
}
async function state() { const row = await getAdminOrderState(db, "RES-TEST"); if (!row) throw new Error("fixture_order_missing"); return row; }
async function action(name: string, order?: Awaited<ReturnType<typeof state>>) {
  const snapshot = order ?? await state();
  return applyAdminOrderUpdate(db, snapshot, validateAdminOrderAction(snapshot, { action: name }), reservationActor, { inventoryReservations: true });
}
function expire() { return expireDueReservations(db, { now: "2026-10-02T00:00:00.000Z" }); }
function snapshot() {
  return { ...reservationState(db), tokens: db.sqlite.prepare("SELECT * FROM customer_review_tokens ORDER BY id").all() };
}
async function fulfil() { await action("start_preparing"); await action("ready_for_collection"); await action("complete"); }

describe("reservation callers against the real schema", () => {
  it("commits payment then consumes exactly once at collection", async () => {
    await fixture(); await action("mark_paid"); await fulfil();
    expect((await state()).status).toBe("COMPLETED");
    expect(db.sqlite.prepare("SELECT state FROM inventory_reservations").get()?.state).toBe("CONSUMED");
    expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM inventory_movements WHERE movement_type='SALE'").get()?.n).toBe(2);
    for (const row of db.sqlite.prepare("SELECT on_hand,reserved FROM inventory_balances").all()) expect(row).toMatchObject({ on_hand: 8, reserved: 0 });
  });
  it.each([false, true])("cancels with paid=%s and releases the hold", async paid => {
    await fixture(); if (paid) await action("mark_paid");
    await action(paid ? "refund_and_cancel" : "cancel");
    expect((await state()).status).toBe("CANCELLED");
    expect(db.sqlite.prepare("SELECT state FROM inventory_reservations").get()?.state).toBe("RELEASED");
    for (const row of db.sqlite.prepare("SELECT on_hand,reserved FROM inventory_balances").all()) expect(row).toMatchObject({ on_hand: 10, reserved: 0 });
  });
  it("expires an unpaid hold with its revision, token and event", async () => {
    await fixture(); await createCustomerReviewToken(db, "RES-TEST");
    expect(await expire()).toEqual({ expired: 1, skipped: 0 });
    expect((await state()).status).toBe("UNDER_REVIEW");
    expect(db.sqlite.prepare("SELECT state FROM order_revisions").get()?.state).toBe("EXPIRED");
    expect(db.sqlite.prepare("SELECT revoked_at FROM customer_review_tokens").get()?.revoked_at).toBeTruthy();
    const before = snapshot(); expect(await expire()).toEqual({ expired: 0, skipped: 0 }); expect(snapshot()).toEqual(before);
  });
  it.each([false, true])("preserves a payment winner before expiry commits, fulfilled=%s", async fulfilled => {
    await fixture(); let winner: ReturnType<typeof snapshot>;
    db.beforeBatch = async () => { await action("mark_paid"); if (fulfilled) await fulfil(); winner = snapshot(); };
    expect(await expire()).toEqual({ expired: 0, skipped: 1 });
    expect(snapshot()).toEqual(winner!);
  });
  it.each(["before-plan", "before-batch"])("rejects stale payment when expiry wins %s", async when => {
    await fixture(); const stale = await state(); let winner: ReturnType<typeof snapshot>;
    if (when === "before-plan") { await expire(); winner = snapshot(); }
    else db.beforeBatch = async () => { await expire(); winner = snapshot(); };
    await expect(action("mark_paid", stale)).rejects.toThrow("reservation_order_transition_conflict");
    expect(snapshot()).toEqual(winner!);
  });
  it("rejects stale cancellation after payment replaced the ACTIVE hold", async () => {
    await fixture(); const stale = await state(); await action("mark_paid"); const winner = snapshot();
    await expect(action("cancel", stale)).rejects.toThrow("reservation_order_transition_conflict");
    expect(snapshot()).toEqual(winner);
  });
  it("rejects stale fulfilment after its hold was already consumed", async () => {
    await fixture(); await action("mark_paid"); await action("start_preparing"); await action("ready_for_collection");
    const stale = await state(); await action("complete"); const winner = snapshot();
    await expect(action("complete", stale)).rejects.toThrow("reservation_order_transition_conflict");
    expect(snapshot()).toEqual(winner);
  });
  it("keeps orders predating reservations actionable", async () => {
    await reservationFixture(db, "ACTIVE", false);
    db.sqlite.exec("DELETE FROM inventory_reservations; UPDATE orders SET status='AWAITING_PAYMENT',payment_status='PAYMENT_REQUESTED'");
    await action("mark_paid"); expect((await state()).paymentStatus).toBe("PAID");
  });
  it("declines the review and releases stock atomically", async () => {
    await fixture(); const { token } = await createCustomerReviewToken(db, "RES-TEST");
    await declineCustomerReview(db, token, { inventoryReservations: true });
    expect(db.sqlite.prepare("SELECT state FROM inventory_reservations").get()?.state).toBe("RELEASED");
    expect(db.sqlite.prepare("SELECT state FROM order_revisions").get()?.state).toBe("DECLINED");
    expect((await state()).paymentStatus).toBe("UNPAID");
  });
  it.each(["before-plan", "before-batch"])("preserves payment against customer decline %s", async when => {
    await fixture(); const { token } = await createCustomerReviewToken(db, "RES-TEST");
    let winner: ReturnType<typeof snapshot>;
    const pay = async () => { await action("mark_paid"); winner = snapshot(); };
    if (when === "before-batch") db.beforeBatch = pay;
    else {
      const prepare = db.prepare.bind(db); let intercepted = false;
      db.prepare = sql => {
        const statement = prepare(sql);
        if (!intercepted && sql.includes("FROM inventory_reservations") && sql.includes("state = 'ACTIVE'")) {
          intercepted = true; const first = statement.first.bind(statement);
          statement.first = async <T>() => { await pay(); return first<T>(); };
        }
        return statement;
      };
    }
    await expect(declineCustomerReview(db, token, { inventoryReservations: true })).rejects.toThrow("review_conflict");
    expect(snapshot()).toEqual(winner!);
  });
});
