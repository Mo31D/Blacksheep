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
- [~] Controlled owner Phase 4 stock smoke-test on a staging QA product — inventory flow exercised successfully; final re-test after the login/iPad UX fixes remains the Phase 4 gate.
- [x] Independent staging D1 mutation smoke-test — PASS: Initial Count 10 → threshold 3 → Damage -2 → Physical Count 9 → Stocktake correction 8 → Archive; immutable UPDATE/DELETE triggers verified on real staging D1.
- [x] Owner-reported Safari OTP transition defect fixed — successful verification now forces an authenticated document reload instead of changing only the URL fragment.
- [x] iPad portrait master/detail defect fixed — Orders, Products and Stock now open selected detail immediately as a tablet overlay up to 900px instead of rendering it below the long list.
- [x] Regression assertions added for login reload and iPad-width detail overlays.
- [x] UX fix passed Commerce CI and the guarded Phase 4 staging deployment, including Production-isolation verification.

Exit gate:
- every quantity change is explainable from the ledger.

---

**Status: TECHNICALLY + DATA-MUTATION COMPLETE ON STAGING — owner re-test of the corrected login + iPad portrait Stock UX is the only remaining Phase 4 gate.**

Evidence:
- source/contract CI: `36182963561` — SUCCESS
- initial staging release: `36183361766` / job `108230788251` — SUCCESS
- Product↔Stock polish CI: `36183681792` — SUCCESS
- final staging release: `36183967251` / job `108232778002` — SUCCESS
- current staging deployment after owner UX fixes: `6d89ff4c-f1d8-4552-83f1-7cf8113c5a4c`
- current staging Worker version after owner UX fixes: `cf42c03a-0371-47c5-a1a7-bde6980f7dd5`
- owner UX fix release: workflow `36187771688` SUCCESS; Commerce CI `36187771624` SUCCESS
- staging migration ledger ends at `0010_inventory_core.sql`
- direct post-release state before owner stock QA: 147 products / 146 original imports / 0 tracked / 0 balances / 0 movements / 0 incoming
- Production remains `0000–0008` with no Product/Inventory tables and 3 orders
- `docs/INVENTORY-CORE-PHASE4-STAGING-2026-09-25.md`
- `docs/INVENTORY-CORE-PHASE4-MUTATION-PROOF-2026-09-25.md`

---

# PHASE 5 — ORDER RESERVATIONS

**Status: COMPLETE + REAL-STAGING VERIFIED — 25 September 2026**

- [x] Phase 5 implementation plan locked before code — `docs/ORDER-RESERVATIONS-PHASE5-IMPLEMENTATION-PLAN-2026-09-25.md`.
- [x] Implementation completed on staging by owner direction; Production remains untouched.
- [x] Migration `0011_order_reservations.sql` — reservation foundation.
- [x] Migration `0012_order_returns.sql` — explicit one-time Return-to-stock marker.
- [x] Upgrade-test coverage through `0000–0011 → 0012`.
- [x] Reservation invariant checks wired into Commerce CI.
- [x] Reviewed quote reservation integrated into the existing revision Send transaction boundary.
- [x] Product resolution uses Product Core IDs / legacy catalogue IDs with no SKU fuzzy guessing.
- [x] Insufficient tracked stock rejects Send with zero partial reservation and zero partial movement.
- [x] Untracked products preserve the existing order flow.
- [x] Replayed reviewed-revision Send is idempotent.
- [x] Review-token expiry is aligned with reservation expiry.
- [x] Decline releases ACTIVE reservation exactly once.
- [x] Supersede releases the previous hold before the replacement reserves.
- [x] Lazy expiry release implemented.
- [x] Scheduled expiry cleanup deployed to staging every 30 minutes.
- [x] Payment transition ACTIVE → COMMITTED implemented with no On hand change.
- [x] Delivery SHIPPED consumes stock exactly once.
- [x] Collection COMPLETED consumes stock exactly once.
- [x] Cancellation releases unfulfilled reservation.
- [x] Refund alone changes no inventory.
- [x] Explicit owner Return-to-stock implemented after refund:
  - immutable `RETURN` movement,
  - On hand increment exactly once,
  - replay idempotency,
  - concurrency guards.
- [x] Admin reviewed-order Inventory UI shows tracked/untracked, On hand, Reserved, Available, reservation quantity/state/expiry and inline insufficiency.
- [x] Revision/substitution inventory integration verified.
- [x] One-unit / two-orders concurrency proof: exactly one winner.
- [x] Real-staging controlled E2E proof completed.
- [x] Synthetic QA live stock cleaned after proof while retaining immutable audit/ledger evidence.
- [x] Final staging D1 invariants verified directly through Cloudflare.
- [x] Production isolation re-verified after proof.
- [x] Temporary Phase 5 QA Worker deleted after proof.
- [x] D1 binding-count defect discovered by real D1, fixed in `ORDER_RESERVATION` movement builder, and protected by placeholder/binding regression tests.

### Final proof evidence

- GitHub workflow: `36195902160` — SUCCESS.
- Staging Worker version: `c591003d-ab57-45dd-ba3c-abc302c61b79`.
- Staging migration ledger: latest `0012_order_returns.sql`.
- Staging reservation feature: enabled.
- Staging expiry schedule: `*/30 * * * *`.
- Real-staging QA run ID: `3f6f4cfa6b`.
- QA result:
  - Collection lifecycle: PASS.
  - Delivery lifecycle: PASS.
  - Insufficient stock rollback: PASS.
  - Untracked compatibility: PASS.
  - Decline release: PASS.
  - Supersede release/re-reserve: PASS.
  - Expiry: PASS.
  - Cancellation: PASS.
  - Concurrency: exactly 1 winner for the final unit.
- Retained immutable proof:
  - `ORDER_RESERVATION`: 8 movements.
  - `RESERVATION_RELEASE`: 6 movements.
  - `SALE`: 2 movements.
  - `RETURN`: 1 movement.
  - reservation terminal states: CONSUMED 2 / EXPIRED 1 / RELEASED 6.
  - explicit return marker: 1.
- Post-proof live QA authority:
  - ACTIVE/COMMITTED QA reservations: 0.
  - QA inventory balances: 0.
  - active/tracked QA variants: 0.
- Production remains:
  - latest migration `0008_concurrency_guards.sql`,
  - Product/Inventory/Reservation tables: 0,
  - orders: 3,
  - reservation feature flag: absent,
  - cron schedules: none.

Exit gate:
- [x] Orders and stock cannot disagree silently in the verified Phase 5 staging lifecycle.

Release report:
- `docs/ORDER-RESERVATIONS-PHASE5-STAGING-RELEASE-2026-09-25.md`.

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

## Phase 5 is closed on staging

Phase 5 Order Reservations is now **COMPLETE + REAL-STAGING VERIFIED**.

The remaining pre-cutover gate is the separate owner UX re-test from Phase 4:
1. verify corrected OTP login,
2. verify iPad portrait Orders / Products / Stock master-detail overlay,
3. archive the owner UI QA copy.

After that, prepare the **Phase 6 storefront / commerce integration cutover plan** before changing public price or stock authority.

Production remains intentionally unchanged at migration `0008`.  
Do not apply Product/Inventory/Reservation migrations to Production and do not enable Phase 6 authority until a separate Production cutover gate is approved.
