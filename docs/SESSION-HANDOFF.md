# Black Sheep — Session Handoff

Updated: 23 September 2026

Latest verified implementation milestone: `7ff604b053242b90d23f67d2c655580ef7c91e57`

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

## CRITICAL LATEST HANDOFF — post-SEO/search rebuild, 23 September 2026

**Work/Sites: fetch the newest GitHub `main` before doing anything. Do not restore an older Work-local copy over GitHub.**

The repository was substantially upgraded today for Google/Search/AI readability while preserving the Black Sheep design and the current curated catalogue.

### Search architecture now in production source
- The canonical product architecture is now **108 static HTML product pages** under `products/<slug>.html`.
- Do **not** restore `product.html?type=...&slug=...` as the indexable product architecture. That file is legacy-only, has `noindex,follow`, and redirects old visitors to the static URL.
- Every static product page contains its customer-facing H1, description, primary image, verified product facts, canonical URL and JSON-LD directly in source HTML. Product indexing no longer depends on client-side rendering.
- Product/collection links now point directly to `/products/<slug>.html`.
- Active collection pages contain prerendered product cards/links in source HTML. Shared JS enhances filtering and My List but preserves prerendered catalogue content instead of rebuilding it.
- Current catalogue remains **108 products total: 41 Gifts (29 Peter Rabbit + 12 Highland Cow), 12 Luxury Lakes Ice Cream, 55 Romney's/confectionery**.
- Hawkshead Relish remains an informational in-store range page with no invented individual products.

### Structured data / entity layer
- Static product pages use a linked JSON-LD graph containing `Store`, `WebSite`, `WebPage`, `BreadcrumbList` and `Product`.
- Product collection pages use `Store`, `WebSite`, `CollectionPage` and `ItemList`.
- About uses `AboutPage`; Visit uses `ContactPage`.
- The entity graph uses stable production URLs and the real Black Sheep shop/address/telephone/Facebook identity.
- Do not add ecommerce `Offer`/checkout claims unless the site actually gains a genuine online purchase flow. Current availability language intentionally describes in-store stock truthfully.

### Indexing / discovery
- `sitemap.xml` now contains **125 URLs**: 17 active non-product pages + 108 static product URLs.
- The sitemap currently contains **111 image entries** and **zero legacy query product URLs**.
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
4. Preserve the 108-product static URL architecture, prerendered collection HTML, schema graphs, sitemap and CI checks.
5. Do not re-add removed placeholder products/categories or old nested Gifts navigation.
6. If Search Console access for Black Sheep becomes available, verify sitemap ingestion, indexing/canonical selection and real search performance from GSC. Do not infer ranking from repository checks alone.
7. Google Maps/360 imagery work and exact Sites synchronization remain separate follow-up tasks.

### Current repository QA summary
- Catalogue: 108 records; 0 duplicate IDs, slugs or non-empty SKUs in the current audit.
- Sitemap: 125 URLs; 108 product URLs; 111 image entries; 0 legacy query product URLs.
- All 17 active core pages: canonical present, index policy present, JSON-LD parses successfully.
- All active pages: corrected social metadata; no malformed visible `og:image` fragment.
- Representative Peter Rabbit, Highland Cow, Ice Cream and Romney's product pages: one H1, one canonical, valid JSON-LD graph including Product/BreadcrumbList, one og:image and one Twitter card.
- GitHub `main` remains authoritative. Preserve newer commits and never force-push.

## Latest completed work

- Fixed a product detail page runtime bug: `product.html` previously referenced `renderDetail` before `assets/site.js` loaded, which could leave the detail area blank. The scripts now load first and the renderer is registered afterwards (commit `87e901d1fb3883eff924691756538fbd4aecc397`).
- Post-fix QA confirms all 41 completed detail records (12 Highland Cow + 29 Peter Rabbit) have valid slugs, labels and image paths; gallery paths also resolve.

- Full repository QA audit completed and saved in `docs/QA-AUDIT-2026-09-23.md`: 173 gift records checked; 0 duplicate IDs, slugs or SKUs; 0 missing referenced gift images; catalogue parses and site JS compiles.
- Both six-image Highland Cow upload batches are present in `images/highland-cows/`; all 12 exact Highland Cow detail records resolve to those images.

- Synced internal-page product facts for 29 exact Peter Rabbit products shared with `Mo31D/Lakesidepinicnew`, using `src/catalogue.json` as the factual source while preserving Black Sheep prices, product URLs and images.
- Peter Rabbit pages now selectively show useful structured details such as dimensions, material, packaging, suitability and care where verified.
- Added renderer support for `Suitable for` and `Care` rows.
- Peter Rabbit QA passed: all 29 shared product image paths exist; no duplicate IDs, slugs or SKUs were introduced.
- Owner later narrowed the catalogue scope: the 40 generic/store-photo Peter Rabbit records were removed. Keep only the 29 exact Peter Rabbit products matched to Lakeside Picnic unless the owner explicitly requests more.

- Completed internal product-detail content for 12 exact Highland Cow products. Each page now uses concise customer-facing copy and only useful fields: Brand, owner-confirmed Price, Product code, Range, verified Dimensions, Material and Availability.
- Added exact catalogue entries for LP76232 Ear Moofs, LP76228 Beer Cheers, LP75983 Hairdo and LP75341 With Thistle.
- Upgraded existing HC-004 and HC-005 in place to LP75454 Soaking and LP75453 Loo-Time, preserving their existing product URLs.
- Loo-Time and Soaking remain intentionally without a published price until the owner confirms their shop prices.
- Product-detail UI was simplified so Range replaces the redundant Collection row when a specific range is present.

- First exact Highland Cow image/product batch prepared: LP73651, LP73652, LP74354, LP74355, LP74358 and LP75455.
- Six user-supplied 800×800 product photos were converted to WebP with stable descriptive filenames and uploaded to `images/highland-cows/` on `main` in commit `432927584c2ff0ea1c34ab9e2e63211b535328c3`.
- Repository QA confirms all six catalogue image references resolve to existing files, with no duplicate IDs, slugs or SKUs in this batch.
- Catalogue/product pages are prepared on `main`: five new exact entries were added and existing HC-003 was upgraded in place to LP75455 Highland Cow Trio.
- Product detail rendering now shows optional Range and Dimensions fields.
- Latest Peter Rabbit and full Romney’s catalogue work was preserved from earlier GitHub updates.
- Owner evidence from `Blacksheep.zip` was extracted and recorded.
- The 19 supplied Highland Cow product screenshots were audited: 18 distinct products plus one duplicate.
- All 18 distinct supplied Highland Cow product images were mapped to official Lesser & Pavey / Leonardo stock codes.
- Christmas products from the owner screenshots were mapped to product codes and owner prices.
- The Christmas Highland Cow family with Merry Christmas sign/tree was corrected to `LP54679`.
- Existing GitHub Highland Cow image slots `images/157.png`–`images/179.png` were confirmed to be duplicate placeholder blobs rather than real product photos.
- A detailed source map exists at `docs/HIGHLAND-COW-SOURCE-MAP.md`.
- A previous recovery branch exists only as safety/history: `recovery/black-sheep-work-2026-09-23`. It is no longer the primary workflow.

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
1. Do not redesign/restart. Preserve the current Black Sheep visual system and reduced 108-product catalogue.
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
- Retained catalogue totals: 41 Gifts (29 Peter Rabbit + 12 Highland Cow), 12 Ice Cream and 55 Romney's.
- Post-cleanup QA: 108 retained product records total; every retained record has a real existing image and a description; zero placeholder-image records remain; zero duplicate IDs, slugs or SKUs.
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
- Updated Full range to the current curated catalogue only: 108 products total (41 gifts, 12 ice cream, 55 Romney's); removed stale Hawkshead/Fragrances filters and copy.
- Preserve this as a lightweight pre-visit feature; do not turn it into checkout unless the owner explicitly asks.

## Deep technical audit — 23 September 2026

- Audited every runtime HTML page, the full catalogue, shared JS/CSS, local links/assets, robots/sitemap and current project documentation.
- Active HTML has no broken local href/src references, duplicate IDs found in the audit, obsolete nested Gifts markup, or links to retired empty gift pages.
- Retired empty routes redirect with noindex; current category copy was aligned to actual retained products.
- Fixed decorative-chip filter collision, stale My list entries, product metadata/canonical updates and mobile-menu aria-expanded state.
- Replaced large collection-card/category-hero PNG usage with existing real product WebPs where practical.
- Added production sitemap and robots declaration.
- Known remaining non-blocking debt: many unused historical numbered PNG placeholder files and restore/b64 artifacts still exist in the repository; they are not referenced by the active catalogue.
