import type { D1DatabaseLike } from "../src/data/d1";
import {
  transitionOrderRevision,
} from "../src/data/order-revisions";
import {
  getAdminOrderState,
  applyAdminOrderUpdate,
} from "../src/data/admin-orders";
import { validateAdminOrderAction } from "../src/domain/admin-order";
import {
  expireDueReservations,
  returnConsumedReservationToStock,
} from "../src/data/order-reservations";
import { createCustomerReviewToken } from "../src/data/customer-review";

interface Env {
  DB: D1DatabaseLike;
  QA_TOKEN: string;
}

interface VariantSeed {
  productId: string;
  variantId: string;
  legacyId: string;
  tracked: boolean;
}

interface OrderSeed {
  orderId: string;
  reference: string;
  revisionId: string;
  revisionVersion: number;
  method: "collection" | "delivery";
}

const ACTOR = "phase5-qa@staging.invalid";
const LOCATION = "loc_ambleside";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error("QA_ASSERT:" + message);
}

async function all<T>(
  db: D1DatabaseLike,
  sql: string,
  ...values: unknown[]
): Promise<T[]> {
  const statement = db.prepare(sql).bind(...values);
  if (!statement.all) throw new Error("qa_d1_all_unavailable");
  return (await statement.all<T>()).results ?? [];
}

async function first<T>(
  db: D1DatabaseLike,
  sql: string,
  ...values: unknown[]
): Promise<T | null> {
  return db.prepare(sql).bind(...values).first<T>();
}

async function run(
  db: D1DatabaseLike,
  sql: string,
  ...values: unknown[]
): Promise<void> {
  await db.prepare(sql).bind(...values).run();
}

function id(prefix: string, runId: string, suffix: string): string {
  return prefix + "_" + runId + "_" + suffix;
}

async function seedVariant(
  db: D1DatabaseLike,
  runId: string,
  suffix: string,
  onHand: number,
  tracked = true,
): Promise<VariantSeed> {
  const productId = id("qa_prd", runId, suffix);
  const variantId = id("qa_var", runId, suffix);
  const legacyId = id("QA", runId, suffix);
  const now = new Date().toISOString();

  await db.batch([
    db.prepare(
      `INSERT INTO products (
        id, legacy_catalog_id, current_slug, publication_status, sell_status,
        online_ordering_enabled, featured, current_published_version_id,
        current_draft_version_id, version, created_at, updated_at, archived_at
      ) VALUES (?, ?, ?, 'DRAFT', 'NOT_FOR_SALE', 0, 0, NULL, NULL, 1, ?, ?, NULL)`,
    ).bind(productId, legacyId, "phase5-qa-" + runId + "-" + suffix, now, now),
    db.prepare(
      `INSERT INTO product_variants (
        id, product_id, title, sku, barcode, price_minor, compare_at_price_minor,
        cost_minor, currency, track_inventory, low_stock_threshold, active,
        is_default, version, created_at, updated_at, inventory_mutation_token
      ) VALUES (?, ?, 'Default', ?, NULL, 100, NULL, NULL, 'GBP', ?, 0, 1, 1, 1, ?, ?, ?)`,
    ).bind(
      variantId,
      productId,
      "QA-" + runId + "-" + suffix,
      tracked ? 1 : 0,
      now,
      now,
      id("qa_imut", runId, suffix),
    ),
  ]);

  if (tracked) {
    await run(
      db,
      `INSERT INTO inventory_balances (
        variant_id, location_id, on_hand, reserved, safety_stock,
        version, mutation_token, updated_at
      ) VALUES (?, ?, ?, 0, 0, 1, ?, ?)`,
      variantId,
      LOCATION,
      onHand,
      id("qa_bal", runId, suffix),
      now,
    );
  }

  return { productId, variantId, legacyId, tracked };
}

async function seedOrder(
  db: D1DatabaseLike,
  runId: string,
  suffix: string,
  variant: VariantSeed,
  quantity: number,
  method: "collection" | "delivery" = "collection",
): Promise<OrderSeed> {
  const orderId = id("qa_ord", runId, suffix);
  const reference = ("QA-" + runId + "-" + suffix).toUpperCase();
  const revisionId = id("qa_rev", runId, suffix);
  const now = new Date().toISOString();
  const address =
    method === "delivery"
      ? ["1 QA Street", "Ambleside", "LA22 0QA", "GB"]
      : [null, null, null, null];

  await run(
    db,
    `INSERT INTO orders (
      id, public_reference, idempotency_key, status, currency,
      fulfilment_method, customer_name, customer_email, customer_phone,
      delivery_address_line1, delivery_address_line2, delivery_town,
      delivery_county, delivery_postcode, delivery_country, customer_note,
      items_subtotal_minor, delivery_amount_minor, final_total_minor,
      payment_status, payment_provider, payment_reference, payment_request_url,
      tracking_reference, tracking_url, created_at, updated_at,
      quoted_at, paid_at, shipped_at, completed_at, cancelled_at,
      fulfilment_message
    ) VALUES (
      ?, ?, ?, 'UNDER_REVIEW', 'GBP',
      ?, '[PHASE5 QA] Synthetic order', 'phase5-qa@invalid.test', NULL,
      ?, NULL, ?, NULL, ?, ?, NULL,
      ?, 0, ?, 'UNPAID', NULL, NULL, NULL,
      NULL, NULL, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL
    )`,
    orderId,
    reference,
    id("qa_order_idem", runId, suffix),
    method,
    address[0],
    address[1],
    address[2],
    address[3],
    100 * quantity,
    100 * quantity,
    now,
    now,
  );

  await run(
    db,
    `INSERT INTO order_items (
      order_id, line_number, catalog_product_id, sku, slug, product_name,
      unit_price_minor, quantity, line_total_minor, options_json, created_at
    ) VALUES (?, 1, ?, ?, ?, '[PHASE5 QA] Product', 100, ?, ?, '{}', ?)`,
    orderId,
    variant.legacyId,
    "QA-" + runId + "-" + suffix,
    "phase5-qa-" + runId + "-" + suffix,
    quantity,
    100 * quantity,
    now,
  );

  const original = await first<{ id: number }>(
    db,
    "SELECT id FROM order_items WHERE order_id = ? AND line_number = 1",
    orderId,
  );
  assert(original, "seed order item missing");

  await run(
    db,
    `INSERT INTO order_revisions (
      id, order_id, revision_number, state, version, currency,
      items_subtotal_minor, delivery_amount_minor, adjustment_amount_minor,
      final_total_minor, customer_message, internal_note, created_by,
      created_at, sent_at, accepted_at, declined_at, superseded_at, expires_at,
      fulfilment_method, delivery_address_line1, delivery_address_line2,
      delivery_town, delivery_county, delivery_postcode, delivery_country,
      mutation_token
    ) VALUES (
      ?, ?, 1, 'DRAFT', 1, 'GBP',
      ?, 0, 0, ?, NULL, 'Phase 5 QA', ?, ?,
      NULL, NULL, NULL, NULL, NULL,
      ?, ?, NULL, ?, NULL, ?, ?, ?
    )`,
    revisionId,
    orderId,
    100 * quantity,
    100 * quantity,
    ACTOR,
    now,
    method,
    address[0],
    address[1],
    address[2],
    address[3],
    id("qa_rev_mut", runId, suffix),
  );

  await run(
    db,
    `INSERT INTO order_revision_items (
      revision_id, line_number, source_order_item_id, catalog_product_id,
      sku, slug, product_name, unit_price_minor, requested_quantity,
      confirmed_quantity, availability_status, reason_code, customer_note,
      internal_note, line_total_minor, created_at, updated_at
    ) VALUES (
      ?, 1, ?, ?, ?, ?, '[PHASE5 QA] Product',
      100, ?, ?, 'CONFIRMED', NULL, NULL, NULL, ?, ?, ?
    )`,
    revisionId,
    original.id,
    variant.legacyId,
    "QA-" + runId + "-" + suffix,
    "phase5-qa-" + runId + "-" + suffix,
    quantity,
    quantity,
    100 * quantity,
    now,
    now,
  );

  return {
    orderId,
    reference,
    revisionId,
    revisionVersion: 1,
    method,
  };
}

async function seedSecondDraftRevision(
  db: D1DatabaseLike,
  runId: string,
  order: OrderSeed,
  variant: VariantSeed,
  quantity: number,
): Promise<string> {
  const revisionId = id("qa_rev2", runId, order.reference.replace(/[^A-Z0-9]/g, "").slice(-10));
  const now = new Date().toISOString();
  const original = await first<{ id: number }>(
    db,
    "SELECT id FROM order_items WHERE order_id = ? AND line_number = 1",
    order.orderId,
  );
  assert(original, "second revision source item missing");

  await run(
    db,
    `INSERT INTO order_revisions (
      id, order_id, revision_number, state, version, currency,
      items_subtotal_minor, delivery_amount_minor, adjustment_amount_minor,
      final_total_minor, customer_message, internal_note, created_by,
      created_at, fulfilment_method, mutation_token
    ) VALUES (?, ?, 2, 'DRAFT', 1, 'GBP', ?, 0, 0, ?, NULL, 'Phase 5 QA supersede', ?, ?, ?, ?)`,
    revisionId,
    order.orderId,
    100 * quantity,
    100 * quantity,
    ACTOR,
    now,
    order.method,
    id("qa_rev2_mut", runId, revisionId.slice(-8)),
  );

  await run(
    db,
    `INSERT INTO order_revision_items (
      revision_id, line_number, source_order_item_id, catalog_product_id,
      sku, slug, product_name, unit_price_minor, requested_quantity,
      confirmed_quantity, availability_status, reason_code, customer_note,
      internal_note, line_total_minor, created_at, updated_at
    ) VALUES (?, 1, ?, ?, ?, ?, '[PHASE5 QA] Product', 100, ?, ?, 'CONFIRMED', NULL, NULL, NULL, ?, ?, ?)`,
    revisionId,
    original.id,
    variant.legacyId,
    "QA-" + runId + "-supersede",
    "phase5-qa-" + runId + "-supersede",
    quantity,
    quantity,
    100 * quantity,
    now,
    now,
  );

  return revisionId;
}

async function orderAction(
  db: D1DatabaseLike,
  reference: string,
  raw: Record<string, unknown>,
): Promise<void> {
  const state = await getAdminOrderState(db, reference);
  assert(state, "order state missing for " + reference);
  const action = validateAdminOrderAction(state, raw);
  await applyAdminOrderUpdate(db, state, action, ACTOR, {
    inventoryReservations: true,
  });
}

async function reservationState(
  db: D1DatabaseLike,
  revisionId: string,
): Promise<{
  id: string;
  state: string;
  expiresAt: string;
  returnedAt: string | null;
} | null> {
  return first(
    db,
    `SELECT
      id,
      state,
      expires_at AS expiresAt,
      returned_at AS returnedAt
    FROM inventory_reservations
    WHERE revision_id = ?
    LIMIT 1`,
    revisionId,
  );
}

async function balance(
  db: D1DatabaseLike,
  variantId: string,
): Promise<{ onHand: number; reserved: number; version: number }> {
  const row = await first<{ onHand: number; reserved: number; version: number }>(
    db,
    `SELECT on_hand AS onHand, reserved, version
    FROM inventory_balances
    WHERE variant_id = ? AND location_id = ?`,
    variantId,
    LOCATION,
  );
  assert(row, "balance missing for " + variantId);
  return row;
}

async function movementCount(
  db: D1DatabaseLike,
  reservationId: string,
  type: string,
): Promise<number> {
  const row = await first<{ count: number }>(
    db,
    `SELECT COUNT(*) AS count
    FROM inventory_movements
    WHERE reservation_id = ? AND movement_type = ?`,
    reservationId,
    type,
  );
  return Number(row?.count ?? 0);
}

async function runProof(db: D1DatabaseLike): Promise<Record<string, unknown>> {
  const runId = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  const createdVariants: string[] = [];
  const createdProducts: string[] = [];
  const createdOrders: string[] = [];
  const evidence: Record<string, unknown> = { runId };

  const track = (variant: VariantSeed, order?: OrderSeed) => {
    createdVariants.push(variant.variantId);
    createdProducts.push(variant.productId);
    if (order) createdOrders.push(order.orderId);
  };

  // 1,2,8,10,12,13,14: full collection lifecycle + replay + token expiry + refund + return.
  const lifeVariant = await seedVariant(db, runId, "life", 2, true);
  const lifeOrder = await seedOrder(db, runId, "life", lifeVariant, 1, "collection");
  track(lifeVariant, lifeOrder);

  const sent = await transitionOrderRevision(
    db,
    lifeOrder.reference,
    lifeOrder.revisionId,
    "send",
    1,
    ACTOR,
    { inventoryReservations: true, reservationTtlHours: 168 },
  );
  assert(sent.state === "SENT", "lifecycle send failed");
  const lifeReservation = await reservationState(db, lifeOrder.revisionId);
  assert(lifeReservation?.state === "ACTIVE", "reservation not ACTIVE after Send");
  let lifeBalance = await balance(db, lifeVariant.variantId);
  assert(lifeBalance.onHand === 2 && lifeBalance.reserved === 1, "Send did not reserve exactly one");

  const replay = await transitionOrderRevision(
    db,
    lifeOrder.reference,
    lifeOrder.revisionId,
    "send",
    1,
    ACTOR,
    { inventoryReservations: true, reservationTtlHours: 168 },
  );
  assert(replay.idempotentReplay === true, "replayed Send was not idempotent");
  assert(
    (await movementCount(db, lifeReservation.id, "ORDER_RESERVATION")) === 1,
    "replayed Send duplicated reservation movement",
  );

  const review = await createCustomerReviewToken(db, lifeOrder.reference, 168);
  assert(
    review.expiresAt === lifeReservation.expiresAt,
    "review token expiry differs from reservation expiry",
  );

  const accepted = await transitionOrderRevision(
    db,
    lifeOrder.reference,
    lifeOrder.revisionId,
    "accept",
    2,
    ACTOR,
    { inventoryReservations: true },
  );
  assert(accepted.state === "ACCEPTED", "revision accept failed");

  await orderAction(db, lifeOrder.reference, {
    action: "send_payment_request",
    paymentRequestUrl: "https://example.invalid/pay/qa",
    fulfilmentMessage: "QA collection",
  });
  await orderAction(db, lifeOrder.reference, {
    action: "mark_paid",
    paymentReference: "QA-PAID",
  });
  assert(
    (await reservationState(db, lifeOrder.revisionId))?.state === "COMMITTED",
    "PAID did not COMMIT reservation",
  );
  lifeBalance = await balance(db, lifeVariant.variantId);
  assert(lifeBalance.onHand === 2 && lifeBalance.reserved === 1, "PAID changed physical quantity");

  await orderAction(db, lifeOrder.reference, { action: "start_preparing" });
  await orderAction(db, lifeOrder.reference, { action: "ready_for_collection" });
  lifeBalance = await balance(db, lifeVariant.variantId);
  assert(lifeBalance.onHand === 2 && lifeBalance.reserved === 1, "Ready for collection consumed too early");

  await orderAction(db, lifeOrder.reference, { action: "complete" });
  assert(
    (await reservationState(db, lifeOrder.revisionId))?.state === "CONSUMED",
    "collection Complete did not consume reservation",
  );
  lifeBalance = await balance(db, lifeVariant.variantId);
  assert(lifeBalance.onHand === 1 && lifeBalance.reserved === 0, "collection consumption balance wrong");
  assert(
    (await movementCount(db, lifeReservation.id, "SALE")) === 1,
    "collection SALE movement count wrong",
  );

  const beforeRefund = { ...lifeBalance };
  await orderAction(db, lifeOrder.reference, {
    action: "record_refund",
    note: "Phase 5 QA refund",
  });
  lifeBalance = await balance(db, lifeVariant.variantId);
  assert(
    lifeBalance.onHand === beforeRefund.onHand &&
      lifeBalance.reserved === beforeRefund.reserved,
    "refund alone changed inventory",
  );

  const returned = await returnConsumedReservationToStock(
    db,
    lifeOrder.reference,
    ACTOR,
  );
  assert(returned.idempotentReplay === false, "first return unexpectedly replayed");
  lifeBalance = await balance(db, lifeVariant.variantId);
  assert(lifeBalance.onHand === 2 && lifeBalance.reserved === 0, "return did not restore On hand");
  assert(
    (await movementCount(db, lifeReservation.id, "RETURN")) === 1,
    "RETURN movement count wrong",
  );
  const returnReplay = await returnConsumedReservationToStock(
    db,
    lifeOrder.reference,
    ACTOR,
  );
  assert(returnReplay.idempotentReplay === true, "return replay not idempotent");
  assert(
    (await movementCount(db, lifeReservation.id, "RETURN")) === 1,
    "return replay duplicated movement",
  );
  evidence.collectionLifecycle = "PASS";

  // 9: delivery consumes at SHIPPED and not again at Complete.
  const shipVariant = await seedVariant(db, runId, "ship", 2, true);
  const shipOrder = await seedOrder(db, runId, "ship", shipVariant, 1, "delivery");
  track(shipVariant, shipOrder);
  await transitionOrderRevision(db, shipOrder.reference, shipOrder.revisionId, "send", 1, ACTOR, { inventoryReservations: true });
  await orderAction(db, shipOrder.reference, {
    action: "send_payment_request",
    paymentRequestUrl: "https://example.invalid/pay/ship",
    fulfilmentMessage: "QA delivery",
  });
  await orderAction(db, shipOrder.reference, { action: "mark_paid" });
  await orderAction(db, shipOrder.reference, { action: "start_preparing" });
  await orderAction(db, shipOrder.reference, {
    action: "mark_shipped",
    trackingReference: "QA-TRACK",
  });
  const shipReservation = await reservationState(db, shipOrder.revisionId);
  assert(shipReservation?.state === "CONSUMED", "SHIPPED did not consume reservation");
  let shipBalance = await balance(db, shipVariant.variantId);
  assert(shipBalance.onHand === 1 && shipBalance.reserved === 0, "delivery consumption balance wrong");
  assert((await movementCount(db, shipReservation.id, "SALE")) === 1, "delivery SALE movement wrong");
  await orderAction(db, shipOrder.reference, { action: "complete" });
  shipBalance = await balance(db, shipVariant.variantId);
  assert(shipBalance.onHand === 1 && shipBalance.reserved === 0, "delivery Complete consumed twice");
  assert((await movementCount(db, shipReservation.id, "SALE")) === 1, "delivery Complete duplicated SALE");
  evidence.deliveryLifecycle = "PASS";

  // 3: insufficient tracked stock leaves no reservation/movement.
  const lowVariant = await seedVariant(db, runId, "low", 1, true);
  const lowOrder = await seedOrder(db, runId, "low", lowVariant, 2, "collection");
  track(lowVariant, lowOrder);
  let insufficient = false;
  try {
    await transitionOrderRevision(db, lowOrder.reference, lowOrder.revisionId, "send", 1, ACTOR, { inventoryReservations: true });
  } catch (error) {
    insufficient = String(error).includes("reservation_insufficient_stock");
  }
  assert(insufficient, "insufficient Send did not fail correctly");
  assert(!(await reservationState(db, lowOrder.revisionId)), "insufficient Send created reservation");
  const lowMovements = await first<{ count: number }>(
    db,
    "SELECT COUNT(*) AS count FROM inventory_movements WHERE order_id = ?",
    lowOrder.orderId,
  );
  assert(Number(lowMovements?.count ?? 0) === 0, "insufficient Send created movements");
  evidence.insufficientStock = "PASS";

  // 4: untracked lines preserve flow without numeric inventory mutation.
  const untrackedVariant = await seedVariant(db, runId, "untracked", 0, false);
  const untrackedOrder = await seedOrder(db, runId, "untracked", untrackedVariant, 1, "collection");
  track(untrackedVariant, untrackedOrder);
  await transitionOrderRevision(db, untrackedOrder.reference, untrackedOrder.revisionId, "send", 1, ACTOR, { inventoryReservations: true });
  const untrackedReservation = await reservationState(db, untrackedOrder.revisionId);
  assert(untrackedReservation?.state === "ACTIVE", "untracked order did not finalize normally");
  assert((await movementCount(db, untrackedReservation.id, "ORDER_RESERVATION")) === 0, "untracked order created numeric hold");
  evidence.untrackedCompatibility = "PASS";

  // 5: decline releases exactly once.
  const declineVariant = await seedVariant(db, runId, "decline", 2, true);
  const declineOrder = await seedOrder(db, runId, "decline", declineVariant, 1, "collection");
  track(declineVariant, declineOrder);
  await transitionOrderRevision(db, declineOrder.reference, declineOrder.revisionId, "send", 1, ACTOR, { inventoryReservations: true });
  const declineReservation = await reservationState(db, declineOrder.revisionId);
  assert(declineReservation, "decline reservation missing");
  await transitionOrderRevision(db, declineOrder.reference, declineOrder.revisionId, "decline", 2, ACTOR, { inventoryReservations: true });
  assert((await reservationState(db, declineOrder.revisionId))?.state === "RELEASED", "decline did not release");
  assert((await movementCount(db, declineReservation.id, "RESERVATION_RELEASE")) === 1, "decline release movement wrong");
  const declineBalance = await balance(db, declineVariant.variantId);
  assert(declineBalance.onHand === 2 && declineBalance.reserved === 0, "decline balance wrong");
  evidence.declineRelease = "PASS";

  // 6: supersede releases old before replacement reservation.
  const supersedeVariant = await seedVariant(db, runId, "supersede", 2, true);
  const supersedeOrder = await seedOrder(db, runId, "supersede", supersedeVariant, 1, "collection");
  track(supersedeVariant, supersedeOrder);
  await transitionOrderRevision(db, supersedeOrder.reference, supersedeOrder.revisionId, "send", 1, ACTOR, { inventoryReservations: true });
  const oldReservation = await reservationState(db, supersedeOrder.revisionId);
  assert(oldReservation, "old supersede reservation missing");
  const replacementRevisionId = await seedSecondDraftRevision(db, runId, supersedeOrder, supersedeVariant, 1);
  await transitionOrderRevision(db, supersedeOrder.reference, replacementRevisionId, "send", 1, ACTOR, { inventoryReservations: true });
  assert((await reservationState(db, supersedeOrder.revisionId))?.state === "RELEASED", "old superseded reservation not released");
  const replacementReservation = await reservationState(db, replacementRevisionId);
  assert(replacementReservation?.state === "ACTIVE", "replacement reservation not active");
  const supersedeBalance = await balance(db, supersedeVariant.variantId);
  assert(supersedeBalance.reserved === 1, "supersede left wrong reserved quantity");
  assert((await movementCount(db, oldReservation.id, "RESERVATION_RELEASE")) === 1, "supersede release movement wrong");
  evidence.supersede = "PASS";

  // 7: expiry releases once.
  const expiryVariant = await seedVariant(db, runId, "expiry", 2, true);
  const expiryOrder = await seedOrder(db, runId, "expiry", expiryVariant, 1, "collection");
  track(expiryVariant, expiryOrder);
  await transitionOrderRevision(db, expiryOrder.reference, expiryOrder.revisionId, "send", 1, ACTOR, { inventoryReservations: true, reservationTtlHours: 1 });
  const expiryReservation = await reservationState(db, expiryOrder.revisionId);
  assert(expiryReservation, "expiry reservation missing");
  const past = new Date(Date.now() - 60_000).toISOString();
  await run(db, "UPDATE inventory_reservations SET expires_at = ? WHERE id = ?", past, expiryReservation.id);
  await run(db, "UPDATE order_revisions SET expires_at = ? WHERE id = ?", past, expiryOrder.revisionId);
  const expiryRun1 = await expireDueReservations(db, { now: new Date().toISOString() });
  assert(expiryRun1.expired >= 1, "expiry worker did not expire reservation");
  assert((await reservationState(db, expiryOrder.revisionId))?.state === "EXPIRED", "reservation not EXPIRED");
  assert((await movementCount(db, expiryReservation.id, "RESERVATION_RELEASE")) === 1, "expiry release movement wrong");
  const expiryRun2 = await expireDueReservations(db, { now: new Date().toISOString() });
  assert((await movementCount(db, expiryReservation.id, "RESERVATION_RELEASE")) === 1, "expiry repeated release");
  evidence.expiry = { first: expiryRun1, second: expiryRun2 };

  // 11: cancellation releases an unfulfilled ACTIVE hold.
  const cancelVariant = await seedVariant(db, runId, "cancel", 2, true);
  const cancelOrder = await seedOrder(db, runId, "cancel", cancelVariant, 1, "collection");
  track(cancelVariant, cancelOrder);
  await transitionOrderRevision(db, cancelOrder.reference, cancelOrder.revisionId, "send", 1, ACTOR, { inventoryReservations: true });
  const cancelReservation = await reservationState(db, cancelOrder.revisionId);
  assert(cancelReservation, "cancel reservation missing");
  await orderAction(db, cancelOrder.reference, { action: "cancel", note: "Phase 5 QA cancellation" });
  assert((await reservationState(db, cancelOrder.revisionId))?.state === "RELEASED", "cancel did not release");
  assert((await movementCount(db, cancelReservation.id, "RESERVATION_RELEASE")) === 1, "cancel release movement wrong");
  evidence.cancellation = "PASS";

  // 1: one-unit / two-orders concurrency — exactly one winner.
  const raceVariant = await seedVariant(db, runId, "race", 1, true);
  const raceA = await seedOrder(db, runId, "racea", raceVariant, 1, "collection");
  const raceB = await seedOrder(db, runId, "raceb", raceVariant, 1, "collection");
  createdVariants.push(raceVariant.variantId);
  createdProducts.push(raceVariant.productId);
  createdOrders.push(raceA.orderId, raceB.orderId);

  const race = await Promise.allSettled([
    transitionOrderRevision(db, raceA.reference, raceA.revisionId, "send", 1, ACTOR, { inventoryReservations: true }),
    transitionOrderRevision(db, raceB.reference, raceB.revisionId, "send", 1, ACTOR, { inventoryReservations: true }),
  ]);
  const winners = race.filter((result) => result.status === "fulfilled").length;
  assert(winners === 1, "one-unit concurrency produced " + winners + " winners");
  const raceBalance = await balance(db, raceVariant.variantId);
  assert(raceBalance.onHand === 1 && raceBalance.reserved === 1, "race balance is not exactly one reserved");
  const raceReservations = await all<{ id: string; revisionId: string; state: string }>(
    db,
    `SELECT id, revision_id AS revisionId, state
    FROM inventory_reservations
    WHERE order_id IN (?, ?)`,
    raceA.orderId,
    raceB.orderId,
  );
  const raceActive = raceReservations.filter((r) => r.state === "ACTIVE");
  assert(raceActive.length === 1, "race did not leave exactly one ACTIVE reservation");
  assert((await movementCount(db, raceActive[0].id, "ORDER_RESERVATION")) === 1, "race winner movement count wrong");
  evidence.concurrency = {
    winners,
    outcomes: race.map((result) =>
      result.status === "fulfilled"
        ? "fulfilled"
        : String(result.reason),
    ),
  };

  // Release lingering ACTIVE QA reservations so scheduled cleanup never hits missing balances.
  for (const candidate of [
    { order: untrackedOrder, revisionId: untrackedOrder.revisionId },
    { order: supersedeOrder, revisionId: replacementRevisionId },
  ]) {
    const current = await reservationState(db, candidate.revisionId);
    if (current?.state === "ACTIVE") {
      const revision = await first<{ version: number; state: string }>(
        db,
        "SELECT version, state FROM order_revisions WHERE id = ?",
        candidate.revisionId,
      );
      if (revision?.state === "SENT") {
        await transitionOrderRevision(
          db,
          candidate.order.reference,
          candidate.revisionId,
          "decline",
          revision.version,
          ACTOR,
          { inventoryReservations: true },
        );
      }
    }
  }

  for (const raceOrder of [raceA, raceB]) {
    const current = await reservationState(db, raceOrder.revisionId);
    if (current?.state === "ACTIVE") {
      const revision = await first<{ version: number; state: string }>(
        db,
        "SELECT version, state FROM order_revisions WHERE id = ?",
        raceOrder.revisionId,
      );
      if (revision?.state === "SENT") {
        await transitionOrderRevision(
          db,
          raceOrder.reference,
          raceOrder.revisionId,
          "decline",
          revision.version,
          ACTOR,
          { inventoryReservations: true },
        );
      }
    }
  }

  // QA cleanup: preserve immutable evidence but remove live stock authority.
  const cleanupAt = new Date().toISOString();
  for (const variantId of [...new Set(createdVariants)]) {
    await run(
      db,
      "UPDATE product_variants SET track_inventory = 0, active = 0, updated_at = ? WHERE id = ?",
      cleanupAt,
      variantId,
    );
    await run(
      db,
      "DELETE FROM inventory_balances WHERE variant_id = ? AND location_id = ?",
      variantId,
      LOCATION,
    );
  }
  for (const productId of [...new Set(createdProducts)]) {
    await run(
      db,
      "UPDATE products SET publication_status = 'ARCHIVED', sell_status = 'NOT_FOR_SALE', online_ordering_enabled = 0, archived_at = ?, updated_at = ? WHERE id = ?",
      cleanupAt,
      cleanupAt,
      productId,
    );
  }

  const activeQa = await first<{ count: number }>(
    db,
    `SELECT COUNT(*) AS count
    FROM inventory_reservations r
    INNER JOIN orders o ON o.id = r.order_id
    WHERE o.id LIKE ? AND r.state IN ('ACTIVE','COMMITTED')`,
    "qa_ord_" + runId + "_%",
  );
  assert(Number(activeQa?.count ?? -1) === 0, "cleanup left ACTIVE/COMMITTED QA reservations");

  const liveQaBalances = await first<{ count: number }>(
    db,
    "SELECT COUNT(*) AS count FROM inventory_balances WHERE variant_id LIKE ?",
    "qa_var_" + runId + "_%",
  );
  assert(Number(liveQaBalances?.count ?? -1) === 0, "cleanup left QA balances");

  evidence.cleanup = {
    activeOrCommittedReservations: Number(activeQa?.count ?? -1),
    liveBalances: Number(liveQaBalances?.count ?? -1),
    immutableEvidenceRetained: true,
  };

  return evidence;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (
      request.method !== "POST" ||
      request.headers.get("x-phase5-qa-token") !== env.QA_TOKEN
    ) {
      return json({ error: "forbidden" }, 403);
    }

    try {
      const result = await runProof(env.DB);
      return json({ ok: true, result });
    } catch (error) {
      return json(
        {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : null,
        },
        500,
      );
    }
  },
};
