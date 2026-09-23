# Black Sheep — resumable work checklist

Updated 2026-09-23. Repository: https://github.com/Mo31D/Blacksheep — branch main.
Starting GitHub revision: c09e625 (latest fetched at task start). GitHub is authoritative.

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
- [ ] Remaining 40 Peter Rabbit entries are older in-store/generic records without an exact detailed Lakeside match; leave unchanged until each product is positively identified.

## Phase 3 — shop photography and layout
- [ ] Open Google Maps in browser and inspect 360° photos.
- [ ] Add a suitable attributed tour/embed/link or permitted genuine images.
- [ ] Replace old shop imagery with owner's requested views when suitable originals available.
- [ ] Improve homepage hierarchy, readable text, navigation and mobile layout.
- [ ] Preserve shop identity: black/gold frame, colourful real merchandise, in-store catalogue.

## Phase 4 — checks, synchronization and handoff
- [ ] Verify catalogue images, links, duplicate IDs/slugs and current prices.
  - [x] Full repository QA audit completed for current gift catalogue: 173 gift records, 0 duplicate IDs, 0 duplicate slugs, 0 duplicate SKUs, 0 missing referenced gift images.
  - [x] `assets/catalog.js` parses and `assets/site.js` compiles successfully.
  - [x] Product-card → `product.html` routing and detail renderer wiring verified.
  - [x] Detailed audit saved in `docs/QA-AUDIT-2026-09-23.md`.
  - [x] First six-product batch QA passed: all six referenced image paths exist; no duplicate IDs, slugs or SKUs; owner prices are present; Range and Dimensions render support is present.
- [ ] Check desktop/mobile layouts and navigation/filter/product-detail behaviour.
  - [x] Found and fixed product detail runtime routing bug in `product.html`: `renderDetail` was referenced before `assets/site.js` loaded, causing an empty product page.
  - [x] Post-fix static runtime-order QA passed for all 41 completed detail records (12 Highland Cow + 29 Peter Rabbit), including primary/gallery image paths.
- [ ] Commit and push latest main; fetch and confirm.
- [ ] Push same source to resolved Sites project, save version, publish and confirm status.
- [ ] Record final commit, Sites version, URL, remaining gaps and exact next action here.

## Current next action
Product-page runtime routing is now fixed. The 12 exact Highland Cow detail pages and 29 exact shared Peter Rabbit detail pages have valid data, routes and images with no duplicate IDs/slugs/SKUs. Continue with the remaining verified Highland Cow products, then the Christmas range. Keep Loo-Time and Soaking prices unpublished until owner-confirmed. For Peter Rabbit, do not enrich the remaining 40 generic/in-store-only records until each is positively identified. Live-browser desktop/mobile validation and Sites synchronization remain open because the live custom domain/Sites project is not currently available to this session.
