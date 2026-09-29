import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteD1 } from "./helpers/sqlite-d1";
import { reservationActor, reservationFixture, reservationState } from "./helpers/reservation-fixture";
import { getActiveReservationReleasePlan, getCommittedReservationPlan, prepareReservationReleaseMutation, prepareReservationConsumeMutation } from "../src/data/order-reservations";

let db: SqliteD1;
beforeEach(() => { db = new SqliteD1(); });
afterEach(() => db.sqlite.close());
const attemptTime = "2026-09-29T11:00:00.000Z";

for (const kind of ["release-active", "release-committed", "consume"] as const) {
  describe(kind + " real-schema atomicity", () => {
    async function prepare(tracked = true) {
      const source = kind === "release-active" ? "ACTIVE" : "COMMITTED";
      const ids = await reservationFixture(db, source, tracked);
      const plan = await (source === "ACTIVE" ? getActiveReservationReleasePlan : getCommittedReservationPlan)(db, "rev");
      if (!plan) throw new Error("fixture_plan_missing");
      const externalOrderGuard = { orderId: "ord", status: "PAID", paymentStatus: "PAID", updatedAt: attemptTime };
      const mutation = kind === "consume"
        ? prepareReservationConsumeMutation(db, plan, { actorEmail: reservationActor, externalOrderGuard })
        : prepareReservationReleaseMutation(db, plan, { actorEmail: reservationActor, reason: "Cancel", sourceState: source, externalOrderGuard });
      // Test caller-style composition: earlier order/event writes must roll back too.
      const statements = [
        db.prepare("UPDATE orders SET updated_at=? WHERE id='ord'").bind(attemptTime),
        db.prepare("INSERT INTO order_events (order_id,event_type,actor_type,created_at) VALUES ('ord','TEST_TRANSITION','admin',?)").bind(attemptTime),
        ...mutation.statements,
      ];
      return { ids, statements };
    }
    it.each([true, false])("commits a valid transition with tracked=%s", async tracked => {
      const { statements } = await prepare(tracked);
      await db.batch(statements);
      expect(db.sqlite.prepare("SELECT state FROM inventory_reservations WHERE id='res'").get()?.state).toBe(kind === "consume" ? "CONSUMED" : "RELEASED");
      const balances = db.sqlite.prepare("SELECT on_hand,reserved FROM inventory_balances").all();
      expect(balances).toHaveLength(tracked ? 2 : 0);
      for (const row of balances) expect(row).toMatchObject({ on_hand: kind === "consume" ? 8 : 10, reserved: 0 });
      const movements = db.sqlite.prepare("SELECT movement_type,on_hand_delta,reserved_delta FROM inventory_movements WHERE reservation_id='res'").all();
      expect(movements).toHaveLength(tracked ? 2 : 0);
      for (const row of movements) expect(row).toMatchObject({ movement_type: kind === "consume" ? "SALE" : "RESERVATION_RELEASE", on_hand_delta: kind === "consume" ? -2 : 0, reserved_delta: -2 });
      expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM order_events").get()?.n).toBe(1);
    });
    it.each(["second-balance", "reservation", "order"])("rolls back every local write after competing %s change", async conflict => {
      const { ids, statements } = await prepare();
      let competingState: ReturnType<typeof reservationState>;
      db.beforeBatch = () => {
        if (conflict === "second-balance") db.sqlite.prepare("UPDATE inventory_balances SET version=version+1,on_hand=on_hand+1 WHERE variant_id=?").run(ids[1]);
        if (conflict === "reservation") db.sqlite.exec("UPDATE inventory_reservations SET version=version+1,mutation_token='competing' WHERE id='res'");
        if (conflict === "order") db.sqlite.exec("UPDATE orders SET payment_status='REFUNDED' WHERE id='ord'");
        competingState = reservationState(db);
      };
      await expect(db.batch(statements)).rejects.toThrow("inventory_reservations.mutation_token");
      expect(reservationState(db)).toEqual(competingState!);
    });
  });
}
