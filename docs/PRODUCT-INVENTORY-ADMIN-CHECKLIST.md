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
- [ ] Freeze current 146-product source snapshot for migration.
- [ ] Produce exact current-field inventory from `assets/catalog.js`.
- [ ] Finalize product/variant schema.
- [ ] Finalize category model.
- [ ] Finalize media model.
- [ ] Finalize supplier model.
- [ ] Finalize inventory quantity semantics: on-hand / reserved / available / incoming.
- [ ] Finalize order reservation lifecycle.
- [ ] Finalize publish vs immediate-operational-change rules.
- [ ] Define D1 migration rollback/forward-only policy.
- [ ] Define API request/response contracts.
- [ ] Define Admin Product workspace wireframe/spec.
- [ ] Define mobile Product/Stock interaction spec.
- [ ] Review Phase 0 plan before creating production migrations.

Exit gate:
- schema approved,
- lifecycle approved,
- no ambiguous source-of-truth rules,
- no code path requires GitHub edits for routine owner product management.

---

# PHASE 1 — PRODUCT CORE / READ ONLY

- [ ] Add D1 product core migrations.
- [ ] Add categories.
- [ ] Add default variants.
- [ ] Add product audit foundation.
- [ ] Build deterministic legacy catalogue importer.
- [ ] Import all current products into staging.
- [ ] Prove ID/slug/SKU uniqueness.
- [ ] Build D1-vs-current-catalogue parity verifier.
- [ ] Add Admin product-list API.
- [ ] Add Admin product-detail API.
- [ ] Add read-only Products workspace.
- [ ] Add search/filter.
- [ ] Mobile QA.
- [ ] No storefront behaviour changes.

Exit gate:
- every current product represented,
- no price/status loss,
- Admin read-only output matches current source.

---

# PHASE 2 — PRODUCT EDITING

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

Complete **Phase 0 Architecture Lock** before creating Product/Inventory production migrations.

Start with:
1. current-catalogue field audit,
2. final D1 schema proposal,
3. inventory/reservation lifecycle decision,
4. Admin Products/Stock UX specification.
