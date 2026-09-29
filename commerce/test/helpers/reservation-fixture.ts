import { SqliteD1 } from "./sqlite-d1";
import { createAdminProduct } from "../../src/data/product-editor";
import { initialInventoryCount } from "../../src/data/inventory";

export const reservationActor = "owner@example.test";
export const fixtureTime = "2026-09-29T10:00:00.000Z";
// Historical order/reservation rows are seeded only in an in-memory all-migrations DB.
export async function reservationFixture(db: SqliteD1, state: "ACTIVE" | "COMMITTED" | "CONSUMED", tracked = true) {
  db.sqlite.prepare(
    "INSERT INTO orders (id,public_reference,idempotency_key,status,fulfilment_method,customer_name,customer_email,items_subtotal_minor,payment_status,created_at,updated_at) VALUES ('ord','RES-TEST','order-key','PAID','collection','Test','customer@example.test',400,'PAID',?,?)"
  ).run(fixtureTime, fixtureTime);
  db.sqlite.prepare(
    "INSERT INTO order_revisions (id,order_id,revision_number,state,version,items_subtotal_minor,created_by,created_at,expires_at,mutation_token) VALUES ('rev','ord',1,'ACCEPTED',1,400,?,?,'2026-10-01T00:00:00.000Z','revision-token')"
  ).run(reservationActor, fixtureTime);
  db.sqlite.prepare(
    "INSERT INTO inventory_reservations (id,order_id,revision_id,location_id,state,expires_at,version,mutation_token,idempotency_key,created_by,created_at,updated_at,consumed_at) VALUES ('res','ord','rev','loc_ambleside',?,'2026-10-01T00:00:00.000Z',1,'reservation-token','reservation-key',?,?,?,?)"
  ).run(state, reservationActor, fixtureTime, fixtureTime, state === "CONSUMED" ? fixtureTime : null);
  const variants: string[] = [];
  for (let i = 0; i < 2; i++) {
    const product = await createAdminProduct(db, { title: "Reservation fixture " + i }, reservationActor);
    const id = String(db.sqlite.prepare("SELECT id FROM product_variants WHERE product_id=?").get(product.id)?.id);
    variants.push(id);
    const line = db.sqlite.prepare(
      "INSERT INTO order_revision_items (revision_id,line_number,catalog_product_id,slug,product_name,unit_price_minor,requested_quantity,confirmed_quantity,availability_status,line_total_minor,created_at,updated_at) VALUES ('rev',?,?,?,'Fixture',100,2,2,'CONFIRMED',200,?,?)"
    ).run(i + 1, product.id, "fixture-" + i, fixtureTime, fixtureTime);
    if (!tracked) continue;
    await initialInventoryCount(db, { variantId: id, quantity: 10, reason: "Fixture", idempotencyKey: "seed:" + id }, reservationActor);
    db.sqlite.prepare("UPDATE inventory_balances SET on_hand=?,reserved=? WHERE variant_id=?").run(state === "CONSUMED" ? 8 : 10, state === "CONSUMED" ? 0 : 2, id);
    db.sqlite.prepare("INSERT INTO inventory_reservation_items (id,reservation_id,revision_item_id,variant_id,quantity,created_at) VALUES (?,'res',?,?,2,?)").run("item-" + i, line.lastInsertRowid, id, fixtureTime);
  }
  return variants.sort();
}

export function reservationState(db: SqliteD1) {
  return Object.fromEntries(["orders", "order_revisions", "inventory_reservations", "inventory_balances", "inventory_movements", "order_events"].map(table => [table, db.sqlite.prepare("SELECT * FROM " + table + " ORDER BY rowid").all()]));
}
