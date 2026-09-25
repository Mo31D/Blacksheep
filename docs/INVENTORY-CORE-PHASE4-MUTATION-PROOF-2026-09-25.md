# Black Sheep — Phase 4 Staging Inventory Mutation Proof

**Date:** 25 September 2026  
**Environment:** Staging only  
**Purpose:** Independent D1 mutation proof after the Phase 4 Inventory Core deployment  
**Result:** **PASS**  
**Owner authenticated UI QA:** still pending

---

## Safety scope

A dedicated non-sale QA product was created directly in staging D1:

- Product ID: `prd_inventory_qa_20260925`
- Variant ID: `var_inventory_qa_20260925`
- Title: `STAGING INVENTORY QA — AUTO`
- Initial publication: `DRAFT`
- Selling state: `NOT_FOR_SALE`
- Online ordering: disabled
- No real sale product was modified.

After the proof, the QA product was archived.

---

## Mutation sequence and result

### 1. Initial Count

Input:
- quantity = **10**

Result:
- Tracking = enabled
- On hand = **10**
- Reserved = **0**
- Safety stock = **0**
- Available = **10**
- Balance version = **1**
- Immutable movement = `INITIAL_COUNT +10`

### 2. Low-stock threshold

Input:
- threshold = **3**

Result:
- threshold = **3**
- Product/Variant optimistic versions advanced
- no stock balance was changed.

### 3. Damage adjustment

Input:
- delta = **-2**
- reason = `DAMAGE`

Result:
- On hand = **8**
- Reserved = **0**
- Available = **8**
- Balance version = **2**
- immutable movement = `DAMAGE -2`

### 4. Physical Count

Input:
- physical count = **9**

Result:
- correction delta = **+1**
- On hand = **9**
- Available = **9**
- Balance version = **3**
- immutable movement = `CORRECTION +1 / PHYSICAL_COUNT`

### 5. Unchanged stocktake check

Immediately before the final stocktake correction:

- On hand = **9**
- Available = **9**
- movement count = **3**

This is the exact state in which the Phase 4 bulk-count domain returns the item as `unchanged` when the counted quantity is also 9. No extra inventory movement is required for an unchanged count.

### 6. Controlled stocktake correction

Input:
- count = **8**
- batch = `ibatch_qa_stocktake_20260925`

Result:
- correction delta = **-1**
- On hand = **8**
- Available = **8**
- Balance version = **4**
- movement count = **4**
- immutable movement = `CORRECTION -1 / PHYSICAL_COUNT`

### 7. Archive

The QA product was then archived:

- Publication = `ARCHIVED`
- Selling = `NOT_FOR_SALE`
- Online ordering = disabled
- Inventory tracking/history retained for audit
- final On hand = **8**
- final Reserved = **0**
- final Available = **8**

Because Inventory list queries exclude archived products:
- active variants = **146**
- active tracked variants = **0**
- archived tracked variants = **1**

The QA proof therefore does not contaminate the normal active Stock workspace.

---

## Final immutable ledger

The QA variant has exactly four inventory movements:

| # | Movement | On-hand delta | Resulting On hand |
|---|---|---:|---:|
| 1 | INITIAL_COUNT | +10 | 10 |
| 2 | DAMAGE | -2 | 8 |
| 3 | CORRECTION / Physical Count | +1 | 9 |
| 4 | CORRECTION / Stocktake | -1 | 8 |

All movement idempotency keys are unique.

Direct attempts to mutate the first QA movement were rejected by staging D1:

- UPDATE → `inventory_movements_are_immutable`
- DELETE → `inventory_movements_are_immutable`

Both failures came from the deployed SQLite triggers, not from a UI-only check.

---

## Post-proof staging state

Direct staging D1 verification after the archived proof product:

- Products total: **148**
- Original imported baseline: **146**
- Tracked variants total: **1**
- Active tracked variants: **0**
- Archived tracked variants: **1**
- Inventory balances: **1**
- Inventory movements: **4**
- Incoming records: **0**
- QA On hand: **8**
- QA Reserved: **0**
- QA Safety stock: **0**
- QA Available: **8**

The two extra staging products are QA-only products; the imported catalogue baseline remains exactly 146.

---

## Production isolation

Direct Production verification after the staging mutation proof:

- latest Production migration: `0008_concurrency_guards.sql`
- Product/Inventory tables in Production: **0**
- Production orders: **3**

No Production Product Core, Inventory Core, Stock workspace or quantity data was changed.

---

## What this proof does and does not close

This proof confirms the deployed staging data model and mutation semantics:

- Initial Count,
- threshold persistence,
- adjustment ledger,
- physical count correction,
- bulk-count correction semantics,
- immutable history,
- archive isolation,
- Production isolation.

It does **not** replace the final owner-authenticated UX test of:
- Stock workspace interaction,
- iPhone controls,
- Product → Stock deep-link,
- Stock → Product deep-link,
- owner-facing success/error messaging.

Therefore Phase 4 is technically/data complete, while one owner UX gate remains open.
