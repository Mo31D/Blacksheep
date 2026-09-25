# Black Sheep — Phase 4 Inventory Core Staging Release

**Date:** 25 September 2026  
**Repository:** `Mo31D/Blacksheep`  
**Branch:** `main`  
**Environment:** Staging only  
**Status:** **TECHNICALLY COMPLETE — owner stock mutation QA pending**  
**Production inventory cutover:** **NOT PERFORMED**

---

## 1. Release result

Phase 4 introduces the first real physical-inventory core behind the premium Black Sheep Admin.

The release is intentionally isolated from Production and from the public storefront/checkout.

Final release evidence:

- Phase 4 source/contract CI: `36182963561` — **SUCCESS**
- Initial Inventory Core staging release: `36183361766`
- Initial release job: `108230788251` — **SUCCESS**
- Product ↔ Stock polish CI: `36183681792` — **SUCCESS**
- Final staging release: `36183967251`
- Final release job: `108232778002` — **SUCCESS**
- Current staging deployment: `30023133-b0b6-41b3-bbfe-66db86748fb0`
- Current staging Worker version: `b087f7b4-6cb7-4d80-bb62-06cac1ae2dbf`
- Worker version number: **70**

All release gates passed:
- full Commerce validation,
- migration upgrade tests,
- Inventory Core ledger tests,
- pre-migration Product Core baseline capture,
- staging-only migration application,
- no-inferred-stock gate,
- ledger integrity gate,
- Production isolation gate,
- staging Worker deployment,
- Worker health,
- Admin sign-in shell.

---

## 2. Migration `0010_inventory_core.sql`

Staging D1 now ends at:

`0010_inventory_core.sql`

The migration is additive and forward-only.

It adds:

### `product_variants.inventory_mutation_token`

Used as a UUID mutation guard for stock-tracking activation.

### `inventory_balances`

Per Variant + Location:

- `variant_id`
- `location_id`
- `on_hand`
- `reserved`
- `safety_stock`
- optimistic `version`
- UUID `mutation_token`
- `updated_at`

Operational Available is derived:

`max(0, on_hand - reserved - safety_stock)`

Available is not an owner-editable independent quantity.

### `inventory_movements`

Append-only physical stock ledger.

Supported movement types include:

- `INITIAL_COUNT`
- `MANUAL_ADJUSTMENT`
- `ORDER_RESERVATION`
- `RESERVATION_RELEASE`
- `SALE`
- `RETURN`
- `DAMAGE`
- `LOSS`
- `SUPPLIER_RECEIPT`
- `SAFETY_STOCK_CHANGE`
- `CORRECTION`

Every row records:
- Variant + Location,
- signed On-hand / Reserved / Safety deltas,
- controlled reason code,
- optional note,
- related-order/reservation/incoming references for later phases,
- batch ID,
- idempotency key,
- actor,
- timestamp,
- resulting balance snapshot.

Database triggers reject UPDATE and DELETE against this ledger.

### `inventory_incoming`

Foundation for expected stock:

- Manual / Purchase Order / Transfer source,
- expected quantity,
- received quantity,
- expected date,
- Open / Partial / Received / Cancelled state.

Supplier purchasing/receiving workflows remain Phase 7.

---

## 3. No stock was inferred

A key migration requirement was that current catalogue state must never be converted into a guessed stock count.

Direct Cloudflare verification after the final Phase 4 release:

| Check | Result |
|---|---:|
| Product rows | 147 |
| Original imported products | 146 |
| Inventory-tracked variants | **0** |
| Inventory balances | **0** |
| Inventory movements | **0** |
| Incoming records | **0** |
| Tracked variants without a balance | **0** |
| Invalid/negative balances | **0** |
| Immutable ledger triggers | **2** |
| Key ledger uniqueness indexes | **2** |

The 147th Product row is the prior owner-created `STAGING QA PRODUCT`; the frozen imported baseline remains exactly 146.

Every existing variant remains untracked until an owner performs an explicit **Initial Count**.

---

## 4. Initial Count

Inventory tracking cannot be switched on by a generic toggle.

The first stock state must be created through:

`POST /admin/api/inventory/initial-count`

Initial Count:

1. validates the active location,
2. requires a real physical quantity,
3. requires a reason,
4. requires an idempotency key,
5. verifies the Variant is currently untracked,
6. atomically enables `track_inventory`,
7. creates the first balance,
8. creates the first immutable `INITIAL_COUNT` movement.

A unique partial index enforces only one Initial Count per Variant + Location.

---

## 5. Concurrency and idempotency

Inventory has stricter concurrency controls than ordinary descriptive content.

### Balance version

Every balance has an optimistic version.

A stale adjustment/count cannot overwrite a newer physical quantity.

### UUID mutation token

Phase 4 adds a unique mutation token to the winning Variant/Balance mutation.

The ledger movement is inserted only when it observes the exact mutation token that won.

This avoids relying on timestamps as a concurrency lock.

### Idempotency

Each stock operation carries an idempotency key.

Repeated delivery of the same logical request can be safely replayed.

Reusing a key for a different logical stock operation is rejected.

### Automated integration test

`commerce/scripts/test-inventory-core.mjs` verifies:

- movement UPDATE is rejected,
- movement DELETE is rejected,
- second Initial Count is rejected,
- duplicate idempotency key is rejected,
- one balance-version update wins,
- a stale version cannot overwrite it,
- the winning mutation token remains authoritative.

This test is part of the normal `npm run check` gate.

---

## 6. Quick stock adjustment

Authenticated API:

`POST /admin/api/inventory/adjustments`

Owner enters a signed quantity delta, not a replacement Available value.

Controlled reasons currently include:

- Restock
- Count correction
- Damage
- Loss
- Return
- Found
- Other

Safety rules include:
- Damage/Loss require a negative change,
- Return/Restock/Found require a positive change,
- On hand cannot become negative,
- stale balance versions are rejected,
- every change creates a movement.

---

## 7. Physical Count

Authenticated API:

`POST /admin/api/inventory/count`

The owner enters what is physically present.

The server:
- reads current On hand,
- computes the difference,
- updates the balance under optimistic concurrency,
- records the correction as a new immutable `CORRECTION` movement.

The ledger is therefore preserved instead of rewriting past quantities.

---

## 8. Premium Stock workspace

Admin navigation is now:

**Today → Orders → Products → Stock → Reports**

The Stock board includes:

### Summary
- Products
- Tracked
- Untracked
- Low
- Out
- Incoming

### Filters
- All
- Tracked
- Untracked
- Low stock
- Out
- Incoming

### Search
Searches product title, SKU, barcode and legacy code.

### Product stock row
Shows:
- product image,
- title,
- SKU,
- tracking state,
- On hand,
- Available,
- Healthy / Low / Out / Incoming / Untracked status.

### Stock detail
For a tracked Variant:
- On hand
- Reserved
- Available
- Incoming
- Low-stock threshold
- immutable Inventory history
- Adjust stock
- Physical count
- threshold editing
- Product deep-link.

For an untracked Variant:
- explicit **Start Initial Count** action.

No stock number is shown as factual before tracking begins.

---

## 9. Product ↔ Stock integration

Product Admin now consumes the Inventory Core projection.

Product rows can distinguish:
- Untracked
- Low stock
- Stock out
- Available

Product detail shows real Inventory Core values:

- On hand
- Reserved
- Available
- Incoming
- low-stock threshold

A **Stock** button moves directly from the Product to the matching Stock row.

Stock detail already includes **Open product**, so navigation is bidirectional.

---

## 10. Low-stock threshold

The existing operational Variant field is now exposed from Stock.

Low state is derived only when:

- inventory is tracked,
- a threshold is configured,
- Available is greater than zero,
- Available is less than or equal to the threshold.

Available = zero is reported as **Out**, not merely Low.

---

## 11. Inventory history

Authenticated read route:

`GET /admin/api/variants/:variantId/inventory/history`

The owner-facing timeline shows:

- movement type,
- reason,
- note,
- actor,
- timestamp,
- signed On-hand change,
- resulting On hand,
- resulting Reserved.

This is the owner-facing answer to “Why did stock change?”

---

## 12. Bulk Stocktake

The Stock board includes an iPhone-first **Stocktake** flow.

Interaction:
1. one product per screen,
2. product image/title/SKU,
3. current system quantity,
4. large physical-count input,
5. Previous / Skip / Save & next,
6. review entered counts,
7. submit one controlled batch.

Endpoint:

`POST /admin/api/inventory/bulk-count`

Result is explicitly split into:

- `success`
- `unchanged`
- `conflicts`

There is no silent partial success.

For an untracked product, a bulk physical count becomes its Initial Count.

For a tracked product, it becomes a physical correction if needed.

---

## 13. Reserved and Incoming semantics

### Reserved

The field exists and is displayed, but remains zero until **Phase 5 — Order Reservations**.

Phase 4 does not fabricate order reservations.

### Incoming

Incoming quantity is derived from open/partial `inventory_incoming` records.

The data model and UI projection are ready.

Supplier Purchase Order and Receiving workflows remain Phase 7.

---

## 14. Out-of-stock behavior

Inside Product/Inventory Admin:

- tracked Available = 0 is surfaced as **Out**,
- Product filters understand Inventory Core Out state,
- Low/Out status is reflected in Product Admin.

The public storefront and checkout are intentionally **not** using this stock authority yet.

That cutover remains Phase 6.

This prevents an unfinished inventory rollout from changing public orderability.

---

## 15. Production isolation

Direct verification after the final Phase 4 deployment:

- Production latest migration: `0008_concurrency_guards.sql`
- Product/Inventory tables in Production: **0**
- Production order count: **3**
- no Production Inventory migration,
- no Production Stock Admin runtime change,
- no Product Core cutover,
- no checkout/storefront inventory authority.

Phase 4 exists only on Staging.

---

## 16. Final owner QA gate

Use the existing archived `STAGING QA PRODUCT` as the source for a new safe copy.

Do not test physical stock against a real sale product.

Recommended sequence:

1. Products → Archived → `STAGING QA PRODUCT` → **Duplicate product**.
2. Open `STAGING QA PRODUCT — Copy`.
3. Open **Stock**.
4. Initial Count = **10**.
   - expected On hand 10 / Reserved 0 / Available 10.
5. Low-stock threshold = **3**.
6. Adjust **-2**, reason **Damage**.
   - expected On hand/Available 8; Damage movement visible.
7. Physical Count = **9**.
   - expected Correction +1; On hand/Available 9.
8. Search/filter Stock to the QA copy and run Stocktake with **9**.
   - expected Unchanged.
9. Optional second Stocktake = **8**.
   - expected Updated 1; On hand/Available 8.
10. Confirm Product detail shows the same stock and Product ↔ Stock navigation works.
11. Archive the QA copy after testing.

After that succeeds, Phase 4 can be marked fully complete and work can begin on:

**Phase 5 — Order Reservations**

Phase 5 will connect reviewed-order quantities to Reserved/Available without yet performing the Phase 6 public storefront/checkout cutover.
