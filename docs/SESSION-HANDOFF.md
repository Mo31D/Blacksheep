# Black Sheep — Session Handoff

> **CURRENT AUTHORITATIVE HANDOFF — 25 September 2026**
>
> Repository: `Mo31D/Blacksheep` · branch: `main`.
>
> **Live execution tracker:** `docs/ADMIN-V2-CHECKLIST.md`.
>
> **Production Admin V2 is live. Phase 13 is complete and the first post-release storefront/stock patch is also live.**
>
> Current verified production state:
> - current storefront/commerce source patch: `43757734376c3c4b7f8a139ee096927bbb09a251`
> - production deploy workflow run: `36163025684` / job `108163975400` — SUCCESS
> - production D1 migrations: `0000–0008` — unchanged by the patch
> - production Worker deployment ID: `2bbc3281-a57a-4cd0-aba5-594dd4563939`
> - production Worker version: `f4a9ba95-b144-436e-9e4d-808cc5218792`
> - production D1 ID: `c1afdb87-47a8-4f6b-bf4b-0ce9b5b41e52`
> - current verified production order count: 4
> - production health/Admin gates: PASS in the deployment workflow
> - production secrets remain `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`
> - production Resend webhook ID: `db1d278b-aea6-4b52-90f4-b233252f5cf0` — ENABLED
> - DMARC: `v=DMARC1; p=none; pct=100; adkim=r; aspf=r`
> - latest observed D1 Time Travel bookmark: `00000031-00000000-000050f1-2c19ebc9178ac245e54f7e8b94badfbc`
>
> Post-release patch content:
> - homepage quick-category strip now links every category tile to a real destination
> - homepage gift collections use a compact two-column mobile grid
> - basket mobile layout has clearer order progress, tighter item cards and a lighter summary
> - `PR-046 Peter Rabbit Hanging Ornaments (Set of 4)` is now explicitly `out-of-stock`
> - the generated server-authoritative commerce catalogue also marks PR-046 non-purchasable
> - no production migration was applied for this patch
> - Search Readiness, Commerce CI, GitHub Pages and production deploy/health gates passed for the implementation/release
> - stale failing `.github/workflows/commerce-production-migrations.yml` was removed after it produced false red workflow noise on ordinary pushes; Git history retains it
>
> Original Phase 13 release remains the migration foundation:
> - migration run `36157961810` / job `108147083426`
> - migrations `0003–0008` were additive and must not be rerun
> - the original Admin V2 runtime release was `8c5462388648235acd3a41b853d1adee057a11a7`; it has now been superseded by the stock-sync runtime patch above
>
> **Owner-email polish release — 25 September 2026**
> - source commit: `ecc05a588cbb2a07210661d4c34cf5b9bb8afb62`
> - production deploy run: `36165501995` / job `108172137498` — SUCCESS
> - production Worker deployment: `97549177-a3c5-4334-8968-d1dec7cd4db7`
> - production Worker version: `2c9a0a9d-7eb7-46b1-81cd-e02db425aaef`
> - no D1 migration applied; migration ledger remains `0000–0008`
> - existing production order count remains 3
> - owner new-order emails now use the premium Owner Operations template
> - customer-question owner emails use the same owner template
> - Admin OTP email now uses the owner template
> - owner emails include environment-correct Admin CTA links
> - new-order/customer-question CTAs deep-link to the exact order after authentication
>
> **Product / Inventory project is active and advanced on staging:**
> - `docs/PRODUCT-INVENTORY-ADMIN-MASTERPLAN-2026-09-25.md`
> - `docs/PRODUCT-INVENTORY-ADMIN-CHECKLIST.md`
> - Phases 1–3 complete on staging.
> - Phase 4 Inventory Core is COMPLETE ON STAGING; owner confirmed corrected OTP login + iPad portrait UX re-test passed.
> - Phase 5 Order Reservations is COMPLETE + REAL-STAGING VERIFIED.
> - Phase 6 is ACTIVE: milestones 6.1–6.4 are COMPLETE + REAL-STAGING VERIFIED; 6.5 storefront overlay is next.
> - Production Product/Inventory migration and Phase 6 authority remain locked.
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
> **PHASE 6 STOREFRONT / COMMERCE — CURRENT STAGING CHECKPOINT**
> - implementation plan: `docs/STOREFRONT-COMMERCE-PHASE6-IMPLEMENTATION-PLAN-2026-09-25.md`.
> - staging foundation report: `docs/STOREFRONT-COMMERCE-PHASE6-STAGING-FOUNDATION-2026-09-25.md`.
> - milestones 6.1–6.4: COMPLETE + REAL-STAGING VERIFIED.
> - public D1 routes: `GET /v1/catalog` and `GET /v1/catalog/:id`.
> - exact generated-static vs D1 parity: 146 / 146 / 0 mismatches.
> - public/parity workflow `36199480713` — SUCCESS.
> - D1 checkout + tracked-stock proof workflow `36200073433` — SUCCESS.
> - real checkout QA run `05d821c4e1`: D1 price persistence, repricing, tracked Available, Reserved reduction, online-ordering override, OUT_OF_STOCK override and Archive behavior all PASS.
> - current staging Worker deployment `4e358034-e033-472c-a450-a52550058d25`.
> - current staging Worker version `3603f5da-1521-4c01-8888-65b9ebea0d29`.
> - staging flags: `D1_PUBLIC_CATALOG_ENABLED=true`, `D1_COMMERCE_AUTHORITY_ENABLED=true`, `ORDER_RESERVATIONS_ENABLED=true`.
> - temporary Phase 6 QA Worker deleted and synthetic Product/orders/variant/balance cleaned.
> - Production remains migration `0008_concurrency_guards.sql`, Product/Inventory tables absent, both Phase 6 flags absent, generated static catalogue still Production checkout authority, current orders 4.
>
> **NEXT WORK: Phase 6.5 Storefront live overlay with staging-preview mode and static fallback.**
> Do not apply Product/Inventory/Reservation migrations to Production and do not switch Production commerce authority before the separate Phase 6 production cutover gate.

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
