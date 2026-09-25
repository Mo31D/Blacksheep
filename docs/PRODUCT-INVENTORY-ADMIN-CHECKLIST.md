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
- [x] Add normalized categories and deterministic default variants.
- [x] Build deterministic legacy catalogue importer.
- [x] Import all 146 current products into staging D1.
- [x] Achieve frozen-catalogue parity: **PASS, 0 mismatches**.
- [x] Add authenticated Product list/detail APIs.
- [x] Add premium Products workspace/search/filter/sort.
- [x] Deploy read-only Product Core to staging.
- [x] Verify Production remains untouched.
- [x] Owner iPhone QA completed from supplied screenshots.
- [x] Polish KPI cards to 2×2 mobile grid.
- [x] Correct Needs data from naive 28 to **15 unique actionable products**.
- [x] Exclude scoop-priced/in-store Ice Cream flavours from actionable Missing price.
- [x] Add compact mobile product header after scroll.
- [x] Reset scroll when changing Admin sections.
- [x] Add horizontal-filter scroll cue.
- [x] Move technical identity fields into Advanced details.
- [x] Preserve desktop split-view architecture and generated-script regression coverage.

**Status: COMPLETE. Owner explicitly requested progression to Phase 2 after the mobile review/polish.**

Evidence:
- initial parity workflow: `36169256499`
- `docs/PRODUCT-CORE-STAGING-PARITY-2026-09-25.md`
- direct post-polish D1 check: actionable missing price 2 / missing image 14 / unique Needs data 15.

---

# PHASE 2 — PRODUCT EDITING

- [x] Add Product as a private draft.
- [x] Generate immutable Product UUID + safe unique slug.
- [x] Edit product basics: name / brand / type / description.
- [x] Edit price.
- [x] Edit SKU / barcode with uniqueness protection.
- [x] Edit categories.
- [x] Edit selling status.
- [x] Enable / disable online ordering.
- [x] Implement Draft / Publish content state.
- [x] Show Draft changes clearly in Product list/detail.
- [x] Add optimistic Product concurrency.
- [x] Add optimistic Variant concurrency.
- [x] Make Quick Edit atomic across Product + Variant state.
- [x] Add audit before/after payloads.
- [x] Render human-readable Audit history.
- [x] Add Premium Quick Edit sheet.
- [x] Add Premium full content editor sheet.
- [x] Add Product completeness warnings.
- [x] Add actionable Missing price semantics.
- [x] Protect mutations with existing Admin auth + same-origin guard.
- [x] Add Phase 2 route/UI regression tests.
- [x] Full Commerce CI: PASS.
- [x] Deploy Phase 2 Product Editor to staging.
- [x] Staging Product Core baseline guard: PASS.
- [x] Staging health/Admin shell: PASS.
- [x] Verify Production D1 remains `0000–0008`.
- [x] Duplicate product — safe private Draft; SKU/barcode cleared; online ordering off.
- [x] Archive product — non-destructive; sale disabled; audit retained.
- [x] Archived filter.
- [~] Owner mutation smoke-test in authenticated staging UI.

Current exit status:
- normal text / price / status / SKU / barcode / category edits no longer require GitHub on staging,
- Product editing remains isolated from the Production storefront,
- Media upload is intentionally Phase 3,
- numeric inventory remains intentionally disabled.

Evidence:
- staging workflow `36172797078`
- job `108196158387`
- staging deployment `376e151f-0a0f-44b5-b91e-c0081cc8296b`
- staging Worker version `f79d2e06-858c-4e98-a579-2cc8a03f4d07`
- `docs/PRODUCT-EDITOR-PHASE2-STAGING-2026-09-25.md`

---

# PHASE 3 — PRODUCT MEDIA

- [~] Provision media storage — creating isolated staging R2 bucket.
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

Phase 2 Duplicate / Archive is code-complete and CI-clean. Begin **Phase 3 — Product Media** on staging only:

1. Provision isolated staging R2 media bucket.
2. Add staging-only Worker binding.
3. Implement authenticated upload + validation.
4. Attach uploads to the current product draft/version.
5. Add gallery / primary / alt text / reorder / remove controls.
6. Run CI + deploy + direct staging verification.

Then:

1. Duplicate product → safe private draft with no copied SKU/barcode.
2. Archive product → non-destructive, confirmed action with audit trail.
3. Add Archived filter so archived records remain recoverable/auditable.
4. Run CI and staging deployment.

Then perform the owner **Phase 2 staging mutation smoke-test** in the authenticated Products workspace:

1. Add a temporary Draft product.
2. Quick Edit price / SKU / barcode / selling status.
3. Edit name / description / categories as Draft.
4. Confirm Draft changes appears.
5. Confirm Audit history records the before/after changes.
6. Publish the Draft inside staging Product Core.

Then:
- finish Duplicate / Archive controls,
- proceed to **PHASE 3 — PRODUCT MEDIA** so a product can be completed from iPhone with real image upload,
- keep Production Product Core / inventory cutover locked until later gates.
