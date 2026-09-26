# Black Sheep — Session Handoff

> **CURRENT AUTHORITATIVE HANDOFF — 26 September 2026**
>
> Repository: `Mo31D/Blacksheep` · branch: `main`.
>
> Authoritative trackers/reports:
> - `docs/PRODUCT-INVENTORY-ADMIN-CHECKLIST.md`
> - `docs/BLACK-SHEEP-BACKEND-AUDIT-CLEANUP-2026-09-26.md`
> - `docs/FINAL-OWNER-POLISH-TICKETS-2026-09-26.md`
> - `docs/FINAL-OWNER-POLISH-2026-09-26.md`
> - `docs/CATEGORY-MANAGEMENT-2026-09-26.md`
> - `docs/STOCK-VALUE-PRODUCTION-RELEASE-2026-09-26.md`
> - `docs/STOREFRONT-COMMERCE-PHASE6-PRODUCTION-CUTOVER-2026-09-26.md`
>
> **Stock Value + mobile Add Product — LIVE Production verified, 26 September 2026**
> - owner-reported mobile overlap fixed: the sticky Cancel / Create draft bar now has sufficient safe-area/scroll clearance and no longer makes final Categories controls unreachable.
> - Add Product + Product detail now support Item cost ex VAT, product VAT rate, Supplier and Supplier product code.
> - actual cost uses existing `product_variants.cost_minor`; when absent, the clearly-labelled default estimate is retail/2 inc VAT and then VAT is removed for ex-VAT cost. Default VAT is 20%.
> - new migration `0015_stock_valuation.sql`: suppliers + variant supplier/VAT metadata + daily valuation snapshots.
> - Stock → **£ Stock value** opens a separate valuation workspace: cost value, retail value, potential gross profit, physical/sellable/reserved units, supplier/category breakdown, confidence, high-value stock, attention items and 7/30/90/365-day trend.
> - valuation history is automatically maintained through the existing 30-minute Worker cron using an idempotent one-row-per-day snapshot upsert.
> - Staging deploy `36253829542` — **SUCCESS**; 36 test files / 210 tests PASS; staging Worker `88f9833d-b1bb-4609-b0a5-43505aabb074`; no migrations pending.
> - post-deploy Staging Admin browser QA `36253997892` — **SUCCESS** for iPhone cost/supplier fields, Add Product footer clearance, Stock Value and iPad portrait.
> - guarded Production deploy `36254188859` — **SUCCESS**; Production applied previously validated `0014_category_management.sql` + new `0015_stock_valuation.sql`; no migrations pending.
> - Production Worker `1b8948d2-228c-4ec6-8803-8b45191930a2`; Production health + public catalogue PASS.
> - live Production mobile Admin smoke `36254525389` — **SUCCESS** for Add Product cost controls, footer clearance, Stock Value page/API and mobile overflow. Temporary QA session removed after the run.
> - Production valuation smoke state: 146 included tracked variants / 1,460 recorded on-hand units / 132 estimated-cost variants / 14 missing valuation / 0 actual-cost variants; valuation coverage 90.4%, actual-cost coverage 0%.
> - these stock-value numbers prove the engine is live, but are not an audited physical valuation until owner counts and real supplier costs are entered.
> - full release report: `docs/STOCK-VALUE-PRODUCTION-RELEASE-2026-09-26.md`.
>
> **Dynamic storefront publication hotfix — LIVE verified, 26 September 2026**
> - owner reproduced a real Production defect with Product `Test`: Product Core/Admin showed ACTIVE + Published, but Hawkshead Relish remained at 15 products and the item was absent from the storefront.
> - root cause: the Phase 6 live commerce layer only overlaid D1 state onto pre-existing static `assets/catalog.js` products; D1-only Products were silently ignored by storefront rendering.
> - `assets/commerce-live.js` now merges unmatched ACTIVE published D1 Products into `window.CATALOG`, supports safe catalogue pagination and resolves Admin-uploaded `/media/<id>` R2 media against the Commerce API.
> - `assets/site.js` now injects runtime Product cards into Full range / relevant range surfaces, recalculates filters/counts and supports dynamic Product URLs without changing canonical static URLs for legacy products.
> - `product.html` is now the live detail fallback for D1-only Admin-published Products; static products still redirect/use their permanent `/products/<slug>.html` pages.
> - permanent storefront regression QA `36251543339` — **SUCCESS** for D1-only Full range insertion, range placement and dynamic detail.
> - Commerce CI `36250967119` — **SUCCESS**, 35 files / 206 tests.
> - read-only live Production smoke `36251721592` — **SUCCESS** against the actual `Test` product: Production API 147 received/applied, 1 runtime-added Product, Hawkshead count 16, card £0.01, WebP image 1200×800 loaded, dynamic detail £0.01, Add-to-basket enabled and mobile overflow PASS.
> - no Production D1 mutation or Commerce Worker deploy was required for this hotfix; the Product was already correctly published in Production D1.
> - current Production public catalogue at the smoke timestamp: **147** products = previous 146 baseline + owner-created `Test`.
>
> **Category Manager — staging complete, 26 September 2026**
> - `0014_category_management.sql` persists Brand / Range, Product category and Collection / Theme instead of relying on name inference.
> - Products → Manage categories supports Add, Rename, Group change, Reorder, Archive and Restore with product usage counts.
> - Archive is deliberately non-destructive: used categories may be archived without deleting existing product relationships or rewriting published history.
> - New products cannot select archived categories; an existing product keeps an already-linked archived category during unrelated edits and shows it as `Archived` until intentionally removed or restored.
> - Owner operating rules: `docs/CATEGORY-MANAGEMENT-2026-09-26.md`.
> - Commerce CI `36249831392` — **SUCCESS**; 35 Vitest files / 206 tests.
> - staging deploy `36249871178` — **SUCCESS**; migration `0014` applied; staging Worker `7c251e43-4e2e-4b68-8453-a10e316cea7e`; health PASS.
> - post-deploy Admin Browser QA `36250012439` — **SUCCESS**, including iPhone Category Manager create/rename/group/move/archive/restore, category search and selected summary.
> - Search Readiness `36250012438` — **SUCCESS**.
> - synthetic Category Manager QA data cleaned after success.
> - Category Manager is now **LIVE on Production**. Migration `0014` was promoted during guarded Stock Value deploy `36254188859`, before `0015_stock_valuation.sql`.
>
> **Current production architecture**
> - Admin V2 is live.
> - Product Core + Inventory Core + Order Reservations + Phase 6 D1 commerce authority are live in Production.
> - Production D1 latest migration: `0015_stock_valuation.sql`.
> - Production Product Core currently contains the owner-managed live catalogue plus preserved historical/archived rows; Stock Value smoke included 146 non-archived active/default variants.
> - Production Stock Value currently reports 146 tracked variants and 1,460 recorded on-hand units; treat counts as operational data to be physically confirmed.
> - Production clean-start state: 6 pre-existing confirmed test orders preserved as hidden TEST history; 0 visible BUSINESS orders.
> - Production active/committed reservations at owner-polish cutover: 0.
> - Future Production orders default to BUSINESS.
> - Production public catalogue baseline was 146 products; after the owner published `Test`, live D1 reported 147 products during smoke `36251721592`.
> - D1 is the sole backend commerce authority; the old generated backend catalogue authority has been removed.
> - Production health + Admin reachability passed in the final backend audit.
>
> **Final backend / Admin / Basket audit — 26 September 2026**
> - workflow `36235314026` — SUCCESS.
> - final post-cleanup refresh workflow `36240828154` — **SUCCESS** on source commit `4dcadb906f2fc4a1a43e68064eddf3783437b369`.
> - cleanup commit `48bfd632344a4d7d5493503d13f830b0408ec497` removed five stale QA trigger markers and tightened Commerce CI to explicit `contents: read`.
> - dedicated post-cleanup Commerce CI `36240439223`, Search Readiness `36240439155`, Checkout E2E `36240439171`, Admin Browser QA `36240439189`, Admin V2 E2E `36240439178`, Review Edge E2E `36240439190` and Webhook E2E `36240439169` — all **SUCCESS**.
> - the final one-shot audit was removed after success at `1decb00b0b01ab1a90ca199c87cdd343a25400f9`; Search Readiness `36241123400` and Pages deployment `36241123221` then passed on the cleaned tree.
> - full `npm run check` — PASS.
> - 33 Vitest files / 195 tests — PASS.
> - Basket + Checkout real staging browser E2E — PASS.
> - Admin desktop/mobile browser QA — PASS.
> - customer-review edge-case staging E2E — PASS.
> - Storefront live-overlay browser QA — PASS.
> - Search Readiness: 146 products / 17 active pages / 166 sitemap URLs / 0 placeholders.
> - owner-confirmed OTP/login flow — PASS.
> - automated WebKit/mobile Admin QA — PASS.
> - completed one-shot audit workflow removed after success.
>
> **Final Owner Polish / clean start — 26 September 2026**
> - all automated/code tickets in `docs/FINAL-OWNER-POLISH-TICKETS-2026-09-26.md` are complete.
> - order classification is now explicit: BUSINESS / TEST / E2E.
> - Staging normal Admin/Reports show BUSINESS data by default; test/E2E data is isolated behind the Test data view.
> - Staging Reset test orders is guarded and clears test/E2E rows from owner-facing state without deleting audit history.
> - owner confirmed there were no genuine customer orders before clean start.
> - Production preflight found 6 pre-existing orders, all consistent with the owner's testing, and 0 ACTIVE/COMMITTED reservations.
> - guarded Production workflow `36245568191` applied migration `0013_order_data_class.sql`, preserved all 6 as hidden TEST history, left 0 visible BUSINESS orders, deployed the Worker and re-verified health/catalogue.
> - Production Worker version: `4b600893-2a71-40e0-8fea-9d7f4cad34dd`.
> - Production public catalogue remains 146 products.
> - final staging deploy `36245227443` — SUCCESS; staging Worker `30cac36f-516f-4902-b733-60c4eb7b6ec5`.
> - final expanded staging Admin browser QA `36245380428` — SUCCESS: desktop Orders, iPhone 2×2 Dashboard, Add Product controlled type, category search, Stocktake, Reports, iPad portrait and no owner-facing Phase/cutover copy.
> - code-level Commerce CI `36245167048` — SUCCESS.
> - Search Readiness on the cleaned final tree `36245693923` — SUCCESS.
> - temporary one-shot Production preflight/deploy workflows were removed after success.
>
> **Cleanup state**
> - stale generated backend commerce authority files removed.
> - stale Ice Cream/Romney generated builder path removed from active search/build flow.
> - no TODO/FIXME/HACK markers found in active Commerce runtime/scripts during the final audit.
> - runtime import scan found no obvious orphan `commerce/src` module.
> - Draft PR #7 is closed and must not be merged.
> - historical branches `commerce-v1-catalog`, `commerce-v1-pricing`, `commerce-v1`, `exact-local-v2`, `recovery/black-sheep-work-2026-09-23`, `restore-local-exact`, and `romneys-rebuild-2026-09-24` were deleted by guarded cleanup workflow `36236510282`.
> - post-cleanup branch list: `main` only.
> - final repository-bloat cleanup removed 170 proven-unused legacy placeholder PNGs; Search Readiness + full Commerce regression passed in workflow `36237983836`.
> - exact placeholder blob `36b57af455721db234911805d3276eaba3ae5bfa` is no longer tracked anywhere on `main`; `images/110.png` was not part of that blob and was retained.
>
> **Cloudflare access note**
> - the direct Cloudflare ChatGPT connector was unavailable in the cleanup session.
> - GitHub Actions Cloudflare credentials were available and the final audit performed read-only Production D1 / health / public-catalogue verification successfully.
>
> **Next work**
> - Stock Value + Category Manager are live on Production; no promotion step remains for migrations `0014`/`0015`.
> - owner data-quality work is now the useful next Stock Value task: confirm physical quantities, enter real supplier costs, and assign supplier names/codes. The report will automatically replace estimates and raise actual-cost coverage.
> - owner real-device Production smoke is still outstanding for the broader Final Owner Polish / order/email flow: submit one ordinary live order, confirm it appears under Business Orders, confirm customer + owner emails, and verify inventory behavior for the chosen product.
> - after that broader smoke passes, mark the Final Owner Polish / Phase 6 owner acceptance closed.
> - do not revive old Commerce V1 branches or generated backend catalogue authority.
> - use D1 Product Core / Inventory Core as the backend source of truth.
> - for future changes, keep Commerce CI + Search Readiness green and run the targeted staging browser/E2E workflow for the affected surface.
> - keep `main` as the only active branch unless a new isolated task explicitly needs another branch.
>
> The sections below are retained as historical implementation evidence. When a historical note conflicts with this header, this header is authoritative.
>
> **PRODUCT / INVENTORY — PHASE 4 INVENTORY CORE LIVE ON STAGING**
> - Phase 1 Product Core: COMPLETE.
> - Phase 2 Product Editor + Duplicate + Archive: COMPLETE ON STAGING.
> - Phase 3 Product Media + R2 + owner iPhone smoke-test: COMPLETE ON STAGING.
> - Phase 4 Inventory Core: COMPLETE ON STAGING.
> - Inventory migration: `0010_inventory_core.sql`.
> - Stock workspace: deployed with Initial Count, Adjust, Physical Count, threshold, history and Stocktake.
> - Product ↔ Stock deep-links are deployed.
> - release evidence: `36183361766`, `36183967251`.
> - independent real-staging mutation proof: PASS.
> - QA sequence: Initial 10 → threshold 3 → Damage -2 → Physical Count 9 → Stocktake 8 → Archive.
> - final QA balance: On hand 8 / Reserved 0 / Available 8.
> - QA ledger: 4 immutable movements; deployed UPDATE/DELETE triggers directly verified.
> - active tracked variants after QA archive: 0.
> - staging totals now include 148 products = 146 imported + 2 archived QA products.
> - Production remains `0000–0008`, no Product/Inventory tables; current verified order count is 4.
> - Owner QA exposed two UI defects which are now fixed on staging: OTP verification now reloads the authenticated Admin document, and iPad portrait Orders/Products/Stock detail opens as an immediate overlay up to 900px instead of below the list.
> - UX fix source: `950849a3a1f66b52546d959f33182f1ecc531596`; Commerce CI `36187771624` SUCCESS; staging release `36187771688` SUCCESS.
> - Current staging deployment after UX fixes: `6d89ff4c-f1d8-4552-83f1-7cf8113c5a4c`; Worker version `cf42c03a-0371-47c5-a1a7-bde6980f7dd5`.
> - Owner confirmed the corrected OTP login + iPad portrait master/detail re-test passed on 25 September 2026; the Phase 4 owner UX gate is closed.
> - Phase 5 Order Reservations is COMPLETE + REAL-STAGING VERIFIED.
> - Phase 5 staging release workflow `36195902160` — SUCCESS.
> - staging migration ledger now through `0012_order_returns.sql`.
> - staging Worker version `c591003d-ab57-45dd-ba3c-abc302c61b79`.
> - staging reservation expiry cleanup cron: `*/30 * * * *`.
> - real-staging QA run `3f6f4cfa6b`: collection, delivery, insufficiency rollback, untracked compatibility, decline, supersede, expiry, cancellation and explicit Return-to-stock all PASS.
> - one-unit / two-orders concurrency proof: exactly one winner.
> - retained QA movement evidence: ORDER_RESERVATION 8 / RESERVATION_RELEASE 6 / SALE 2 / RETURN 1.
> - post-proof live QA authority: 0 ACTIVE/COMMITTED holds, 0 QA balances, 0 active/tracked QA variants.
> - temporary Phase 5 QA Worker deleted.
> - Production remains `0000–0008`, no Product/Inventory/Reservation tables, no reservation flag and no cron; current verified order count is 4.
> - read:
>   - `docs/INVENTORY-CORE-PHASE4-STAGING-2026-09-25.md`
>   - `docs/INVENTORY-CORE-PHASE4-MUTATION-PROOF-2026-09-25.md`
>   - `docs/ORDER-RESERVATIONS-PHASE5-IMPLEMENTATION-PLAN-2026-09-25.md`
>   - `docs/ORDER-RESERVATIONS-PHASE5-STAGING-RELEASE-2026-09-25.md`
> - tracker: `docs/PRODUCT-INVENTORY-ADMIN-CHECKLIST.md`
>
> **PHASE 6 STOREFRONT / COMMERCE — READY FOR PRODUCTION CUTOVER APPROVAL**
> - implementation plan: `docs/STOREFRONT-COMMERCE-PHASE6-IMPLEMENTATION-PLAN-2026-09-25.md`.
> - staging foundation report: `docs/STOREFRONT-COMMERCE-PHASE6-STAGING-FOUNDATION-2026-09-25.md`.
> - publication report: `docs/STOREFRONT-COMMERCE-PHASE6-PUBLICATION-2026-09-26.md`.
> - Production cutover runbook: `docs/STOREFRONT-COMMERCE-PHASE6-PRODUCTION-CUTOVER-PLAN-2026-09-26.md`.
> - final readiness report: `docs/STOREFRONT-COMMERCE-PHASE6-PRODUCTION-READINESS-2026-09-26.md`.
> - milestones 6.1–6.6: COMPLETE + REAL-STAGING/BROWSER/PUBLICATION VERIFIED.
> - Phase 6.7 readiness: COMPLETE; Production cutover execution NOT performed.
> - public D1 routes on staging: `GET /v1/catalog` and `GET /v1/catalog/:id`.
> - exact generated-static vs D1 parity: 146 / 146 / 0 mismatches.
> - staging checkout D1 authority + tracked-stock proof: PASS.
> - storefront overlay Chromium + WebKit/mobile proof: PASS.
> - Phase 6.6 deterministic publication package:
>   - 146 Products,
>   - 162 files,
>   - SHA-256 `61d0b5f8cd4e038d3d6b38fff8bda77fe1bd491fc7f6c796ac59089522d7c3f7`,
>   - added 0 / changed 162 / deletions 0 / unsafe slug removals 0.
> - Admin Add → Publish → static candidate → Archive E2E: workflow `36229294654` SUCCESS.
> - final guarded Production readiness workflow `36230644182` — SUCCESS.
> - readiness simulation applied the exact 162-file package + future Production Worker flags/R2/cron/live marker only inside the ephemeral CI runner, then:
>   - full Commerce validation PASS,
>   - 35 Vitest files PASS,
>   - migration upgrade / Inventory / Reservation / cart / legal / typecheck gates PASS,
>   - simulated Production Worker dry-run PASS,
>   - real Production remained unchanged after the audit.
> - frozen Phase 1 catalogue baseline is now `commerce/fixtures/product-core-baseline.catalog.js`; historical import/parity no longer depend on the mutable live `assets/catalog.js`.
> - guarded Production Product importer/parity commands are prepared; Production import requires literal confirmation and refuses a non-empty Product Core.
> - Production publication export can regenerate the package read-only from Production D1 after import and must match the approved SHA before authority activation.
> - deterministic activation script: `commerce/scripts/phase6-production-activate.mjs`.
> - unsafe legacy generic Production deploy path is blocked; staging deploy remains available.
> - dedicated manual-only cutover workflow: `.github/workflows/phase6-production-cutover.yml`.
> - cutover workflow requires:
>   - `confirmation=CUTOVER-PRODUCTION-D1`,
>   - approved 64-character package SHA,
>   - unchanged `main`,
>   - D1 Time Travel bookmark,
>   - migrations `0009–0012`,
>   - initial 146-Product import + Production parity,
>   - Production-generated publication SHA match,
>   - Production Worker/public API/storefront post-gates.
> - failure path never auto-restores D1; the saved Time Travel bookmark is used only according to the rollback matrix because a blind restore could erase legitimate post-cutover orders.
> - current Production remains intentionally pre-cutover:
>   - migration `0008_concurrency_guards.sql`,
>   - Product/Inventory/Reservation tables absent,
>   - all Phase 6 flags absent,
>   - Production live-commerce marker `false`,
>   - generated static catalogue still checkout authority,
>   - readiness snapshot order count 4.
>
> **PHASE 6 PRODUCTION CUTOVER — EXECUTED 26 September 2026**
> - owner approved the cutover.
> - guarded workflow `36231139658` executed migrations/import/source activation/Worker deploy/public parity.
> - source cutover commit: `97099d67c6a85afbcc90b797520873d9e44bb9b4`.
> - Production Worker version: `b1a4f431-6054-4e24-a84f-ec2f663d6c2b`.
> - Production migration ledger: `0012_order_returns.sql`.
> - 146 Active Published Products; baseline tracked variants 0; 4 pre-existing orders preserved.
> - Production R2: `black-sheep-product-media-prod`.
> - Production flags: reservations/public catalogue/D1 commerce authority enabled.
> - Cron `*/30 * * * *` was applied after the original verifier exposed a Cloudflare response-shape mismatch.
> - final Cron/runtime/public parity/storefront/canonical remediation workflow `36231541379` — SUCCESS.
> - pre-cutover Time Travel bookmark: `00000069-00000000-000050f2-520c7a223d69419dc3f15f11a8565f4f`.
> - final report: `docs/STOREFRONT-COMMERCE-PHASE6-PRODUCTION-CUTOVER-2026-09-26.md`.
>
> **NEXT WORK: final owner Production smoke only.**
> Log into live Admin, verify Products/Stock, submit one ordinary live order request, confirm it appears in Admin, and confirm both customer and owner Resend notifications. After that mark Phase 6 CLOSED.

> **Do not rerun migrations `0003–0008`. Any future Worker deployment must correspond to an intentional new runtime/catalogue change and pass Commerce CI first.**

---

## Historical archive

> **COMMERCE UI WORK IN PROGRESS — DO NOT MERGE YET**  
> Customer-facing Phases 6–9 are implemented on branch `commerce-v1` and tracked in draft PR #7. The branch contains the Mini Basket, `basket.html`, checkout delivery/collection flow, Turnstile, API submission/idempotent retry, and `order-requested.html`. Latest branch Commerce CI is green. Keep the live `main` storefront unchanged until one real staging Turnstile/order submission is verified and the remaining launch/operations/legal phases are ready.

> **COMMERCE PHASE 4 — CURRENT STATE**  
> Secure order API is merged to `main` at `10c523439d18464ea4a668ac460c05727d065c65`. `POST /v1/orders` now has strict validation, server-authoritative pricing, UUID idempotency, readable order references, Turnstile Siteverify integration, rate limiting and atomic D1 persistence. Commerce CI passed with 32 tests. Live staging submission is intentionally blocked until the staging Worker secret `TURNSTILE_SECRET_KEY` is configured, then one real staging order + idempotent retry must be verified before Phase 5.

> **COMMERCE V1 — ACTIVE NEXT PHASE**  
> Phase 1 Worker foundation is complete and staging health is verified.  
> Phase 2 D1 order persistence is complete on staging; production D1 remains untouched.  
> Phase 3 server-authoritative catalogue/pricing is complete and CI passes.  
> Turnstile widget `Black Sheep Checkout` is created; site key is recorded.  
> **Next:** store the Turnstile secret directly as a Cloudflare Worker secret, then implement Phase 4 `POST /v1/orders` with server-side Turnstile verification, idempotency and D1 persistence.
>
> **NEXT-PHASE BASELINE — 24 September 2026**  
> Before relying on older counts/status sections below, read:
> - `docs/NEXT-PHASE-BASELINE-2026-09-24.md`
> - `docs/NEXT-PHASE-EXECUTION-FRAMEWORK-2026-09-24.md`
>
> Those files record the verified 146-product baseline and the execution rules for the next major phase. GitHub `main` remains authoritative.

Updated: 24 September 2026

Latest verified implementation milestone: `70100a0a8e1ed8053c9708f0e640ac3e530dfc4b` plus current image reconciliation (12 exact Hawkshead product images, two dual-image galleries; documentation commit may be newer)

This is the short handoff file for ChatGPT, Work/Sites, Codex, or any future session. Read this before making changes.

## Authority

- Repository: `Mo31D/Blacksheep`
- Branch: `main`
- GitHub `main` is the primary source of truth.
- The user is continuing the project directly and does **not** depend on recovering the previous Work-local tree.
- Never force-push over newer work.
- Work/Sites may rejoin later, but it must sync from current GitHub and follow this handoff/checklist rather than relying on its old local state.
- Do not create a duplicate Sites project. Synchronize only when the exact existing Black Sheep Sites project is identified.

## Required session procedure

At the start:
1. Fetch latest `main`.
2. Read:
   - `docs/WORK-CHECKLIST.md`
   - `docs/SESSION-HANDOFF.md`
   - `docs/OWNER-REQUESTS.md`
   - `docs/HIGHLAND-COW-SOURCE-MAP.md`
3. Inspect recent commits before editing.

During work:
1. Work in small milestones.
2. Validate each milestone.
3. Commit and push each completed milestone to `main`.
4. If an external image/manual asset is needed from the user, provide:
   - direct/source page link,
   - exact file to download,
   - exact new filename,
   - exact repository folder,
   - whether to crop/remove background/convert to WebP.
5. Do not guess owner prices or product identities.

At the end:
1. Update `docs/WORK-CHECKLIST.md`.
2. Replace the “Latest completed work” and “Exact next action” sections below.
3. Record the final commit SHA.
4. State any unresolved blockers explicitly.

## CRITICAL LATEST HANDOFF — Hawkshead exact imagery, 24 September 2026

- Exact owner-supplied WebP imagery is wired for **HR-001 through HR-012**.
- HR-001 The Original Black Garlic Ketchup and HR-008 Five Fruit Marmalade each have a **two-image gallery**: pack-shot + lifestyle.
- Their Open Graph image, Product JSON-LD image list, WebPage primary image, collection cards, Full range cards and sitemap image entries all use the exact files.
- HR-013 Bloody Mary Chutney, HR-014 Honeycomb Honey, HR-015 Cumberland Sauce and HR-016 Cheeseboard Chutney still use `images/49.png` because no exact product image has been supplied.
- All Product Information disclosures remain open by default.
- Search-readiness now rejects image/schema/card/gallery drift for these Hawkshead products.
- The accidental two-byte upload `images/hawkshead-relish/1` is removed in this reconciliation.

## CRITICAL LATEST HANDOFF — Hawkshead owner pricing update, 24 September 2026

- GitHub `main` remains authoritative.
- Verified implementation commit: `bba82641f56c160e0d48f563b64f12b924fa078d`.
- Current catalogue: **123 products total** = 41 Gifts + 12 Luxury Lakes Ice Cream + 55 Romney's/confectionery + **15 Hawkshead Relish**.
- Hawkshead Relish: **14 owner-priced products**; Red Onion Marmalade remains the only active Hawkshead product without a confirmed numeric price.
- Added exact products and official detail data: Bloody Mary Chutney (£5.70), Honeycomb Honey (£7.95), Cumberland Sauce (£4.70), Cheeseboard Chutney (£5.30).
- Owner-confirmed existing prices: The Original Black Garlic Ketchup £6.80; Traditional English Mustard £3.60; Raspberry & Vanilla Jam £4.30; Strawberry & Black Pepper Jam £4.30; Damson Extra Jam £4.30; Five Fruit Marmalade £4.30; Beetroot & Horseradish Chutney £5.30; Piccalilli £5.30; Westmorland Chutney £5.30.
- Official product names are retained even where the owner's shorthand differs.
- All Hawkshead Product Information `<details>` remain open by default.
- Sitemap target: **141 URLs** = 17 active non-product pages + 124 static product pages.
- Search readiness passed for the implementation commit.

### Exact next action
1. Preserve the 124-product static architecture and the 16-product Hawkshead collection.
2. Do not infer prices for Bloody Mary Ketchup, Red Onion Marmalade or Hot Garlic Pickle; wait for owner confirmation.
3. Replace shared Hawkshead range imagery with exact individual pack-shots when available.
4. Sync the same existing Black Sheep Sites project only when its exact identity is known, then perform live QA.

## CRITICAL LATEST HANDOFF — Hawkshead Relish catalogue, 24 September 2026

**This section supersedes older catalogue-count and Hawkshead-status notes below.**

- GitHub `main` remains authoritative.
- Verified implementation commit: `80f88e98bb07b318422f7faf011e165a738dc9fa`.
- Current catalogue: **120 products total** = 41 Gifts + 12 Luxury Lakes Ice Cream + 55 Romney's/confectionery + **12 Hawkshead Relish**.
- Current sitemap: **137 URLs** = 17 active non-product pages + 120 canonical static product pages.
- Hawkshead Relish now has 12 canonical static pages under `products/hr-*.html`, plus 12 prerendered cards in `hawkshead-relish.html` and 120 cards in Full range.
- Exact manufacturer names, pack sizes and available factual product information were checked against the current Hawkshead Relish website. Internal provenance is recorded in `docs/HAWKSHEAD-RELISH-SOURCE-MAP.md`.
- Public pages do **not** expose the supplier-shop URLs or manufacturer retail prices. No numeric Black Sheep price was invented; the 12 products currently display as an **in-store range** until owner pricing is supplied.
- Ingredients, allergens, dietary facts, nutrition, storage and relevant warnings are included where the current official product page exposed them. For Five Fruit Marmalade, incomplete regular-jar ingredient/nutrition data was intentionally not invented.
- Initial Hawkshead product imagery uses the existing genuine range photograph `images/49.png`; it is explicitly treated as range imagery, not an individual pack-shot.
- `scripts/verify-search-readiness.mjs` now treats Hawkshead Relish as a first-class prerendered collection and checks source provenance plus the rule against inferred supplier pricing.
- GitHub Actions **Search readiness** passed for the implementation commit.

### Exact next action
1. Keep newest GitHub `main` as source of truth; do not restore an older Work/Sites copy.
2. If the owner supplies Black Sheep prices for these 12 Hawkshead products, add those prices only from owner confirmation.
3. Individual product pack-shots can replace the shared genuine range image when exact images are available; do not substitute unrelated or generated product imagery.
4. Sync/publish to the **same existing Black Sheep Sites project** only when its exact identity/URL is available; do not create a duplicate.
5. Perform live mobile + desktop QA after deployment, including Hawkshead collection filters, product pages, My List, Full range and sitemap/canonical behavior.
6. Resolve remaining Romney's identity/weight questions only from exact evidence. Search Console/live indexing remains separate from repository QA.

## CRITICAL LATEST HANDOFF — Romney's rebuild, 24 September 2026

**This section supersedes older Romney's/source-link notes below.**

- GitHub `main` remains authoritative. The validated rebuild was prepared from authoritative main `99016db84e88e001f26374ed107c2b37a9fd4ccd`.
- Current curated catalogue: **109 products total** = 41 Gifts + 12 Luxury Lakes Ice Cream + **56 Romney's/confectionery**.
- Current sitemap target after rebuild: **126 URLs** = 17 active non-product pages + 109 static product pages.
- Romney's/confectionery provenance is internal in `docs/ROMNEYS-SOURCE-MAP.md`; public product pages must **not** link to supplier/manufacturer shops or expose supplier retail prices.
- Current static generator: `scripts/build-romneys.mjs`; source-map generator: `scripts/build-romneys-source-map.mjs`; optional factual/image sync tool: `scripts/sync-romneys-official-data.py`.
- Search-readiness CI now also runs `node scripts/build-romneys.mjs --check`.
- **37** Romney's-section records are matched to exact current manufacturer pages; **36** exact official local images are retained/generated. Unmatched records remain explicitly unmatched rather than being guessed.
- Added exact **Shortbread Selection 300g — £7.50**.
- Owner pricing now includes: 200g biscuit bags £2.99; 150g fudge bags £3.85; fudge bar £2.40; White Kendal Mint Cake 85g £1.50; White/Brown/Extra Strong 170g/Large £2.80; Giant White 480g £4.70; Triple Pack 227g £4.90; Cinder Toffee £3.30; Chocolate Coated Cinder Toffee £3.50; Peanut Brittle £2.10; Pink & White Nougat £2.70.
- Pending exact identity — do not guess: Twin Biscuit Sachets £6.90; Boxed Fudge 150g £4.90; Chocolate Covered Kendal Mint Cake Small/Medium/Large; Large Rock £2.80; Postcard Boxes £4.95.
- Full report: `docs/WORK-REPORT-ROMNEYS-REBUILD-2026-09-24.md`.
- Final staging QA: **109 products, 17 active pages, 126 sitemap URLs; builder drift check passed**.
- The malformed appended duplicate catalogue tails in `romneys.html` and `all-products.html` were removed and the builder now prevents their recurrence.

### Exact next action
1. Use newest GitHub `main`; do not restore older Work/Sites state.
2. Sync/publish to the **same existing** Black Sheep Sites project only when its exact project identity is available.
3. Perform live mobile + desktop QA after deployment.
4. Resolve pending Romney's identities only from exact packaging/photo/weight evidence.
5. Search Console/live indexing review remains separate from repository QA.

## CRITICAL LATEST HANDOFF — post-SEO/search rebuild, 23 September 2026

**Work/Sites: fetch the newest GitHub `main` before doing anything. Do not restore an older Work-local copy over GitHub.**

The repository was substantially upgraded today for Google/Search/AI readability while preserving the Black Sheep design and the current curated catalogue.

### Search architecture now in production source
- The canonical product architecture is now **109 static HTML product pages** under `products/<slug>.html`.
- Do **not** restore `product.html?type=...&slug=...` as the indexable product architecture. That file is legacy-only, has `noindex,follow`, and redirects old visitors to the static URL.
- Every static product page contains its customer-facing H1, description, primary image, verified product facts, canonical URL and JSON-LD directly in source HTML. Product indexing no longer depends on client-side rendering.
- Product/collection links now point directly to `/products/<slug>.html`.
- Active collection pages contain prerendered product cards/links in source HTML. Shared JS enhances filtering and My List but preserves prerendered catalogue content instead of rebuilding it.
- Current catalogue remains **109 products total: 41 Gifts (29 Peter Rabbit + 12 Highland Cow), 12 Luxury Lakes Ice Cream, 56 Romney's/confectionery**.
- Hawkshead Relish remains an informational in-store range page with no invented individual products.

### Structured data / entity layer
- Static product pages use a linked JSON-LD graph containing `Store`, `WebSite`, `WebPage`, `BreadcrumbList` and `Product`.
- Product collection pages use `Store`, `WebSite`, `CollectionPage` and `ItemList`.
- About uses `AboutPage`; Visit uses `ContactPage`.
- The entity graph uses stable production URLs and the real Black Sheep shop/address/telephone/Facebook identity.
- Do not add ecommerce `Offer`/checkout claims unless the site actually gains a genuine online purchase flow. Current availability language intentionally describes in-store stock truthfully.

### Indexing / discovery
- `sitemap.xml` now contains **126 URLs**: 17 active non-product pages + 109 static product URLs.
- The sitemap currently contains **115 image entries** and **zero legacy query product URLs**.
- `robots.txt` points to the production sitemap.
- Active pages use self-referencing canonicals and `index,follow,max-image-preview:large`.
- `404.html` is `noindex,follow`.
- Retired empty routes remain `noindex` shells with canonical/redirect handling. Do not bring them back as thin pages.

### Important live/mobile bug found and fixed
Owner screenshots taken after the SEO changes showed raw text above the page such as:
`property="og:image" content="https://theblacksheepshop.co.uk/images/1.png"`

Cause: malformed Open Graph markup in compact HTML pages.

This was audited across **all 17 active HTML pages and fixed everywhere**. Each active page now has:
- exactly one valid absolute `og:image` meta tag,
- one `og:image:alt`,
- one `twitter:card=summary_large_image`,
- no stray visible `og:image` fragment.

Do not reproduce the previous regex/meta transformation that dropped the opening `<meta` tag.

### Automated regression protection
- `scripts/verify-search-readiness.mjs` verifies catalogue uniqueness, active-page canonicals/robots/entity graphs, valid social metadata, parseable JSON-LD, all static product pages, product/image file references, sitemap consistency, raw collection links, ItemList graphs, legacy redirects and the 404 policy.
- `.github/workflows/search-readiness.yml` runs this verification on pushes to `main` and pull requests.
- Preserve and extend these checks whenever changing catalogue/SEO architecture.

### What Work should do next
1. Fetch newest remote `main` and treat it as source of truth.
2. Sync **the same existing Black Sheep Sites project** from this GitHub state; never create a duplicate Sites project.
3. After deployment, perform live mobile + desktop visual QA, specifically confirming there is no metadata text above the top bar on Gifts, Peter Rabbit, Highland Cows, Ice Cream, About and Visit.
4. Preserve the 109-product static URL architecture, prerendered collection HTML, schema graphs, sitemap and CI checks.
5. Do not re-add removed placeholder products/categories or old nested Gifts navigation.
6. If Search Console access for Black Sheep becomes available, verify sitemap ingestion, indexing/canonical selection and real search performance from GSC. Do not infer ranking from repository checks alone.
7. Google Maps/360 imagery work and exact Sites synchronization remain separate follow-up tasks.

### Current repository QA summary
- Catalogue: 109 records; 0 duplicate IDs, slugs or non-empty SKUs in the current audit.
- Sitemap: 126 URLs; 109 product URLs; 111 image entries; 0 legacy query product URLs.
- All 17 active core pages: canonical present, index policy present, JSON-LD parses successfully.
- All active pages: corrected social metadata; no malformed visible `og:image` fragment.
- Representative Peter Rabbit, Highland Cow, Ice Cream and Romney's product pages: one H1, one canonical, valid JSON-LD graph including Product/BreadcrumbList, one og:image and one Twitter card.
- GitHub `main` remains authoritative. Preserve newer commits and never force-push.

## Latest completed work

- Added 12 exact Hawkshead Relish products from the owner-supplied range: The Original Black Garlic Ketchup, Bloody Mary Ketchup, Traditional English Mustard, Raspberry & Vanilla Jam, Strawberry & Black Pepper Jam, Damson Extra Jam, Red Onion Marmalade, Five Fruit Marmalade, Beetroot & Horseradish Chutney, Hot Garlic Pickle, Piccalilli and Westmorland Chutney.
- Added canonical static product pages under `products/hr-*.html`, with Product/Breadcrumb/WebPage/Store schema, open product-information sections, My List support and in-store availability language.
- Rebuilt `hawkshead-relish.html` as a real 12-product collection with category filters and ItemList schema.
- Added Hawkshead Relish to Full range and updated Full range to 120 product cards.
- Updated `sitemap.xml` to 137 URLs and extended search-readiness checks for Hawkshead collection counts, internal source mapping and no inferred supplier pricing.
- Added `docs/HAWKSHEAD-RELISH-SOURCE-MAP.md` with all 12 exact official source URLs.
- Did not import manufacturer retail prices as Black Sheep prices.
- Search readiness passed on implementation commit `80f88e98bb07b318422f7faf011e165a738dc9fa`.

## Important owner pricing already recorded

Examples:
- standard matching single Highland Cow ornaments: £9.50
- Highland Cows With Umbrella: £11.00
- red couple: £13.99
- tartan couple: £13.99
- home-message plaque: £28.99
- Hughie Highland Cows True Love: £15.99
- Highland Cow Trio: £14.95
- set of 6 Highland Cow baubles: £9.90
- Christmas items: see `docs/HIGHLAND-COW-SOURCE-MAP.md`

Do not publish the £26.99 HOME / LOVE / FAMILY price until its exact scope is confirmed.

## Exact next action

Continue from the newest GitHub `main`.

Priority:
1. Do not redesign/restart. Preserve the current Black Sheep visual system and 109-product catalogue.
2. Sync the exact existing Black Sheep Sites project from GitHub when its identity/URL is available; GitHub is newer and authoritative.
3. Re-test the deployed domain on mobile and desktop after publish, especially the top of every page after the repaired Open Graph metadata.
4. Preserve static `/products/<slug>.html` pages and prerendered collection HTML; do not revert to JS-only indexable content.
5. Preserve Product/Breadcrumb/ItemList/Store/WebSite schema, sitemap, robots and the search-readiness CI workflow.
6. Keep LP75453 Loo-Time and LP75454 Soaking without guessed prices until owner confirmation.
7. Google Maps/360 imagery, Black Sheep Search Console analysis and external local-authority work remain follow-up items.

Current repository QA status: **no blocking repository issue found after the post-SEO audit and social-metadata repair.** Live deployment verification is still required after the hosting layer republishes the newest main.

## Navigation update — 23 September 2026

- Gifts & Souvenirs is now a direct top-level navigation link on desktop and mobile.
- The previous desktop dropdown and mobile nested gift submenu are intentionally disabled/removed at runtime.
- Gift-category navigation now lives inside `gifts.html`: search, a 10-option selector (All + 9 current collections) and compact quick filters.
- Preserve the Black Sheep visual system; do not restore the old crowded nested menu unless the owner explicitly requests it.

## Catalogue cleanup — 23 September 2026

- Owner instructed that only fully updated products should remain visible.
- Removed all remaining placeholder/unmodified gift records, all placeholder Hawkshead Relish product records and all placeholder Lakeland Fragrances product records.
- Retained catalogue totals: 41 Gifts (29 Peter Rabbit + 12 Highland Cow), 12 Ice Cream and 56 Romney's.
- Post-cleanup QA: 109 retained product records total; every retained record has a real existing image and a description; zero placeholder-image records remain; zero duplicate IDs, slugs or SKUs.
- Empty gift-category links were removed from the Gifts browser/runtime navigation. Do not re-add removed placeholder products unless the owner explicitly requests and supplies/approves real images and proper descriptions.

## Gifts landing compacted — 23 September 2026

- The Gifts page intro was shortened substantially.
- Mobile now hides the large gifts hero image so category controls appear much sooner.
- Hero copy changed to “Find something to take home.” with a single short supporting sentence.
- The large “Explore the range” block was replaced by a compact results bar with a live visible-product count.
- Search, collection selector and quick filters remain the primary navigation pattern inside Gifts.

## My list + Full range — 23 September 2026

- Added a lightweight persistent "My list" feature inspired by Lakeside Picnic.
- My list is a pre-visit planning list only: no checkout, payment or online ordering.
- A compact My list button with item count is injected into the shared header on every active page.
- Product cards and product detail pages now support Add to My list.
- The list is stored locally in the browser, supports quantity changes/removal/clear, and opens in a Black Sheep-styled side drawer.
- Added a "Full range" link directly to desktop and mobile source navigation, with shared JS retaining a defensive no-duplicate fallback.
- Updated Full range to the current curated catalogue only: 109 products total (41 gifts, 12 ice cream, 56 Romney's); removed stale Hawkshead/Fragrances filters and copy.
- Preserve this as a lightweight pre-visit feature; do not turn it into checkout unless the owner explicitly asks.

## Deep technical audit — 23 September 2026

- Audited every runtime HTML page, the full catalogue, shared JS/CSS, local links/assets, robots/sitemap and current project documentation.
- Active HTML has no broken local href/src references, duplicate IDs found in the audit, obsolete nested Gifts markup, or links to retired empty gift pages.
- Retired empty routes redirect with noindex; current category copy was aligned to actual retained products.
- Fixed decorative-chip filter collision, stale My list entries, product metadata/canonical updates and mobile-menu aria-expanded state.
- Replaced large collection-card/category-hero PNG usage with existing real product WebPs where practical.
- Added production sitemap and robots declaration.
- Known remaining non-blocking debt: many unused historical numbered PNG placeholder files and restore/b64 artifacts still exist in the repository; they are not referenced by the active catalogue.

## Latest continuation: official Lakes rebuild — 2026-09-23

Read `docs/WORK-REPORT-ICE-CREAM-2026-09-23.md` first for the current checkpoint and unresolved work, and `docs/LAKES-ICE-CREAM-SOURCE-MAP.md` for all manufacturer/image provenance. GitHub main remains authoritative. The rebuilt range has Plum & Damson instead of Pistachio, 12 exact official photos, verified factual details, static pages and deterministic reconciliation. Run `node scripts/build-icecream.mjs --check` as well as the existing search-readiness verifier. No duplicate Sites project was created; Black Sheep was not returned by owner/editor discovery. Older dirty Work edits must not be restored over main.

## Romney's product-page rebuild — 24 September 2026

Read `docs/WORK-REPORT-ROMNEYS-2026-09-24.md` and `docs/ROMNEYS-SOURCE-MAP.md` before changing confectionery data.

- Current Romney's/confectionery catalogue: **56 products**; full catalogue: **109 products**.
- Static canonical product pages remain under `/products/<slug>.html`; do not return to query-string product pages.
- All 56 confectionery pages are generated/reconciled by `scripts/build-romneys.mjs`.
- `scripts/build-romneys-source-map.mjs` regenerates internal provenance documentation.
- `scripts/verify-search-readiness.mjs` now rejects public supplier-link leakage, brand/schema mismatches, collection-card drift and duplicate official-image provenance.
- **Manufacturer/supplier URLs are internal provenance only.** Do not show “Manufacturer source”, supplier buttons, supplier image links, or Product JSON-LD `sameAs` supplier URLs on customer pages.
- Black Sheep owner prices are authoritative. Never import supplier retail prices.
- Current exact official/manufacturer mappings: **37**.
- Current catalogue records using local exact official product images: **27**.
- Nine shared/generic Shopify `og:image` candidates were deliberately rejected; those products keep their existing Black Sheep images rather than using a misleading generic image.
- New exact product: **ROM-056 Shortbread Selection 300g — £7.50**, SKU `5022259602779`.
- Owner-confirmed 170g White/Brown/Extra Strong Kendal Mint Cake price remains **£2.50**.
- **ROM-035 Giant White 480g is not the owner’s chocolate-covered Large size**; it remains **£2.70** rather than £4.70.
- Triple Pack is **£4.90**.
- The verified 113g Chocolate Covered Kendal Mint Cake keeps its existing price until the owner maps Small/Medium/Large to exact weights.
- Dubai Chocolate is **Elit**. ROM-054 and ROM-055 are **Walker's Nonsuch**.
- 19 current catalogue records remain unmatched to an exact current official page; do not force-match similar products.
- Twin Biscuit Sachets £6.90, Boxed Fudge 150g £4.90, Postcard Boxes £4.95, Rock size mapping and Chocolate Covered Small/Medium/Large mapping remain owner-confirmation items.
- Final main QA passed on `08817788b722cbb6ad675f331ff4f8532e2a0c74`: **109 products, 17 active pages, 126 sitemap URLs**; search-readiness, Ice Cream builder `--check`, and Romney builder `--check` all passed. GitHub Pages deployment also succeeded.
- Exact existing Black Sheep Sites project is still unresolved; **no duplicate Sites project was created**.

### Exact next action

1. Continue from newest GitHub `main`; preserve the 120-product static architecture.
2. Add Hawkshead Black Sheep prices only when owner-confirmed.
3. Replace shared Hawkshead range imagery with exact individual pack-shots when available.
4. Sync the same existing Black Sheep Sites project when its exact identity is available, then run live mobile/desktop QA.
5. Keep remaining Romney identity/weight questions evidence-only; do not guess.

### Hawkshead stock correction — 24 September 2026
- Bloody Mary Ketchup: £4.70, out of stock.
- Hot Garlic Pickle: £5.30, out of stock.
- Five Fruit Marmalade removed from the active catalogue and static product route.
- Active catalogue total: 123 products; Hawkshead: 15.

### Hawkshead imagery completion — 24 September 2026
- Owner uploaded exact images for HR-013 Bloody Mary Chutney, HR-014 Honeycomb Honey, HR-015 Cumberland Sauce and HR-016 Cheeseboard Chutney.
- All 15 active Hawkshead products now use exact owner-supplied product imagery; none relies on the shared range image for its main card/product image.

### Product-first catalogue UX — 24 September 2026
- Romney's, Hawkshead Relish and Full range now use one compact catalogue architecture: short title/count, minimal filters, then products immediately.
- Removed the large catalogue hero/range-note/instructional layers from these three routes.
- Full range keeps search; brand pages use compact horizontal filter chips.
- Product cards are whole-card clickable, the redundant View action is removed/hidden, and price/stock hierarchy is standardized.
- Brand repetition is suppressed on brand-specific catalogue grids; Full range retains category context.
- Product detail runtime cleanup removes duplicate price rows, duplicate manufacturer=brand rows, internal verification copy, and shortens availability to Check in store / Out of stock.
- Romney builder and search-readiness checks were updated so future rebuilds preserve this architecture.

### Compact product grids restored — 24 September 2026
- Romney's and Hawkshead remain on the shared shopping grid: 4 columns desktop, 3 tablet, 2 mobile.
- Gifts landing and all active gift-category catalogues now use the same shopping grid and 2-column mobile layout, matching the previously approved visual density.
- Mobile catalogue pages use the compact catalogue body treatment so at least a 2×2 set of product cards can be reached/seen quickly, depending on card title length and viewport height.

### Gift catalogue copy cleanup — 24 September 2026
- Removed the redundant “Choose a gift type” / “Pick a category to narrow the range” instruction block from Gifts.
- Replaced “Curated gift range” with the simpler “Gifts” label.
- Added QA so these instructional phrases do not return.

### Highland Cow placeholder expansion — 24 September 2026
- Added 23 new owner-supplied Highland Cow product codes/names as HC-033 through HC-055.
- These are deliberate placeholders only: no guessed image, price, dimensions or detailed description.
- Placeholder pages are live in the catalogue but use `noindex,follow` and stay out of the sitemap until completed.
- Gift totals: 64; Highland Cows: 35; Seasonal: 29; Home Gifts: 41; Full range: 146.
- Seasonal category now covers Christmas + Halloween rather than Christmas-only wording.

### Highland Cow placeholder availability — 24 September 2026
- 23 Christmas/Halloween Highland Cow placeholders now carry owner-confirmed arrival state: 9 Available in store, 14 Arriving soon.
- Arriving soon is distinct from Out of stock and must never render as Out of stock.
- Cards separate missing catalogue data from availability: Image coming soon + Price coming soon + In store/Arriving soon.
- Placeholder product pages remain noindex and outside the sitemap until image, price and verified product data are complete.

### Highland Cow exact owner pricing — 24 September 2026
- Replaced the temporary £9.50 blanket price on all 23 newly added Christmas/Halloween Highland Cow placeholders with exact per-SKU owner prices.
- Arrival state remains unchanged: 9 available/no badge, 14 Arriving soon.
- LP55906 is clarified as the couple with presents in red pyjamas (£13.99); no duplicate product was created.

### Highland Cow Phase 1 — arrived products completed, 24 September 2026
- 9 on-shelf Christmas Highland Cow records are upgraded from arrival placeholders to canonical indexable product pages with verified supplier facts and open-by-default Product Information.
- The 14 products still awaiting delivery remain the only Highland placeholders and continue to display Arriving soon.
- No supplier image was hotlinked or replaced with a screenshot. The 9 completed records use imagePending until a clean local source image can be added.
- Sitemap now indexes the 9 completed product URLs; image-pending products do not claim fabricated image metadata.

### Highland Cow Phase 2 completed — 24 September 2026
- 14 ordered/not-yet-arrived Highland Cow records were upgraded from minimal placeholders to researched canonical static product pages.
- All carry Arriving soon status and none use Out of stock wording.
- LP55734 owner price is £36.00. LP55904 is intentionally unpriced pending owner confirmation.
- Product facts were verified by exact LP code against Lesser & Pavey/Leonardo and Joe Davies, with reputable retailer support only where needed.
- No source image binary could be safely stored locally without hotlinking/screenshotting, so all 14 use the honest Product image being added state.
- Product Information remains open by default; pages are indexable canonical static routes and included in sitemap.
