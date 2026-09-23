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
- [x] Add exact products / update overlapping entries, preserving old product URLs where practical.
  - [x] Added LP73651, LP73652, LP74354, LP74355 and LP74358 as exact catalogue entries.
  - [x] Upgraded existing HC-003 in place to LP75455 Highland Cow Trio, preserving its existing slug/URL.
- [x] Apply owner prices only where clearly mapped; flag ambiguous prices privately for this six-product batch (£9.50 singles, £13.99 pairs, £14.95 trio).
- [ ] Add verified Christmas products.
- [x] Completed customer-facing detail data for the first 12 exact Highland Cow products: concise descriptions, brand, product code, range, dimensions where verified, material, owner-confirmed prices, and availability handling.

## Phase 3 — shop photography and layout
- [ ] Open Google Maps in browser and inspect 360° photos.
- [ ] Add a suitable attributed tour/embed/link or permitted genuine images.
- [ ] Replace old shop imagery with owner's requested views when suitable originals available.
- [ ] Improve homepage hierarchy, readable text, navigation and mobile layout.
- [ ] Preserve shop identity: black/gold frame, colourful real merchandise, in-store catalogue.

## Phase 4 — checks, synchronization and handoff
- [ ] Verify catalogue images, links, duplicate IDs/slugs and current prices.
  - [x] First six-product batch QA passed: all six referenced image paths exist; no duplicate IDs, slugs or SKUs; owner prices are present; Range and Dimensions render support is present.
- [ ] Check desktop/mobile layouts and navigation/filter/product-detail behaviour.
- [ ] Commit and push latest main; fetch and confirm.
- [ ] Push same source to resolved Sites project, save version, publish and confirm status.
- [ ] Record final commit, Sites version, URL, remaining gaps and exact next action here.

## Current next action
The first 12 exact Highland Cow products now have complete internal product-detail data and valid image paths on GitHub. Continue with the next verified Highland Cow products, then the Christmas range. Keep detail pages selective: short product description plus Brand, Price when owner-confirmed, Product code, Range, Dimensions when verified, Material and Availability. Do not add filler or duplicate Collection/Range information. Public live-site verification remains pending because the custom domain is not reachable from the current web checker. Sites synchronization remains blocked until the exact existing Black Sheep Sites project is identified; never create a duplicate.
