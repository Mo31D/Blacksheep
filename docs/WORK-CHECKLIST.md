# Black Sheep — resumable work checklist

Updated 2026-09-23. Repository: https://github.com/Mo31D/Blacksheep — branch main.
GitHub `main` is authoritative. Latest verified search/QA implementation milestone: `7ff604b053242b90d23f67d2c655580ef7c91e57` (documentation commits may be newer).

## Resume rules
1. Read this file, docs/OWNER-REQUESTS.md, docs/HIGHLAND-COW-SOURCE-MAP.md and docs/SESSION-HANDOFF.md before editing.
2. GitHub `main` is now the primary working source. The user is continuing the project directly and does not depend on recovering the old Work-local tree.
3. Fetch current `main` before edits. Preserve newer commits; never force-push.
4. Complete work in small verifiable milestones, commit/push each milestone, then update this checklist and docs/SESSION-HANDOFF.md.
5. Work/Sites is optional and may rejoin later. When it does, it must read the checklist/handoff first and sync from current GitHub rather than assuming its old local state is authoritative.
6. The user can assist with manual asset acquisition when useful: provide exact source link, exact filename, target repository folder and any conversion/cropping requirement.
7. Synchronize the SAME Sites project when its identity becomes available. Do not invent a Sites ID or create a duplicate.
8. The uploaded source evidence is Blacksheep.zip, Library ID libfile_aea3ba2b6374819189c3a1ca92c93517. Contains 10 owner-message screenshots + 19 product screenshots (one duplicate).

## Phase 1 — restore and compare
- [x] Fetch current GitHub main and inspect recent commits.
- [x] Preserve latest Peter Rabbit catalogue and full Romney's range.
- [x] Inspect owner-provided ZIP and record requests/prices separately.
- [ ] Resolve existing Sites project: BLOCKED — owner and editor lists contain no Black Sheep. No hosting.json in GitHub; past-context lookup found no ID. Ask user for existing Sites URL. Do not silently create a duplicate.
- [ ] Open existing Sites source and compare against latest GitHub.

## Phase 2 — accurate catalogue
- [x] Match supplied Highland Cow photos against official Lesser & Pavey / Leonardo pages.
  - [x] Saved a resumable supplier/owner cross-reference in docs/HIGHLAND-COW-SOURCE-MAP.md.
  - [x] Verified all 18 distinct supplied product screenshots to exact official stock codes; identified the duplicated Highland Cows Reds attachment.
  - [x] Resolved the red/white Scarf & Hat as LP74353.
  - [x] Resolved the two Tartan Bow visuals: bow-on-head LP73654; bow-tie variant LP75979.
  - [x] Matched all owner Christmas screenshots to stock codes; details and owner prices are recorded in docs/HIGHLAND-COW-SOURCE-MAP.md.
- [x] Save clean genuine product photos and source mapping for the first six-product batch.
  - [x] Prepared six clean 800×800 WebP files from the user-supplied originals for LP73651, LP73652, LP74354, LP74355, LP74358 and LP75455.
  - [x] Created repository upload folder `images/highland-cows/` with exact filename manifest.
  - [x] User uploaded all six prepared WebP binaries to `images/highland-cows/` on `main` in commit `432927584c2ff0ea1c34ab9e2e63211b535328c3`.
- [x] Second six-product Highland Cow image batch uploaded to the same folder: LP76232, LP76228, LP75983, LP75453, LP75454 and LP75341.
- [x] Add exact products / update overlapping entries, preserving old product URLs where practical.
  - [x] Added LP73651, LP73652, LP74354, LP74355 and LP74358 as exact catalogue entries.
  - [x] Upgraded existing HC-003 in place to LP75455 Highland Cow Trio, preserving its existing slug/URL.
- [x] Apply owner prices only where clearly mapped; flag ambiguous prices privately for this six-product batch (£9.50 singles, £13.99 pairs, £14.95 trio).
- [ ] Add verified Christmas products.
- [x] Completed customer-facing detail data for the first 12 exact Highland Cow products: concise descriptions, brand, product code, range, dimensions where verified, material, owner-confirmed prices, and availability handling.

## Peter Rabbit internal detail sync
- [x] Compared Black Sheep Peter Rabbit catalogue against `Mo31D/Lakesidepinicnew/src/catalogue.json`.
- [x] Found 29 exact shared Peter Rabbit products by product name/SKU and enriched their internal detail pages.
- [x] Preserved Black Sheep prices, images, IDs and URLs; imported only verified shared product facts from Lakeside.
- [x] Added structured Dimensions, Material, Packaging, Care and Suitable-for fields where supported by the Lakeside product record.
- [x] Kept descriptions concise and customer-facing rather than copying source notes.
- [x] QA passed for the 29 shared products: all image paths resolve and there are no duplicate IDs, slugs or SKUs.
- [x] Owner scope decision: remove the 40 older/generic Peter Rabbit records. Keep only the 29 exact Peter Rabbit products matched to Lakeside Picnic; do not re-add the removed records unless the owner explicitly requests it.

## Phase 3 — shop photography and layout
- [ ] Open Google Maps in browser and inspect 360° photos.
- [ ] Add a suitable attributed tour/embed/link or permitted genuine images.
- [ ] Replace old shop imagery with owner's requested views when suitable originals available.
- [ ] Improve homepage hierarchy, readable text, navigation and mobile layout.
- [ ] Preserve shop identity: black/gold frame, colourful real merchandise, in-store catalogue.

## Phase 4 — checks, synchronization and handoff
- [x] Verify current catalogue structure, links, duplicate IDs/slugs/SKUs and search architecture.
  - [x] Full repository QA audit completed for current gift catalogue: 173 gift records, 0 duplicate IDs, 0 duplicate slugs, 0 duplicate SKUs, 0 missing referenced gift images.
  - [x] `assets/catalog.js` parses and `assets/site.js` compiles successfully.
  - [x] Product-card → `product.html` routing and detail renderer wiring verified.
  - [x] Detailed audit saved in `docs/QA-AUDIT-2026-09-23.md`.
  - [x] First six-product batch QA passed: all six referenced image paths exist; no duplicate IDs, slugs or SKUs; owner prices are present; Range and Dimensions render support is present.
- [x] Static deep-audit of desktop/mobile navigation, filters, product-detail routing, catalogue references and accessibility-critical interactions completed.
  - [x] Found and fixed product detail runtime routing bug in `product.html`: `renderDetail` was referenced before `assets/site.js` loaded, causing an empty product page.
  - [x] Post-fix static runtime-order QA passed for all 41 completed detail records (12 Highland Cow + 29 Peter Rabbit), including primary/gallery image paths.
- [x] Commit/push current GitHub `main` milestones and re-fetch the resulting source for verification.
- [ ] Push same source to resolved Sites project, save version, publish and confirm status.
- [ ] Record final commit, Sites version, URL, remaining gaps and exact next action here.

## Current next action

GitHub `main` is the current source of truth after the 23 September search/SEO architecture rebuild and metadata repair.

1. Work/Sites must fetch newest `main` before editing and must not restore its older JS-only product architecture.
2. Sync the **same existing Black Sheep Sites project** from GitHub when its identity/URL is available; do not create a duplicate.
3. After publish, perform live mobile + desktop QA. Specifically verify that the raw `og:image` text previously visible above the top bar is gone on all pages.
4. Preserve 108 static `/products/<slug>.html` product pages, prerendered collection product links, canonical URLs, JSON-LD graphs, sitemap and the search-readiness CI workflow.
5. Keep the intentionally reduced product scope: 29 Peter Rabbit + 12 Highland Cow + 12 Ice Cream + 55 Romney's. Do not re-add placeholders.
6. Keep Loo-Time and Soaking prices unpublished until owner-confirmed.
7. Remaining external work: exact Sites synchronization, live deployment QA, Google Maps/360 imagery review, and Black Sheep Search Console analysis when access is available.

Repository QA currently has no known blocking issue. Hosting/deployment state still needs confirmation after the newest `main` is published.

## Navigation decision — completed

- [x] Remove the crowded nested Gifts & Souvenirs menu from desktop and mobile navigation.
- [x] Keep Gifts & Souvenirs as a direct link to `gifts.html`.
- [x] Move category choice into the Gifts page with search, collection selector and quick filters, while preserving the Black Sheep design language.

## Product cleanup — completed

- [x] Remove every unmodified/placeholder product record.
- [x] Keep only products with real images and proper descriptions from completed work.
- [x] Final retained catalogue: 41 Gifts, 12 Ice Cream, 55 Romney's; Hawkshead and Lakeland Fragrances currently have no product records.
- [x] Remove empty gift categories from the current Gifts-page selector/navigation.
- [x] QA: all 108 retained records have valid real images and descriptions; no duplicate IDs/slugs/SKUs.

## Deep repository audit — completed

- [x] Scan all active HTML source for broken local links/assets, duplicate IDs, stale nested-menu markup and retired-category links.
- [x] Scan shared JS syntax and catalogue JSON validity.
- [x] Fix filter binding so decorative chips cannot hide the catalogue.
- [x] Fix saved My list cleanup after catalogue removals.
- [x] Clean active source navigation and footer links; Full range is present without depending on JS injection.
- [x] Retire empty legacy category pages with noindex redirects.
- [x] Align active gift-category wording with the exact retained products.
- [x] Replace heavy collection imagery with existing real product WebPs where practical.
- [x] Add production sitemap + robots sitemap entry.
- [ ] Optional later cleanup: delete unused historical placeholder PNGs / recovery bundles after confirming they are no longer wanted for archival purposes.
- [ ] Live visual/browser QA on the deployed domain remains advisable after GitHub Pages has published the latest commits.

## Search engineering rebuild — completed

- [x] Create canonical static HTML product pages for all 108 retained catalogue records under `products/<slug>.html`.
- [x] Change catalogue/card links to the static product URLs.
- [x] Prerender product cards/links into source HTML for Gifts, category pages, Ice Cream, Romney's and Full range.
- [x] Keep JavaScript as enhancement for search/filtering/My List instead of requiring JS to discover/index core product content.
- [x] Retire `product.html?type=...&slug=...` as an indexable route; legacy route is `noindex,follow` and forwards to static products.
- [x] Add linked Store/WebSite/WebPage/Product/Breadcrumb JSON-LD to static product pages.
- [x] Add CollectionPage + ItemList JSON-LD to product collections.
- [x] Build production sitemap with 125 URLs: 17 active pages + 108 products, plus 111 product image entries.
- [x] Confirm sitemap contains zero legacy query product URLs.
- [x] Keep `robots.txt` pointed to the production sitemap and 404 page `noindex,follow`.
- [x] Add `scripts/verify-search-readiness.mjs` and GitHub Actions search-readiness workflow.
- [x] Harden CI to detect catalogue duplicates, missing static products/images, invalid JSON-LD, bad canonicals/robots, malformed social metadata, missing ItemList graphs, sitemap drift and unsafe legacy routes.

## Social metadata regression — fixed

- [x] Owner mobile screenshots exposed raw `property="og:image" ...` text above the site after an earlier metadata transformation.
- [x] Audited all 17 active core pages, not just the three shown in screenshots.
- [x] Repaired every active page to exactly one valid absolute `og:image`, one `og:image:alt` and one `twitter:card` tag.
- [x] Re-audited all 17 active heads: zero malformed visible og:image fragments remain in repository source.
- [x] Added regression detection to the search-readiness verifier so this class of error is caught automatically in future.

## 2026-09-23 — official Lakes rebuild checkpoint

- [x] Fetch latest main; starting SHA `b6c99de01e37e91a876852dcab062ec1ac33d9eb`; isolated clean worktree used.
- [x] Read current handoff, owner requests, source map, README, verifier and CI; preserve static SEO architecture.
- [x] Baseline search-readiness and HTML/link/schema checks.
- [x] Fix nested-product My List image and navigation URLs.
- [x] Open all 12 official manufacturer flavour pages and retain verified facts/provenance.
- [x] Replace Pistachio with Plum & Damson; safely retire old static route.
- [x] Replace 12 flavour photos with optimised exact official WebP images.
- [x] Enrich static pages; retain ingredients/nutrition/dietary/award facts and safety warnings.
- [x] Add deterministic builder and CI drift check; reconcile collections/schema/sitemap.
- [x] Local verification: 108 products / 125 sitemap URLs; 136 HTML files without audit errors; DOM interaction checks passed.
- [ ] Push validated source and check live deployment (see dated work report for latest status).
- [ ] Sync existing Sites project: owner/editor discovery did not return Black Sheep; do not create another project.
- [ ] Complete mobile and desktop visual review after deployment.
