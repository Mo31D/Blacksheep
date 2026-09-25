# Black Sheep — Product & Inventory Admin Execution Checklist

Updated: 25 September 2026  
Repository: `Mo31D/Blacksheep`  
Branch: `main`

This checklist is intentionally separate from `ADMIN-V2-CHECKLIST.md` until Product/Inventory implementation begins.

## Status legend

- [x] verified complete
- [~] active / partially complete
- [ ] not started
- [!] blocker

---

# PHASE 0 — ARCHITECTURE LOCK

- [x] Create masterplan.
- [x] Freeze current 146-product source snapshot for migration.
- [x] Produce exact current-field inventory from assets/catalog.js.
- [x] Finalize product/variant schema.
- [x] Finalize category model.
- [x] Finalize media model.
- [x] Finalize supplier model.
- [x] Finalize inventory quantity semantics: on-hand / reserved / available / incoming.
- [x] Finalize order reservation lifecycle.
- [x] Finalize publish vs immediate-operational-change rules.
- [x] Define D1 migration rollback/forward-only policy.
- [x] Define API request/response contracts.
- [x] Define Admin Product workspace UX specification.
- [x] Define mobile Product/Stock interaction specification.
- [x] Review Phase 0 plan before creating production migrations.
- [x] Record architecture lock summary and exact Phase 1 entry gate.

Exit gate:
- schema approved,
- lifecycle approved,
- no ambiguous source-of-truth rules,
- no code path requires GitHub edits for routine owner product management.

**Status: COMPLETE — specification locked. No Product/Inventory migration has been created or applied.**

Exact Phase 1 start:
1. additive Product Core D1 migration,
2. deterministic importer,
3. staging-only import,
4. parity report,
5. read-only Products Admin.

---

# PHASE 1 — PRODUCT CORE / READ ONLY

- [x] Add D1 Product Core migration `0009_product_inventory_foundation.sql`.
- [x] Add normalized categories.
- [x] Add one deterministic default variant for each current product.
- [x] Add Product audit foundation.
- [x] Build deterministic legacy catalogue importer.
- [x] Guard importer to staging + frozen catalogue blob.
- [x] Import all 146 current products into staging D1.
- [x] Prove ID / slug / populated SKU / populated barcode uniqueness.
- [x] Build D1-vs-frozen-catalogue parity verifier.
- [x] Achieve staging parity: **PASS, 0 mismatches**.
- [x] Add authenticated Admin product-list API.
- [x] Add authenticated Admin product-detail API.
- [x] Keep Product POST/PATCH write routes absent.
- [x] Add premium read-only Products workspace.
- [x] Add product search, quality filters and sorting.
- [x] Add responsive Product detail behaviour and generated-script regression coverage.
- [x] Deploy Product Core/Admin to **staging only**.
- [x] Verify staging Worker health and Admin sign-in shell.
- [x] Preserve storefront/checkout authority; no public commerce cutover.
- [x] Verify Production D1 remains at `0000–0008` and order count remains 3.
- [~] Manual visual QA of the new authenticated Products workspace on iPhone Safari + desktop.

Technical exit gate:
- every current product represented: **PASS**
- no price/status/category/media loss: **PASS**
- staging parity verifier: **PASS**
- Admin read-only data path: **PASS**
- Production untouched: **PASS**
- owner visual sign-off of new Products view: **PENDING**

Evidence:
- workflow run `36169256499`
- job `108184497969`
- parity artifact `10879232734`
- `docs/PRODUCT-CORE-STAGING-PARITY-2026-09-25.md`

**Status: TECHNICALLY COMPLETE; manual visual sign-off remains before Phase 2 write access.**

---

# PHASE 2 — PRODUCT EDITING# PHASE 2 — PRODUCT EDITING

- [ ] Add product.
- [ ] Edit product basics.
- [ ] Edit price.
- [ ] Edit SKU/barcode.
- [ ] Edit categories.
- [ ] Edit storefront status.
- [ ] Draft/publish state.
- [ ] Optimistic concurrency.
- [ ] Audit before/after values.
- [ ] Quick Edit sheet.
- [ ] Full editor.
- [ ] Duplicate/archive.
- [ ] Product completeness warnings.
- [ ] Staging E2E.

Exit gate:
- owner no longer needs GitHub for normal text/price/status product edits.

---

# PHASE 3 — PRODUCT MEDIA

- [ ] Provision media storage.
- [ ] Secure upload route.
- [ ] File type/size validation.
- [ ] Product gallery.
- [ ] Primary image.
- [ ] Reorder.
- [ ] Alt text.
- [ ] Replace/remove.
- [ ] iPhone photo upload QA.
- [ ] Legacy-image coexistence verified.

Exit gate:
- owner can create a complete product including imagery from Admin.

---

# PHASE 4 — INVENTORY CORE

- [ ] Locations.
- [ ] Inventory balances.
- [ ] Immutable movements.
- [ ] Initial counts.
- [ ] Quick stock adjustment.
- [ ] Adjustment reason.
- [ ] Low-stock threshold.
- [ ] Available/on-hand/reserved/incoming UI.
- [ ] Inventory history.
- [ ] Bulk count.
- [ ] Out-of-stock behavior.
- [ ] Staging concurrency tests.

Exit gate:
- every quantity change is explainable from the ledger.

---

# PHASE 5 — ORDER RESERVATIONS

- [ ] Reviewed quote reservation.
- [ ] Reservation release.
- [ ] Reservation expiry policy.
- [ ] Payment transition.
- [ ] Fulfilment SALE movement.
- [ ] Cancellation release.
- [ ] Explicit return-to-stock workflow.
- [ ] Revision/substitution inventory integration.
- [ ] Concurrency protection.
- [ ] E2E order + inventory tests.

Exit gate:
- orders and stock cannot disagree silently.

---

# PHASE 6 — STOREFRONT / COMMERCE INTEGRATION

- [ ] Commerce price validation reads D1 product core.
- [ ] Commerce orderability reads D1 inventory.
- [ ] Public catalogue endpoint.
- [ ] Live stock/price overlay.
- [ ] Static product publication pipeline.
- [ ] Structured-data parity.
- [ ] Canonical URL preservation.
- [ ] Remove legacy duplicate catalogue source only after parity.
- [ ] Search-readiness regression suite updated.

Exit gate:
- Admin, storefront and checkout share one operational truth.

---

# PHASE 7 — SUPPLIERS / INCOMING STOCK

- [ ] Suppliers.
- [ ] Supplier product codes.
- [ ] Purchase orders.
- [ ] Incoming quantities.
- [ ] Partial receiving.
- [ ] Discrepancy handling.
- [ ] Cost capture.
- [ ] Supplier history.

---

# PHASE 8 — ADVANCED OPERATIONS

- [ ] Stock valuation.
- [ ] Sell-through.
- [ ] Days-of-stock.
- [ ] Reorder suggestions.
- [ ] Dead-stock view.
- [ ] Barcode scan workflows.
- [ ] Roles and permissions.
- [ ] CSV import/export.
- [ ] Advanced audit restore tools.

---

# UX QUALITY GATES — APPLY TO EVERY PHASE

- [ ] iPhone Safari verified.
- [ ] desktop verified.
- [ ] no horizontal overflow.
- [ ] keyboard/focus behavior correct.
- [ ] 44px minimum important touch targets.
- [ ] loading/error/empty states designed.
- [ ] no technical jargon in owner-facing copy.
- [ ] destructive actions require appropriate confirmation.
- [ ] mutation result visible immediately.
- [ ] audit trail records owner mutation.
- [ ] no routine task requires editing GitHub.

---

# CURRENT EXACT NEXT ACTION

Complete the **manual visual sign-off** of the new staging Products workspace on iPhone Safari and desktop.

Staging Admin:
`https://black-sheep-commerce-api-staging.ky6vfb55p9.workers.dev/admin#products`

Verify:
1. Products navigation and metrics,
2. search/filter/sort,
3. product images,
4. split-view product detail on desktop,
5. full-screen product detail/back behaviour on iPhone,
6. no horizontal overflow,
7. clear Read-only / Untracked / Out of stock / Arriving / data-warning states.

After owner sign-off, begin **PHASE 2 — PRODUCT EDITING**. Do not apply Product Core migration to Production merely for visual QA.
