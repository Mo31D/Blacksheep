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
- [x] Owner mutation smoke-test in authenticated staging UI — confirmed successful by owner.

Current exit status:
- normal text / price / status / SKU / barcode / category edits no longer require GitHub on staging,
- Product editing remains isolated from the Production storefront,
- Media upload is intentionally Phase 3,
- numeric inventory remains intentionally disabled.

Evidence:
- initial Phase 2 workflow `36172797078` / job `108196158387`
- Duplicate/Archive staging workflow `36174114456` / job `108200446776`
- current staging deployment `7984e631-902e-470b-bb0f-447bdb031b3b`
- current staging Worker version `cdcfe773-b6cc-4910-8c86-a74f28bde66c`
- `docs/PRODUCT-EDITOR-PHASE2-STAGING-2026-09-25.md`

---

# PHASE 3 — PRODUCT MEDIA

- [x] Provision media storage — isolated staging bucket `black-sheep-product-media-staging` created in WEUR / Standard.
- [x] Staging-only R2 binding declared as `PRODUCT_MEDIA` / `black-sheep-product-media-staging`.
- [x] Verify staging-only `PRODUCT_MEDIA` binding: source config points only staging to `black-sheep-product-media-staging`.
- [x] Secure authenticated multipart upload route implemented.
- [x] 8 MB upload limit.
- [x] JPEG / PNG / WebP allow-list.
- [x] Magic-byte/signature validation; MIME label alone is not trusted.
- [x] SHA-256 checksum captured.
- [x] Immutable media ID + R2 object-key design.
- [x] Same-origin immutable media delivery route `/media/<mediaId>`.
- [x] Media changes automatically create/use a Product Draft.
- [x] Product gallery manager implemented.
- [x] First uploaded image becomes Primary automatically.
- [x] Change Primary image.
- [x] Reorder gallery.
- [x] Edit alt text.
- [x] Remove image non-destructively from the Draft.
- [x] Preserve published-version media when Draft removes an image.
- [x] Avoid deleting shared R2 objects still referenced by another media row.
- [x] Replace image — dedicated one-click replacement with atomic D1 swap, position/Primary/alt preservation and safe old-object cleanup.
- [x] Product Media audit events.
- [x] Phase 3 Admin UI + upload-validation tests.
- [x] Immutable media-delivery route tests.
- [x] Real R2 → Worker delivery smoke: HTTP 200 through `/media/:id` (run `36178979258`).
- [x] Temporary smoke object / D1 row / workflow removed; staging bucket verified empty afterwards.
- [x] Full Commerce CI: **PASS** — latest run `36176490850` after Replace + coexistence hardening.
- [x] Dedicated `Product Media Staging Phase 3` deployment workflow with R2 existence gate.
- [x] Deploy Product Media to staging — workflow `36178631127` / job `108215277892` SUCCESS.
- [x] iPhone photo upload QA — authenticated owner Media/Product smoke-test confirmed successful.
- [x] Legacy-image coexistence — 136 live `LEGACY_REPO` records coexisted with a real temporary R2 media row while `/media/:id` returned HTTP 200; temporary R2 row/object then removed.

Exit gate:
- owner can create a complete product including imagery from Admin,
- upload / primary / reorder / alt / remove proven on real staging R2,
- iPhone Photos/camera path visually verified.

**Status: COMPLETE ON STAGING — owner Product + Media smoke-test passed.**

---

# PHASE 4 — INVENTORY CORE

- [x] Locations foundation + authenticated location API — Ambleside is the initial active location.
- [x] Inventory balances — additive migration `0010_inventory_core.sql`; no quantities inferred.
- [x] Immutable movements — append-only ledger with UPDATE/DELETE blocking triggers.
- [x] Initial Count — explicitly enables tracking and creates the first balance/movement.
- [x] Quick stock adjustment — delta-based; Available is never directly editable.
- [x] Adjustment reason — required controlled reason code + optional owner note.
- [x] Low-stock threshold — operational variant field editable from Stock.
- [x] Available / On hand / Reserved / Incoming UI — dedicated premium Stock workspace.
- [x] Inventory history — immutable movement timeline per variant/location.
- [x] Bulk Count — iPhone-first Save & next stocktake with explicit success/conflict/unchanged results.
- [x] Out-of-stock behavior inside Inventory Core — tracked Available=0 is surfaced as Out; checkout/storefront cutover remains Phase 6.
- [x] Staging concurrency/idempotency test suite in source — UUID mutation tokens, balance versions, unique Initial Count, unique idempotency keys.
- [x] Full Commerce CI after Phase 4 implementation — run `36182963561` SUCCESS.
- [x] Direct post-release integrity — 147 products / 146 imported / 0 tracked / 0 balances / 0 movements / 0 incoming; 2 ledger triggers + 2 key ledger indexes present.
- [x] Product detail ↔ Stock integration polish — actual Low/Out state, quantities and `Stock` deep-link; CI run `36183681792` SUCCESS.
- [x] Final Product↔Stock integration polish deployed — workflow `36183967251` / job `108232778002` SUCCESS.
- [x] `0010` applied + Stock workspace deployed to staging — workflow `36183361766` SUCCESS.
- [~] Controlled owner Phase 4 stock smoke-test on a staging QA product — final Phase 4 gate.

Exit gate:
- every quantity change is explainable from the ledger.

---

**Status: TECHNICALLY COMPLETE ON STAGING — owner stock mutation QA is the only remaining Phase 4 gate.**

Evidence:
- source/contract CI: `36182963561` — SUCCESS
- initial staging release: `36183361766` / job `108230788251` — SUCCESS
- Product↔Stock polish CI: `36183681792` — SUCCESS
- final staging release: `36183967251` / job `108232778002` — SUCCESS
- current staging deployment: `30023133-b0b6-41b3-bbfe-66db86748fb0`
- current staging Worker version: `b087f7b4-6cb7-4d80-bb62-06cac1ae2dbf` / version 70
- staging migration ledger ends at `0010_inventory_core.sql`
- direct post-release state before owner stock QA: 147 products / 146 original imports / 0 tracked / 0 balances / 0 movements / 0 incoming
- Production remains `0000–0008` with no Product/Inventory tables and 3 orders
- `docs/INVENTORY-CORE-PHASE4-STAGING-2026-09-25.md`

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

## Phase 4 — owner staging stock QA

Use the existing archived `STAGING QA PRODUCT` only as the source for a new safe test copy; do not use a real sale product.

1. Products → Archived → `STAGING QA PRODUCT` → **Duplicate product**.
2. Open the new `STAGING QA PRODUCT — Copy`.
3. Use its **Stock** button or open the Stock tab and search for the copy.
4. **Initial Count:** enter `10`.
   - expected: Tracking enabled, On hand 10, Reserved 0, Available 10.
5. **Low-stock threshold:** set `3`.
6. **Adjust stock:** `-2`, reason `Damage`.
   - expected: On hand 8, Available 8; immutable Damage movement visible.
7. **Physical count:** enter `9`.
   - expected: correction +1; On hand/Available 9; history shows the count correction.
8. Filter/search so only the QA copy is in the Stock list, run **Stocktake**, enter `9`.
   - expected: explicit `Unchanged` result.
9. Repeat Stocktake with `8` if you want to prove bulk correction.
   - expected: `Updated 1`, On hand/Available 8.
10. Confirm Products shows the live Inventory Core state and Product → **Stock** deep-link works.
11. Return to Products and **Archive** the QA copy after testing.

Once this owner QA passes:
- mark Phase 4 COMPLETE,
- begin **PHASE 5 — ORDER RESERVATIONS**,
- do not enable Phase 6 storefront/checkout inventory authority yet.

Safety locks:
- Production remains pre-Product-Core at `0000–0008`,
- no real product stock has been inferred or modified by the Phase 4 migration,
- no reviewed-order reservation logic is enabled until Phase 5.
