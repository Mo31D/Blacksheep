# Black Sheep — Inventory & Order Reservation Lifecycle

**Date:** 25 September 2026  
**Status:** ARCHITECTURE LOCKED  
**Scope:** Defines how product availability, reviewed orders, payment, fulfilment, cancellation and returns affect inventory.

---

## 1. Core principle

The Black Sheep flow begins as an order request, not an instant paid checkout.

Inventory therefore distinguishes:

- **On hand** — physically present.
- **Reserved** — held for an active reviewed order.
- **Available** — on hand minus reserved and safety stock.
- **Incoming** — expected but not yet physically received.

A customer submitting an order request does not permanently deduct stock.

---

## 2. Tracking modes

### Untracked

Initial migrated state for all current products until a real physical count exists.

Behaviour:
- existing selling status and price rules control orderability,
- no numeric reservation is created,
- current Commerce behaviour is preserved.

### Tracked

Enabled only after an owner-approved physical count.

Enabling tracking requires:
- location,
- counted quantity,
- INITIAL_COUNT movement,
- owner identity,
- resulting inventory balance.

After that, every quantity change is ledger-backed.

---

## 3. SUBMITTED

Customer submits an order request.

Inventory action:
- no reservation,
- no on-hand deduction,
- demand may be recorded for reporting.

Reason:
availability has not yet been reviewed and substitutions/reductions may still happen.

---

## 4. UNDER_REVIEW / draft revision

The owner reviews:
- quantities,
- substitutions,
- unavailable lines,
- fulfilment.

Admin must show live availability beside each tracked line.

Inventory action:
- no reservation while the reviewed version remains a draft.

If requested quantity exceeds current available stock, Admin warns before the quote can be sent.

---

## 5. Reviewed version sent

Trigger:
- revision becomes SENT,
- secure customer-review link becomes active.

For tracked variants the system must atomically:

1. re-check current availability,
2. create one ACTIVE reservation group for the revision,
3. create reservation items,
4. append ORDER_RESERVATION ledger movements,
5. increment reserved balances,
6. create the customer-review token.

If stock is insufficient:
- sending is rejected,
- no partial hidden reservation is created,
- owner returns to review to reduce or substitute.

Untracked variants preserve current behaviour and do not require numeric reservation.

---

## 6. Reservation expiry

Reservation expiry is aligned with the secure review expiry.

Current customer-review token default:
- **168 hours / 7 days**.

Locked rule:
- reservation expires_at equals the effective secure-review expiry,
- customer acceptance or payment after reservation expiry must not silently oversell,
- an expired reviewed version requires a fresh review/reservation.

The TTL can become configurable later, but review-link and reservation expiry must stay aligned.

---

## 7. Customer accepts

Acceptance:
- leaves reservation ACTIVE,
- does not reduce on-hand,
- confirms the reviewed version is the one intended for payment.

If the payment step follows immediately, the same reservation remains attached.

---

## 8. Payment recorded

When payment becomes PAID:

- ACTIVE reservation becomes COMMITTED,
- reserved quantity remains reserved,
- on-hand does not yet decrease.

Physical interpretation:
the item is still in the shop but is committed to this paid order and no longer available to other orders.

The transition must be idempotent.

---

## 9. PREPARING

No stock movement.

The committed reservation remains:
- included in on-hand,
- included in reserved,
- excluded from available.

This mirrors physical reality while the order is being prepared.

---

## 10. Fulfilment consumption

Recommended operational trigger:

### Delivery
When marked SHIPPED:
- append SALE movement,
- on_hand decreases by quantity,
- reserved decreases by quantity,
- reservation becomes CONSUMED.

### Collection
When marked COMPLETED after physical handover:
- append SALE movement,
- on_hand decreases,
- reserved decreases,
- reservation becomes CONSUMED.

This prevents stock disappearing before the goods physically leave the shop.

---

## 11. Decline, supersede or cancellation

Triggers:
- customer declines,
- reviewed revision is superseded,
- order is cancelled before fulfilment,
- review expires,
- owner deliberately releases an abandoned unpaid reservation.

Action:
- ACTIVE reservation → RELEASED or EXPIRED,
- append RESERVATION_RELEASE movement,
- reserved decreases,
- on-hand remains unchanged,
- available increases.

A paid COMMITTED reservation is not casually released; payment/refund state must be reconciled first.

---

## 12. Expiry processing

Use two mechanisms.

### Lazy expiry
Before availability-sensitive operations:
- detect expired ACTIVE reservations,
- release them transactionally.

### Scheduled cleanup
In the reservation implementation phase, add a scheduled Worker task that:
- releases expired reservations,
- writes ledger/audit events,
- flags affected orders in Admin.

This prevents stock remaining reserved indefinitely.

---

## 13. Revision changes after send

A sent reviewed version is immutable from an inventory perspective.

If the owner must change it:

1. supersede or revoke the old reviewed version,
2. release its reservation,
3. create/edit the new draft revision,
4. run fresh availability validation,
5. create a new reservation when the replacement revision is sent.

Never mutate reservation quantities behind a review link the customer has already received.

---

## 14. Substitutions

Before send:
- simply change the draft revision.

After send:
- supersede old reviewed version,
- release old reservation,
- create replacement revision,
- reserve the substitute atomically.

This keeps customer view, payment and stock synchronized.

---

## 15. Manual stock changes

The owner never edits a raw Available value.

Owner actions are intent-based:
- Count stock
- Received stock
- Damaged
- Lost
- Correction
- Return to stock
- Change safety stock

The server converts the intent into ledger deltas.

Every change requires:
- reason,
- actor,
- timestamp,
- resulting balance,
- optimistic concurrency check.

---

## 16. Refunds and returns

A **refund is financial**.

A refund alone creates no stock movement.

If goods physically return and are saleable:
- owner chooses Return to stock,
- append RETURN movement,
- increase on-hand.

If returned but unsaleable:
- do not increase saleable on-hand,
- record the appropriate damage/loss disposition if needed.

This prevents financial actions from corrupting physical inventory.

---

## 17. Incoming stock

Creating incoming stock:
- does not increase on-hand,
- appears in Incoming,
- can support Arriving soon messaging.

Receiving:
- owner records actual received quantity,
- incoming record updates,
- SUPPLIER_RECEIPT movement increments on-hand,
- partial receipts are supported.

Receiving an Arriving Soon product should initially prompt:

**Stock received — make available for online ordering?**

Do not silently flip selling status without an explicit rule.

---

## 18. Safety stock

Example:

- On hand: 5
- Reserved: 1
- Safety stock: 1
- Available: 3

Safety stock is not shown publicly.

Changing it is an audited inventory action.

---

## 19. Oversell protection

Reservation creation must be atomic.

Required checks:
- expected balance version,
- calculated available >= requested,
- reservation idempotency key,
- one winning mutation only.

If two requests compete for one unit:
- one succeeds,
- the other receives a conflict,
- Admin reloads the current stock state.

No last-write-wins inventory mutations.

---

## 20. Shared orderability precedence

A product/variant is not orderable when any higher-priority rule blocks it:

1. product DRAFT or ARCHIVED
2. online_ordering_enabled=false
3. sell_status=NOT_FOR_SALE
4. sell_status=ARRIVING_SOON
5. sell_status=OUT_OF_STOCK
6. inactive variant
7. missing price
8. tracked and available <= 0

If none block:
- untracked variant can be ordered under current status rules,
- tracked variant can be ordered while available > 0.

This logic must be one shared domain function used by:
- public availability,
- basket validation,
- checkout,
- Admin product search,
- revision substitute/add-product workflow.

---

## 21. Customer-facing vs owner-facing state

Customer-facing wording remains simple:
- Available
- Out of stock
- Arriving soon
- In store only

Owner Admin can show:
- On hand
- Reserved
- Available
- Incoming
- Safety stock
- Low stock

Example:

**On hand 8 · Reserved 3 · Available 5 · Incoming 12**

---

## 22. Initial migration

Because current data has no trustworthy quantities:

- all variants import untracked,
- four current OUT_OF_STOCK overrides remain,
- fourteen ARRIVING_SOON overrides remain,
- no on-hand quantity is invented,
- initial physical counts can be performed category-by-category later.

This allows gradual rollout without changing current order behaviour.

---

## 23. Required lifecycle tests before production reservations

1. concurrent reservations cannot oversell one unit,
2. replaying a reservation request is idempotent,
3. decline releases stock,
4. expiry releases stock,
5. superseded review releases old reservation before new one,
6. payment commits without reducing on-hand,
7. shipment/collection consumes exactly once,
8. cancellation releases unfulfilled reservation,
9. refund alone changes no stock,
10. explicit return-to-stock increments once,
11. partial supplier receipt updates incoming and on-hand correctly,
12. untracked products preserve current behaviour.
