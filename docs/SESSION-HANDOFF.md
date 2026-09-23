# Black Sheep — Session Handoff

Updated: 23 September 2026

Latest verified QA milestone: `b497f948ee09b81a2746f03af6ea26b20d1f63e7`

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

Continue directly on `main`.

Priority:
1. Preserve the intentionally reduced catalogue: 12 completed Highland Cow products and 29 exact Peter Rabbit products only.
2. Do not re-add the 20 removed legacy Highland Cow records or 40 removed generic Peter Rabbit records unless the owner explicitly requests it.
3. Keep LP75453 Loo-Time and LP75454 Soaking without prices until the owner confirms them.
4. Treat the 29 exact Peter Rabbit shared-detail pages as complete and QA-passed.
5. Run the same repository QA after each new batch.
6. Later complete live desktop/mobile browser validation and synchronize the exact existing Black Sheep Sites project once it is identified.
7. Update this handoff and `docs/WORK-CHECKLIST.md` after each milestone.

Current QA status: no blocking repository issue found in the completed catalogue/detail scope.

## Navigation update — 23 September 2026

- Gifts & Souvenirs is now a direct top-level navigation link on desktop and mobile.
- The previous desktop dropdown and mobile nested gift submenu are intentionally disabled/removed at runtime.
- Gift-category navigation now lives inside `gifts.html`: search, a 14-option collection selector and compact quick filters.
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
- A compact My list button with item count is injected into the shared header on every page.
- Product cards and product detail pages now support Add to My list.
- The list is stored locally in the browser, supports quantity changes/removal/clear, and opens in a Black Sheep-styled side drawer.
- Added a "Full range" link to desktop and mobile navigation via shared JS, pointing to the existing `all-products.html`.
- Updated Full range to the current curated catalogue only: 108 products total (41 gifts, 12 ice cream, 55 Romney's); removed stale Hawkshead/Fragrances filters and copy.
- Preserve this as a lightweight pre-visit feature; do not turn it into checkout unless the owner explicitly asks.
