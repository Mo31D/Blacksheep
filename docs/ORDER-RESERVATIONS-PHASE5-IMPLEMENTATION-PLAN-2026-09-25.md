# Black Sheep — Phase 5 Order Reservations Implementation Plan

**Date:** 25 September 2026  
**Status:** PLAN LOCKED — implementation must wait for Phase 4 owner UX sign-off  
**Target environment:** Staging first  
**Production:** untouched

---

## 1. Objective

Connect reviewed order revisions to the Inventory Core so tracked stock cannot be silently promised to more than one reviewed order.

The locked lifecycle remains:

`SUBMITTED → review draft → SENT reservation → ACCEPTED → PAID/COMMITTED → SHIPPED or COMPLETED/CONSUMED`

Cancellation, decline, expiry or supersede release reserved stock when appropriate.

Untracked products preserve the current order flow.

---

## 2. Migration 0011 — reservation foundation

Planned additive tables:

### inventory_reservations

One reservation group per reviewed revision.

Fields:
- immutable reservation UUID,
- order_id,
- revision_id UNIQUE,
- location_id,
- state: ACTIVE / COMMITTED / RELEASED / EXPIRED / CONSUMED,
- expires_at,
- committed_at,
- released_at,
- consumed_at,
- release_reason,
- version,
- mutation_token,
- idempotency_key,
- created_by,
- created_at,
- updated_at.

### inventory_reservation_items

Line-level relation between reviewed revision items and tracked variants.

Fields:
- id,
- reservation_id,
- revision_item_id,
- variant_id,
- quantity,
- created_at.

The item table preserves exactly which reviewed line created each hold.

---

## 3. Product resolution

Phase 5 must resolve a revision line to Product Core without changing the current public catalogue authority.

Resolution order:
1. current `catalog_product_id` → `products.legacy_catalog_id`,
2. D1 Product UUID fallback for future Admin-created products,
3. default active variant.

A line whose product cannot be resolved is treated as **untracked/current-behaviour**, not guessed.

No SKU-only fuzzy matching.

---

## 4. Reservation creation when a reviewed version is sent

The existing revision send path must become the single transaction boundary.

For every confirmed revision line:

- untracked variant → no numeric reservation,
- tracked variant → re-read live balance,
- calculate `Available = On hand - Reserved - Safety stock`,
- require Available >= confirmed quantity.

If any tracked line is insufficient:
- reject Send,
- create no token,
- create no partial reservation,
- create no partial ledger movements.

If all tracked lines pass:
1. create reservation group,
2. create reservation items,
3. increment each balance Reserved,
4. append `ORDER_RESERVATION` movement per tracked line/variant,
5. set reservation ACTIVE,
6. create/send the secure customer-review token using the same expiry.

Reservation expiry must equal the review-token effective expiry.

---

## 5. Idempotency and concurrency

Reservation creation will require:
- revision expected version,
- balance expected version for every tracked item,
- reservation idempotency key,
- unique revision reservation,
- UUID mutation token per winning balance update.

Two reviewed orders competing for the last unit must have exactly one winner.

No partial hidden reservation is allowed.

---

## 6. Revision supersede / decline / expiry

For an ACTIVE reservation:

### Decline
- ACTIVE → RELEASED,
- Reserved decreases,
- On hand unchanged,
- `RESERVATION_RELEASE` ledger movements.

### Supersede
- release old reservation before the replacement revision can reserve.

### Expiry
- ACTIVE → EXPIRED,
- Reserved decreases,
- On hand unchanged.

Expiry implementation:
- lazy release before availability-sensitive operations,
- scheduled Worker cleanup as a second safety mechanism.

---

## 7. Payment

When payment becomes PAID:

- ACTIVE → COMMITTED,
- Reserved remains unchanged,
- On hand remains unchanged.

This transition is idempotent.

Payment alone never consumes physical stock.

---

## 8. Fulfilment

### Delivery
At SHIPPED:
- On hand -= quantity,
- Reserved -= quantity,
- append SALE movement,
- COMMITTED → CONSUMED.

### Collection
At COMPLETED after handover:
- same physical consumption.

Repeated fulfilment events must not consume twice.

---

## 9. Cancellation and refunds

Unfulfilled ACTIVE reservation:
- release.

Paid COMMITTED reservation:
- do not silently release without financial state reconciliation.

Refund:
- financial only,
- no automatic stock increase.

Return to stock:
- explicit owner action,
- append RETURN movement,
- increment On hand exactly once.

---

## 10. Admin integration

Order detail should gain an Inventory section showing, per reviewed line:

- requested / confirmed quantity,
- tracked or untracked,
- On hand,
- Reserved,
- Available,
- reservation quantity,
- reservation state,
- expiry.

Before Send:
- surface insufficiency inline beside the exact line.

After Send:
- show `Reserved until <date>`.

After payment:
- show `Committed`.

After fulfilment:
- show `Consumed`.

---

## 11. Required staging tests

Before Phase 5 is allowed to close:

1. one-unit concurrency: only one of two reservation attempts succeeds,
2. replayed Send is idempotent,
3. insufficient stock creates zero reservation rows/movements,
4. untracked lines preserve existing behaviour,
5. decline releases once,
6. supersede releases old reservation before new reservation,
7. expiry releases once,
8. PAID commits without changing On hand,
9. SHIPPED consumes once for delivery,
10. COMPLETED consumes once for collection,
11. cancellation releases unfulfilled reservation,
12. refund alone changes no inventory,
13. explicit Return to stock increments once,
14. reservation expiry equals customer-review expiry,
15. Production remains pre-Product-Core.

---

## 12. Release gates

Phase 5 implementation must not start with a Production migration.

Sequence:
1. owner accepts Phase 4 Stock UX,
2. add `0011_order_reservations.sql`,
3. local migration + upgrade tests,
4. reservation domain module,
5. integrate revision Send transaction,
6. integrate decline/supersede/expiry,
7. integrate payment state,
8. integrate fulfilment,
9. Admin reservation UI,
10. controlled staging E2E,
11. only then consider Phase 5 complete.

Phase 6 storefront/checkout inventory authority remains separately locked.
