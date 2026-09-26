# Black Sheep — Product & Inventory Admin Execution Checklist

Updated: 26 September 2026  
Repository: `Mo31D/Blacksheep`  
Branch: `main`

This checklist began as the separate Product/Inventory execution tracker and is now one of the authoritative current-state records. Historical phase notes are preserved for implementation evidence; when an older phase note conflicts with the **FINAL BACKEND AUDIT REFRESH** or **CURRENT EXACT NEXT ACTION**, the newer sections are authoritative.

## Status legend

- [x] verified complete
- [~] active / partially complete
- [ ] not started
- [!] blocker

---

# FINAL BACKEND AUDIT REFRESH — 26 SEPTEMBER 2026

- [x] Current GitHub `main` re-fetched and treated as source of truth.
- [x] Current branch inventory re-verified: `main` only.
- [x] PR inventory re-verified: PRs #1–#7 closed; Draft PR #7 was not merged.
- [x] Legacy builders `build-icecream.mjs` / `build-romneys.mjs` absent from current source and Search Readiness.
- [x] Duplicate generated backend commerce authority remains removed; D1 remains sole backend commerce authority.
- [x] Five stale `# trigger-...` workflow markers removed.
- [x] Commerce CI explicitly restricted to `contents: read`.
- [x] Post-cleanup Commerce CI `36240439223` — SUCCESS.
- [x] Post-cleanup Search Readiness `36240439155` — SUCCESS.
- [x] Post-cleanup dedicated staging E2E/browser workflows — SUCCESS:
  - Checkout Browser `36240439171`
  - Admin Browser `36240439189`
  - Admin V2 `36240439178`
  - Review Edge `36240439190`
  - Resend Webhook `36240439169`
- [x] Final combined backend audit `36240828154` — SUCCESS.
- [x] Full `npm run check`: 33 Vitest files / 195 tests — PASS.
- [x] Production read-only D1 integrity: migration `0012_order_returns.sql`, 146 Active Published Products, 146 active default variants, 4 orders, 0 active reservations.
- [x] Production public catalogue: 146 products; privacy contract + D1/static parity PASS.
- [x] Phase 6 deterministic publication package: 146 products; SHA-256 `61d0b5f8cd4e038d3d6b38fff8bda77fe1bd491fc7f6c796ac59089522d7c3f7`.
- [x] Search Readiness: 146 products / 17 active pages / 166 sitemap URLs / 0 placeholders.
- [x] Final one-shot audit workflow removed after success; Search Readiness `36241123400` + Pages `36241123221` passed on the cleaned tree.
- [x] Final report created: `docs/BLACK-SHEEP-BACKEND-AUDIT-CLEANUP-2026-09-26.md`.

**Remaining acceptance is manual owner Production smoke only:** live Products/Stock check, one ordinary live order request, order visibility in Admin, customer + owner email delivery, and confirmation that an untracked baseline Product creates no unexpected numeric stock movement.

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
- [x] Controlled owner Phase 4 stock smoke-test and corrected login/iPad UX re-test — owner confirmed successful on 25 September 2026.
- [x] Independent staging D1 mutation smoke-test — PASS: Initial Count 10 → threshold 3 → Damage -2 → Physical Count 9 → Stocktake correction 8 → Archive; immutable UPDATE/DELETE triggers verified on real staging D1.
- [x] Owner-reported Safari OTP transition defect fixed — successful verification now forces an authenticated document reload instead of changing only the URL fragment.
- [x] iPad portrait master/detail defect fixed — Orders, Products and Stock now open selected detail immediately as a tablet overlay up to 900px instead of rendering it below the long list.
- [x] Regression assertions added for login reload and iPad-width detail overlays.
- [x] UX fix passed Commerce CI and the guarded Phase 4 staging deployment, including Production-isolation verification.

Exit gate:
- every quantity change is explainable from the ledger.

---

**Status: COMPLETE ON STAGING — Inventory Core + corrected OTP/iPad UX owner re-test passed.**

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

**Status: AUTOMATED PRODUCTION CUTOVER COMPLETE — Milestones 6.1–6.7 executed and verified. Final owner smoke is pending.**

- [x] Phase 6 cutover principles locked before code — `docs/STOREFRONT-COMMERCE-PHASE6-IMPLEMENTATION-PLAN-2026-09-25.md`.
- [x] D1 public commerce catalogue/query layer — published content only; Draft never used by the public query.
- [x] Commerce price validation reads D1 Product Core on staging.
- [x] Commerce orderability reads D1 Inventory Core on staging.
- [x] Public catalogue endpoint — `GET /v1/catalog` + `GET /v1/catalog/:id`, staging only.
- [x] Public API privacy contract — no cost/supplier/audit/internal-note/Draft fields.
- [x] D1/static catalogue parity — 146 generated products vs 146 D1 public products, zero missing, zero extra, zero field mismatches.
- [x] Staging D1 checkout authority enabled behind `D1_COMMERCE_AUTHORITY_ENABLED=true`.
- [x] Browser/cart forged price ignored; current D1 price persisted server-side.
- [x] Real tracked-stock checkout proof:
  - Available 1 allows quantity 1,
  - quantity 2 is rejected,
  - Reserved reduces Available to 0 and blocks ordering.
- [x] Operational propagation proof on real staging:
  - D1 price 777 → order persisted 777,
  - D1 price edited to 888 → next order persisted 888,
  - online ordering OFF blocks,
  - manual OUT_OF_STOCK blocks,
  - archive removes the Product from public D1 catalogue.
- [x] Published-vs-Draft proof — synthetic Product had a separate secret Draft and the public contract returned only the Published version.
- [x] Synthetic Phase 6 checkout QA Product/orders/balance cleaned after proof.
- [x] Temporary Phase 6 checkout QA Worker deleted.
- [x] Live stock/price storefront overlay — safe staging preview, static fallback, card/detail/basket/checkout state synchronization.
- [x] Overlay canonical URL preservation — preview query never rewrites canonical URLs.
- [x] Overlay search-readiness/browser regression coverage — Search Readiness + Chromium + WebKit/mobile pass.
- [x] Static Product publication pipeline — deterministic D1 candidate package for:
  - `assets/catalog.js`,
  - all static `/products/<slug>.html` pages,
  - 14 collection/full-range pages,
  - sitemap,
  - Product JSON-LD,
  - canonical metadata.
- [x] D1 Published Product + legacy specialist extension merge authority implemented; specialist page detail counts preserved.
- [x] Structured-data parity — Product JSON-LD name/url/SKU + Offer price/currency/availability are verified against publication state.
- [x] Static selling controls generated from D1 state — non-orderable Product buttons are disabled in the HTML before JavaScript.
- [x] Canonical URL preservation under generated publication.
- [x] Product slug-history preservation:
  - current slug remains canonical,
  - retired alias renders a `noindex,follow` redirect shell,
  - retired alias stays out of sitemap,
  - alias removed when Product is archived.
- [x] Collection/full-range publication:
  - cards generated from candidate D1 catalogue,
  - ItemList JSON-LD synchronized,
  - card/ItemList counts verified.
- [x] Admin Add → Publish → candidate static output → Archive proof:
  - new Product creates 147-product candidate,
  - new static Product page,
  - full-range card + ItemList + sitemap inclusion,
  - archive restores exact 146-product baseline,
  - Product page/card/ItemList/sitemap removed,
  - audit CREATED/PUBLISHED/ARCHIVED retained.
- [x] Unified publication package verifier.
- [x] Deterministic package `--check` — repeated render is byte-for-byte identical.
- [x] Publication change plan generated against the repo without applying it.
- [x] Phase 6 publication-specific SEO/canonical/schema assertions.
- [x] Legacy duplicate backend catalogue authority removed after Production cutover proof; D1 is now the sole backend commerce authority.
- [x] Production cutover review/readiness — read-only audit, exact post-cutover source simulation, Commerce validation and Worker dry-run all PASS.
- [x] Guarded Production Product Core importer — exact confirmation required; non-empty Product Core blocks destructive re-import.
- [x] Production Product Core parity command — read-only exact baseline verifier.
- [x] Frozen Phase 1 migration fixture separated from live `assets/catalog.js`.
- [x] Production publication export can regenerate the package read-only from Production D1 after import.
- [x] Deterministic Production activation script prepared for the 162-file package + Worker flags/R2/cron + storefront live marker.
- [x] Legacy generic Production deploy path blocked during Phase 6 cutover.
- [x] Production cutover runbook locked — `docs/STOREFRONT-COMMERCE-PHASE6-PRODUCTION-CUTOVER-PLAN-2026-09-26.md`.
- [x] Final Production readiness report — `docs/STOREFRONT-COMMERCE-PHASE6-PRODUCTION-READINESS-2026-09-26.md`.
- [x] Dedicated manual-only Production cutover workflow prepared — `.github/workflows/phase6-production-cutover.yml`.
- [x] Execute Production cutover — owner approved; guarded Production workflow executed with the approved package SHA.
- [x] Automated post-cutover verification — Production D1/Worker/public catalogue/storefront/canonical/Cron gates PASS.
- [ ] Post-cutover owner smoke: Admin Products/Stock + one ordinary customer order + owner/customer notification proof.

### Phase 6 evidence

#### 6.1–6.5
- Public D1 catalogue + exact parity workflow: `36199480713` — SUCCESS.
- D1 checkout authority + real tracked-stock proof workflow: `36200073433` — SUCCESS.
- Storefront overlay browser QA workflow: `36226261021` — SUCCESS.
- Real tracked-stock QA run: `05d821c4e1` — PASS.
- Exact public parity: generated 146 / D1 146 / missing 0 / extra 0 / mismatches 0.

#### 6.6 Publication pipeline
- Unified 146-product publication candidate workflow: `36229207557` — SUCCESS.
- Admin Add/Publish/Archive publication E2E: `36229294654` — SUCCESS.
- Publication Admin QA run: `ebf60e69ab` — PASS.
- Baseline Product slug rows: 146; retired aliases: 0.
- Synthetic retired-slug redirect proof: PASS.
- Baseline deterministic package SHA-256: `61d0b5f8cd4e038d3d6b38fff8bda77fe1bd491fc7f6c796ac59089522d7c3f7`.
- First candidate apply plan against current repo:
  - added files: 0,
  - changed publication-owned files: 162,
  - deletions: 0,
  - unsafe slug removals: 0.
- The 162 files are intentionally **not applied yet**; first Production publication is part of the separate cutover gate.

#### Current staging runtime
- Staging migration ledger: `0012_order_returns.sql`.
- Staging flags:
  - `D1_PUBLIC_CATALOG_ENABLED=true`,
  - `D1_COMMERCE_AUTHORITY_ENABLED=true`,
  - `ORDER_RESERVATIONS_ENABLED=true`.
- Staging baseline restored to 146 ACTIVE Published Products after QA cleanup.

#### 6.7 Production cutover readiness
- Final read-only readiness workflow: `36230644182` — SUCCESS.
- Exact simulated post-cutover source: PASS.
- Full simulated Commerce validation: PASS — 35 Vitest files plus migration/inventory/reservation/cart/legal/typecheck gates.
- Simulated post-cutover Production Worker dry-run: PASS.
- Approved publication package: 162 files / SHA-256 `61d0b5f8cd4e038d3d6b38fff8bda77fe1bd491fc7f6c796ac59089522d7c3f7`.
- Pending Production migrations remain exactly `0009–0012`.
- Production import baseline fixture is immutable and independent of the live catalogue.
- Guarded cutover workflow requires:
  - confirmation `CUTOVER-PRODUCTION-D1`,
  - a 64-character approved package SHA,
  - unchanged `main`,
  - a pre-cutover D1 Time Travel bookmark,
  - Production parity and Production-generated package SHA match before authority activation.
- Failure handling is non-destructive by default; no automatic Time Travel restore is performed.
- Cloudflare Time Travel/R2/Worker command syntax was cross-checked against current official documentation before the runbook was locked.

#### Production cutover
- Guarded cutover workflow `36231139658` executed the approved Production cutover.
- Production source cutover commit: `97099d67c6a85afbcc90b797520873d9e44bb9b4`.
- Production migration ledger: `0012_order_returns.sql`.
- Active Published Products: 146.
- Baseline tracked variants: 0.
- Existing orders preserved: 4.
- Production Product Media R2 bucket: `black-sheep-product-media-prod`.
- Production Worker version: `b1a4f431-6054-4e24-a84f-ec2f663d6c2b`.
- Production runtime flags:
  - `ORDER_RESERVATIONS_ENABLED=true`,
  - `D1_PUBLIC_CATALOG_ENABLED=true`.
- Obsolete transitional `D1_COMMERCE_AUTHORITY_ENABLED` switch has been removed from current source after authority consolidation.
- Production live-commerce marker is enabled.
- Production reservation expiry Cron: `*/30 * * * *`.
- Final Cron/post-cutover remediation workflow `36231541379` — SUCCESS.
- Public catalogue parity: PASS.
- Production storefront canonical/static surface: PASS.
- Pre-cutover D1 Time Travel bookmark: `00000069-00000000-000050f2-520c7a223d69419dc3f15f11a8565f4f`.
- Final report: `docs/STOREFRONT-COMMERCE-PHASE6-PRODUCTION-CUTOVER-2026-09-26.md`.

Exit gate:
- [x] All automated Phase 6 Production cutover gates are complete.
- [ ] Owner Admin/Stock smoke + one ordinary live customer order and owner/customer notification proof remain the final Phase 6 acceptance gate.
- [x] Post-cutover backend cleanup/full regression audit `36235314026` — SUCCESS.
- [x] 33 Vitest files / 195 tests — PASS.
- [x] Basket/Checkout browser E2E, Admin browser QA, customer-review edge E2E and storefront overlay QA — PASS.
- [x] Production public D1 catalogue parity — 146 / 146 / 0 mismatches.
- [x] Search readiness — 146 products / 17 active pages / 166 sitemap URLs / 0 placeholders.
- [x] Completed one-shot backend audit workflow removed.
- [x] Cleanup report — `docs/BACKEND-AUDIT-CLEANUP-2026-09-26.md`.

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

## Phase 6 — Final owner Production acceptance

The automated Production cutover and the post-cutover backend cleanup/regression audit are complete.

Already confirmed:
1. Owner OTP/login flow works.
2. Automated Admin desktop/mobile browser QA passes.
3. Basket/Checkout staging browser E2E passes.
4. Production D1/public-catalogue parity and health gates pass.

Remaining owner acceptance:
1. Open live Production Products and Stock and confirm the normal owner workflow on the actual device you use.
2. Submit one ordinary live customer order from the Production storefront.
3. Confirm the order appears in Admin.
4. Confirm customer acknowledgement email arrives.
5. Confirm owner new-order email arrives.
6. Confirm an untracked baseline Product does not create an unexpected numeric reservation/stock movement.

Once those live-owner checks pass, mark Phase 6 CLOSED and move to Phase 7.

Repository cleanup:
- [x] seven historical non-main branches deleted by guarded cleanup workflow `36236510282`,
- [x] post-cleanup branch list contains `main` only,
- [x] temporary branch-cleanup workflow removed after success.

Do not use the saved Time Travel bookmark unless following the documented rollback matrix; legitimate post-cutover orders must be preserved.
