# Black Sheep — Next Phase Technical Baseline

Date: 24 September 2026  
Repository: `Mo31D/Blacksheep`  
Authoritative branch: `main`  
Code baseline inspected: `33c59374aa2b11aa9c37e81a5ee1db83adf423e2`

## Purpose

This document is the technical baseline for the next major phase of The Black Sheep Shop website. It records the current architecture, verified state, confirmed issues and invariants that must be preserved before large changes begin.

Do not treat older catalogue counts in historical handoff/report sections as current. This file records the verified baseline above.

## Verified current state

Latest GitHub Actions checks on the inspected commit passed:

- Search readiness: PASS
- GitHub Pages deployment: PASS
- Ice cream builder drift check: PASS
- Romney's builder drift check: PASS
- Current verified totals from CI:
  - 146 catalogue products
  - 17 active non-product pages
  - 163 sitemap URLs
  - 0 placeholders

Catalogue composition:

- Gifts: 64
- Luxury Lakes Ice Cream: 12
- Romney's / confectionery: 55
- Hawkshead Relish: 15
- Fragrances: 0

Availability/data state:

- 129 normal catalogue records
- 14 Highland Cow Phase 2 products marked `arriving-soon`
- 3 products marked `out-of-stock`
- 14 products have `imagePending: true` and deliberately have no local product image yet
- No duplicate catalogue IDs, slugs or SKUs were found
- No catalogue product is missing a name, slug or description

## Current architecture

### Runtime

- Static HTML site served by GitHub Pages.
- `assets/catalog.js` is the catalogue source of truth.
- `assets/site.js` provides client-side enhancement:
  - product-card behaviour
  - filters
  - category helpers
  - availability sorting
  - navigation cleanup
  - My list / pre-visit list
- `assets/style.css` is the shared visual system.
- Canonical product URLs are `/products/<slug>.html`.
- `product.html?type=...&slug=...` is legacy-only and redirects to the canonical static page.

### Build / generated content

Current generation is only partially unified:

- Ice cream has `scripts/build-icecream.mjs` plus a product template.
- Romney's has `scripts/build-romneys.mjs`.
- Both builders modify shared generated surfaces such as `all-products.html` and `sitemap.xml`.
- Gifts / Peter Rabbit / Highland Cow and Hawkshead Relish do not currently have equivalent first-class builders for the entire section.
- `scripts/verify-search-readiness.mjs` is therefore doing substantial cross-file consistency enforcement in addition to normal QA.

This architecture is currently stable, but it is the main maintainability risk for a large redesign or catalogue expansion.

## Root-page audit

All current top-level HTML pages were checked directly against the repository tree.

Verified:

- no broken local `href` / `src` references were found in the root HTML pages
- no duplicate HTML IDs were found
- no root-page `img` element was missing an `alt` attribute
- no active page links back to the legacy query-string product route
- current active pages have canonical tags and explicit robots policy
- retired route shells remain `noindex,follow`
- the current simplified navigation does not contain the old nested Gifts dropdown markup

Product-page invariants are additionally covered by the passing current search-readiness CI, which iterates the catalogue/static product layer.

## Confirmed current bug

### My list renders a broken image for image-pending products

`renderBlackSheepList()` currently always emits:

`/images/${item.img}`

The 14 Phase 2 Highland Cow records intentionally have `imagePending: true` and no `img`. They can still be added to My list, so the list attempts to render `/images/undefined`.

Required fix before broader feature work:

- reuse the catalogue-card placeholder treatment in My list when `item.img` is absent
- never emit an invalid image URL
- add a regression check for image-pending products added to My list

## Structural risks to address before a major rebuild

### 1. Partial generator coverage

The catalogue is centralised, but page generation is not. A single product/status change can still require coordinated changes across several static collection pages unless it belongs to one of the builder-controlled sections.

Target direction: one deterministic site-generation layer for every catalogue section and every shared output.

### 2. Cross-builder coupling

Ice cream and Romney's builders both touch shared outputs such as Full range and sitemap. CI currently proves that their outputs agree, but adding more independent builders increases coupling and drift risk.

Target direction: one orchestration/build command owns all generated outputs.

### 3. Runtime/static duplication

Some information exists both in prerendered HTML and in `assets/catalog.js`. `syncCatalogCardState()` currently repairs selected runtime fields such as numeric price and stock state, but it does not make every visible field authoritative from one layer.

Examples of future drift risk:

- removal of a numeric price is not symmetrically handled by the runtime sync
- image/name/description drift is not generically reconciled by the runtime layer
- validator coverage is strong but partly product-family-specific

### 4. My list accessibility and resilience

The My list drawer has useful basics: dialog semantics, Escape close and focus return. It does not currently implement a full modal focus trap.

Before a major UX expansion, add:

- keyboard focus containment while open
- robust image-pending rendering
- automated list-state smoke checks

### 5. Dense global client script

`assets/site.js` is a global-script architecture with many string templates and inline event handlers. This is acceptable for the current static site but becomes harder to evolve safely as features grow.

Do not replace it merely for fashion. Refactor only when the next-phase feature set justifies modules/components.

### 6. Repository weight and historical artifacts

Current repository tree is approximately 145.5 MB of file content:

- images: ~122.2 MB
- root-level files: ~14.4 MB
- PNG files alone: ~124.6 MB

The repository also contains recovery/base64/restore artifacts and old large numbered images retained from earlier work. Do not delete them blindly: first produce an exact reference/usage map, then remove only files proven unused and no longer needed for recovery.

### 7. Branch/process risk

At this baseline:

- `main` is not branch-protected
- four additional historical/recovery branches remain
- an old `final-cross-builder-qa.yml` workflow targets `romneys-rebuild-2026-09-24`, not `main`

Before high-volume next-phase work, either protect `main` or use a dedicated next-phase branch with explicit milestone merges. Historical branches should be deleted only after checking their unique commits.

## Documentation drift

Existing `docs/SESSION-HANDOFF.md` and `docs/WORK-CHECKLIST.md` contain historical sections and earlier catalogue counts/SHAs. Those records are useful history but are no longer a clean single source for current state.

For next-phase work:

1. read this baseline first
2. use current GitHub `main` as authority
3. treat older handoff counts as history unless reconfirmed
4. update the new next-phase docs after each major milestone

## Invariants to preserve

Unless the owner explicitly changes them:

- GitHub `main` remains the production source of truth.
- Never force-push over newer work.
- Canonical products remain static `/products/<slug>.html` pages.
- Product Information disclosures remain open by default.
- Supplier/trade pricing must not leak into public pages.
- Black Sheep retail prices come only from owner-confirmed data.
- Image provenance and exact product identity must not be guessed.
- My list remains a pre-visit planning list, not checkout.
- No online-purchase Offer schema unless a real purchase flow exists.
- SEO canonicals, schema, sitemap and prerendered discoverability must survive any redesign.

## Baseline conclusion

The current site is not in a broken state. Its CI and deployment are green and the root-page/static-product architecture is functioning.

The next major phase should therefore start with a controlled foundation/refactor milestone rather than a rescue/rebuild from scratch. The priority is to make generation and QA more uniform before applying broad visual or feature changes.
