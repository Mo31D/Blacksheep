# Black Sheep — Phase 6 Storefront / Commerce Integration Plan

**Date:** 25 September 2026  
**Status:** ACTIVE — milestones 6.1–6.5 COMPLETE + REAL-STAGING/BROWSER VERIFIED; 6.6 publication pipeline next  
**Target:** staging first  
**Production:** unchanged until a separate cutover gate

## 1. Objective

Make Product Core + Inventory Core the operational source of truth for public price, orderability and stock state without breaking the current static storefront, canonical product URLs, search readiness or the existing basket/order-request experience.

Phase 6 is a staged authority cutover, not a storefront redesign.

## 2. Current baseline

Current static/generated commerce baseline:
- generated commerce catalogue: **146 products**,
- source remains `assets/catalog.js`,
- Production Worker pricing still uses `commerce/src/generated/catalog.ts`,
- staging checkout now uses D1 Product/Inventory authority behind an explicit staging-only flag,
- `priceRequestedCart()` currently validates against that generated static catalogue.

Current staging D1 baseline:
- **158 total Product rows**,
- **146 ACTIVE** products,
- 12 archived QA products,
- 146 products with a published version,
- 134 ACTIVE products with online ordering enabled,
- 132 ACTIVE + online products with a numeric price,
- ACTIVE sell status: 128 AUTO / 14 ARRIVING_SOON / 4 OUT_OF_STOCK,
- 0 ACTIVE tracked variants at this checkpoint,
- latest staging migration: `0012_order_returns.sql`.

Production remains:
- latest migration `0008_concurrency_guards.sql`,
- no Product/Inventory/Reservation tables,
- generated static catalogue remains commerce authority.

## 2A. Verified staging foundation — 25 September 2026

Milestones 6.1–6.4 are complete on staging.

Evidence:
- public D1 catalogue/parity workflow `36199480713` — SUCCESS,
- D1 checkout authority/real tracked-stock workflow `36200073433` — SUCCESS,
- exact generated-vs-D1 parity: 146 / 146 / 0 mismatches,
- real checkout QA run `05d821c4e1`,
- current staging Worker version `3603f5da-1521-4c01-8888-65b9ebea0d29`,
- staging `D1_PUBLIC_CATALOG_ENABLED=true`,
- staging `D1_COMMERCE_AUTHORITY_ENABLED=true`,
- Production remains `0008_concurrency_guards.sql` with neither Phase 6 flag.

Detailed report:
`docs/STOREFRONT-COMMERCE-PHASE6-STAGING-FOUNDATION-2026-09-25.md`.

## 3. Public Product truth rules

The public D1 view must use:

### Content
- only `products.current_published_version_id`,
- never `current_draft_version_id`,
- only `publication_status='ACTIVE'`,
- only active default variant.

A Product Draft must never leak into public API, checkout or structured data before Publish.

### Price
- `product_variants.price_minor` is the operational price authority,
- price changes are immediate operational changes,
- currency remains GBP in the current commerce system,
- missing price makes online purchase unavailable.

### Manual selling state
Manual Product state overrides automatic inventory:

- `NOT_FOR_SALE` → not purchasable,
- `ARRIVING_SOON` → not purchasable,
- `OUT_OF_STOCK` → not purchasable,
- `AUTO` → determine from online-ordering + price + inventory mode.

### Online ordering
`online_ordering_enabled=0` always prevents online purchase.

### Inventory
For tracked variants:
- Available = On hand - Reserved - Safety stock,
- Available <= 0 → not purchasable / out of stock,
- Available > 0 → inventory itself permits purchase.

For untracked variants:
- no numeric stock claim is exposed,
- AUTO preserves existing orderability behaviour,
- manual sell status still overrides.

Incoming quantity does not make an item purchasable.

## 4. Public API contract

Add staging-first read-only routes:

- `GET /v1/catalog`
- `GET /v1/catalog/:id`

Public response should expose only storefront-safe data:
- legacy/public product id,
- Product UUID only if needed internally by the browser contract,
- slug,
- title,
- product type / primary category,
- SKU where already public/useful,
- price,
- currency,
- public selling status,
- purchasable boolean,
- non-purchasable reason,
- inventory mode: tracked/untracked,
- available quantity only when the product is tracked,
- primary image / media where safe,
- published version marker,
- Product updated timestamp.

No cost price, supplier details, barcode unless intentionally public, audit data, internal notes or Draft content.

Initial API responses should use conservative cache semantics until mutation propagation is proved.

## 5. D1 commerce pricing authority

Add an async D1 pricing path that:
1. resolves every requested public product ID,
2. reads current D1 price,
3. re-evaluates current orderability,
4. rejects missing/disabled/out-of-stock products,
5. produces the same server-authoritative priced-line shape used by order persistence.

Do not trust browser-supplied price or stock state.

The existing generated catalogue path remains as the fallback authority while Phase 6 is staged.

## 6. Feature-gated cutover

Add a dedicated flag such as:

`D1_COMMERCE_AUTHORITY_ENABLED=true`

Rules:
- staging only during development/proof,
- absent/false in Production,
- public catalogue endpoint may be available on staging independently,
- checkout pricing switches to D1 only when this flag is explicitly enabled,
- Production Worker must remain safe when Product Core tables do not exist.

## 7. Parity before authority

Before enabling D1 checkout authority, compare all 146 current generated products against D1 published Product Core.

Compare:
- public ID,
- slug,
- title,
- SKU,
- price,
- status,
- purchasable,
- non-purchasable reason.

Classify every mismatch:
- expected semantic improvement,
- Admin-side intentional change,
- migration/import defect,
- mapping defect.

There must be no unexplained mismatch.

## 8. Storefront overlay

After the API + checkout authority prove stable on staging:

- add a lightweight live overlay to static pages/cards,
- update visible price/status/order button from the public API,
- never rewrite canonical URLs client-side,
- fail safely back to static content if the public API is temporarily unavailable,
- checkout still revalidates everything server-side.

The overlay must not create layout shift or make the static site dependent on JavaScript for basic product discovery.

## 9. Static publication pipeline

Publishing content in Admin must eventually update public static product assets/pages without hand-editing GitHub.

The publication pipeline must:
- consume only published Product Core content,
- preserve canonical `/products/<slug>.html`,
- preserve slug history/redirect strategy,
- write page content, cards and sitemap consistently,
- keep structured data synchronized,
- preserve exact media where applicable,
- never publish Draft content.

This is a later Phase 6 milestone after API/checkout authority is proven.

## 10. Structured data / SEO

Product HTML and JSON-LD must agree with operational public truth:
- published title/content,
- current public price,
- current availability state,
- canonical URL,
- current primary image.

Dynamic inventory overlay must not leave contradictory Product JSON-LD indefinitely. The publication pipeline must reconcile structured data.

## 11. Required Phase 6 staging tests

Before Production cutover is considered:

1. 146-product D1/static parity report has no unexplained differences.
2. Draft content never appears in public API.
3. Publish makes new content publicly visible.
4. Price edit propagates to public API immediately.
5. online-ordering off blocks D1 checkout.
6. manual OUT_OF_STOCK blocks D1 checkout.
7. ARRIVING_SOON blocks D1 checkout.
8. tracked Available=0 blocks D1 checkout.
9. tracked Available>0 allows D1 checkout when all other gates pass.
10. Reserved stock reduces public Available.
11. untracked AUTO preserves current behaviour.
12. public catalogue endpoint exposes no private/admin fields.
13. browser/cart price mismatch is ignored; server D1 price wins.
14. API failure leaves storefront static fallback usable.
15. canonical URLs remain unchanged.
16. structured-data parity passes for generated product pages.
17. Add Product → Publish → API propagation works.
18. Archive removes online orderability without deleting audit/history.
19. Production remains pre-Product-Core until explicit cutover.
20. Production checkout remains on generated catalogue until explicit cutover.

## 12. Milestones

### 6.1 — D1 commerce query layer — COMPLETE
- public Product contract,
- public Product list/detail query,
- exact orderability calculation,
- unit tests.

### 6.2 — Staging public API — COMPLETE
- `GET /v1/catalog`,
- `GET /v1/catalog/:id`,
- CORS/cache/error contract,
- staging deployment,
- privacy-field test.

### 6.3 — Parity engine — COMPLETE
- generated-static vs D1 comparison,
- mismatch report,
- zero unexplained mismatch gate.

### 6.4 — D1 checkout pricing — COMPLETE ON STAGING
- async D1 pricing,
- staging-only authority flag,
- checkout regression tests,
- real staging order proof,
- tracked-stock quantity/Reserved proof,
- server-price persistence proof.

### 6.5 — Storefront live overlay — COMPLETE
- price/status/orderability overlay,
- static fallback,
- staging-preview isolation,
- checkout submission lock in preview,
- Chromium + WebKit/mobile browser QA,
- canonical query isolation.

### 6.6 — Publication pipeline
- Admin Publish → static artefacts,
- canonical/redirect preservation,
- sitemap/cards/product pages/JSON-LD.

### 6.7 — Production cutover review
Only after all prior gates pass:
- Production migration plan,
- backup/time-travel bookmark,
- Product Core parity import/migration plan,
- Worker authority switch,
- storefront deployment,
- rollback plan,
- post-cutover order proof.

## 12A. Publication merge authority

Phase 6.6 must not reduce the quality of the existing static product pages.

For existing imported Products, publication uses two layers:

- **D1 Published Product authority** for Product identity, current slug, published title/short description/brand/type, operational price, selling state, online-ordering state, Product media and categories where available.
- **Legacy content extension** from the current static catalogue/page architecture for fields Product Core does not yet model, such as supplier factual detail, ingredients, allergens, nutrition, awards, dimensions/material, galleries, image-fit treatment, range notes and other specialist page content.

Rules:
- D1 always wins for fields it owns.
- Draft content never participates.
- Extension data is keyed by immutable legacy/public Product ID, not fuzzy title/SKU matching.
- New Admin-created Products with no legacy extension must still generate a valid minimal static Product page.
- No specialist content may silently disappear during a publication run.
- The legacy extension can be retired field-by-field only after equivalent structured Product Core data exists and parity is proven.

## 13. Safety locks

Until Phase 6 Production cutover is explicitly approved:
- do not apply `0009+` to Production,
- do not enable D1 commerce authority in Production,
- do not remove `assets/catalog.js`,
- do not remove `commerce/src/generated/catalog.ts`,
- do not change Production checkout authority,
- do not change canonical product URLs.

## 14. Current exact milestone

Start 6.6 — Product publication pipeline:
1. export only Published Product state from staging D1,
2. merge D1 operational/public-core authority with legacy specialist content extensions keyed by legacy Product ID,
3. generate candidate catalogue/static artefacts without overwriting live files,
4. prove exact parity for the existing 146 Products,
5. preserve specialist Romney's / ice-cream / Hawkshead content until equivalent structured Product Core fields exist,
6. prove Admin Add/Publish/Archive propagation on staging QA data,
7. add deterministic CI drift checks,
8. plan write/deploy automation only after candidate parity passes.
