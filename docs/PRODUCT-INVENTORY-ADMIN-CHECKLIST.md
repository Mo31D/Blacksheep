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
- [~] iPhone photo upload QA — staging Media is live; authenticated owner upload/replace/reorder/remove smoke-test is the only remaining Phase 3 live QA.
- [x] Legacy-image coexistence — 136 live `LEGACY_REPO` records coexisted with a real temporary R2 media row while `/media/:id` returned HTTP 200; temporary R2 row/object then removed.

Exit gate:
- owner can create a complete product including imagery from Admin,
- upload / primary / reorder / alt / remove proven on real staging R2,
- iPhone Photos/camera path visually verified.

**Current status: DEPLOYED TO STAGING. Core media flows are live; only authenticated owner iPhone QA remains before Phase 3 sign-off.**

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

## Combined owner smoke-test — Phase 2 + Phase 3

Open the staging Admin on iPhone:

`https://black-sheep-commerce-api-staging.ky6vfb55p9.workers.dev/admin#products`

Use a temporary product so no real catalogue item needs to be changed:

1. **Add product** → title it `STAGING QA PRODUCT`.
2. Give it a temporary price, category and optional SKU.
3. Confirm it is a private Draft.
4. Open **Manage images**.
5. Choose an image from iPhone Photos or Camera.
6. Upload it with alt text.
7. If possible add a second image:
   - change Primary,
   - reorder,
   - edit alt text.
8. Use **Replace** on one image and confirm position / Primary state remain correct.
9. Remove one image.
10. Confirm **Audit history** records the operations.
11. Publish the Draft inside staging Product Core.
12. Archive the temporary QA product when finished.

After this owner smoke-test:
- mark Phase 2 owner mutation QA complete,
- mark Phase 3 iPhone QA complete,
- close Phase 3,
- begin **PHASE 4 — INVENTORY CORE**.

Current verified staging release:
- Phase 3 workflow `36178631127` / job `108215277892`: SUCCESS.
- Worker deployment `119d4ceb-2678-40ce-9b43-4c2ede7b3523`.
- Worker version `19e62702-1fde-48b1-802f-6dbf66e68eb3` / version number 68.
- R2 bucket `black-sheep-product-media-staging` exists in WEUR.
- real R2 delivery smoke run `36178979258`: SUCCESS / HTTP 200.
- smoke data cleaned up; bucket is empty again.
- staging Product Core remains 146 original products; inventory tracked = 0.
- Production remains migrations `0000–0008` with 3 orders.

Production remains locked:
- Product Core migration `0009` is not applied to Production.
- no Production Product Media/R2 binding exists.
- Inventory tracking remains disabled.
- storefront/checkout cutover remains a later phase.
