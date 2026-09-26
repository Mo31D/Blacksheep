# Black Sheep — Phase 6.6 Publication Pipeline Release Report

**Date:** 26 September 2026  
**Status:** COMPLETE + STAGING / ADMIN E2E VERIFIED  
**Repository:** `Mo31D/Blacksheep` · `main`  
**Production publication apply:** NOT PERFORMED

## Scope completed

Phase 6.6 now produces one deterministic static publication package from D1 Published Product state while preserving specialist legacy content that Product Core does not yet model.

The package owns:
- `assets/catalog.js`,
- all current static `/products/<slug>.html` pages,
- 14 collection/full-range pages,
- `sitemap.xml`,
- Product JSON-LD,
- canonical metadata,
- static selling controls.

## Publication authority

D1 Published Product state is authoritative for:
- Product identity,
- current slug,
- published title and short description,
- brand / collection label / type,
- price,
- SKU/barcode where modeled,
- selling state,
- online ordering,
- categories,
- Product media,
- public attributes,
- SEO title/description,
- publication version metadata.

The legacy extension remains authoritative only for specialist detail not yet modeled in Product Core, including ingredients, allergens, nutrition, awards, dimensions/material, gallery treatment, supplier-derived factual detail and other structured page content.

Draft content never participates in publication.

## Candidate baseline proof

Publication Candidate Staging workflow:
- run `36229207557` — SUCCESS.

Baseline:
- active Published Products: 146,
- candidate Products: 146,
- semantic mismatches: 0,
- slug history rows: 146,
- retired slug aliases in baseline: 0,
- Product pages: 146,
- existing specialist templates preserved: 146,
- generic pages required for baseline: 0,
- specialist-detail regressions: 0,
- collection/full-range pages: 14,
- unsafe slug removals: 0.

## Structured data and static-state proof

Product JSON-LD is synchronized with D1 publication state for:
- Product name,
- canonical URL,
- SKU,
- Offer price,
- GBP currency,
- Offer availability.

Static Product buttons are rendered disabled in HTML when the Product cannot be ordered. This does not depend on JavaScript running first.

Collection/full-range output synchronizes:
- Product cards,
- current price/status,
- Add-to-basket enabled state,
- ItemList JSON-LD membership/count.

## Slug-history / canonical preservation

Publication consumes `product_slugs`.

For a retired Product slug:
- the current slug remains canonical,
- a static old-slug shell is generated,
- shell robots policy is `noindex,follow`,
- shell redirects to the current canonical Product URL,
- retired alias is excluded from sitemap,
- alias disappears if the Product is archived.

The current baseline contains no retired aliases, so this behavior was proved with controlled synthetic staging data.

## Admin Add → Publish → Archive E2E

Workflow:
- `36229294654` — SUCCESS.
- QA run: `ebf60e69ab`.

Verified through the real staging Admin:
1. Add Product creates a private Draft.
2. Publish exposes the Product through the public D1 API.
3. Candidate expands from 146 → 147 Products.
4. A valid generic static Product page is generated.
5. Canonical / Product JSON-LD / price are generated.
6. Product is added to sitemap.
7. Product is added to full-range card output.
8. Product is added to full-range ItemList JSON-LD.
9. Synthetic retired slug produces a correct noindex canonical redirect.
10. Retired alias is not added to sitemap.
11. Unified publication package verifier passes.
12. Package is byte-for-byte deterministic.
13. Change plan contains the new Product page.
14. Archive removes Product from public API.
15. Candidate returns to exact 146-product baseline.
16. Product page, card, ItemList entry, sitemap URL and retired alias all disappear.
17. CREATED / PUBLISHED / ARCHIVED audit history remains.
18. QA data is cleaned and staging baseline returns to 146.

## Deterministic package

Baseline package:
- files: 162,
- SHA-256: `61d0b5f8cd4e038d3d6b38fff8bda77fe1bd491fc7f6c796ac59089522d7c3f7`,
- repeated render: byte-for-byte identical,
- unsafe slug removals: 0.

First apply plan against the current repository:
- added: 0,
- changed: 162,
- deletions: 0.

The 162 changed files are intentionally **not applied yet**. The first real publication apply is coupled to the separate Production cutover gate so the static package and D1 authority cannot drift during transition.

## Production isolation

No Phase 6.6 operation changed Production:
- Production migration remains `0008_concurrency_guards.sql`,
- Product/Inventory/Reservation tables remain absent,
- Production D1 commerce flags remain absent,
- generated static catalogue remains Production checkout authority,
- current verified Production order count: 4.

## Exit status

Phase 6.6 is COMPLETE.

The next phase is **6.7 Production Cutover Readiness / Review**. No migration, Product import, Worker deploy, feature-flag activation or 162-file publication apply may occur without the separate cutover decision.
