# Black Sheep — official Lakes Ice Cream rebuild, 23 September 2026

## Revision and resume point

Starting GitHub main: `b6c99de01e37e91a876852dcab062ec1ac33d9eb`, checked remotely before work. A new clean worktree was used; older dirty Work state was not restored. Final implementation SHA and post-push checks will be recorded in a follow-up documentation commit.

## Completed implementation

Preserved the current design and static SEO architecture: 108 retained products (41 gifts, 12 ice creams, 55 confectionery), 17 core pages and 125 sitemap URLs. No offers, stock counts, checkout, delivery or prices invented. Read the handoff/checklist/README/owner requests/Highland Cow source map and search-readiness script/workflow before editing. Baseline verifier passed.

A real nested-route regression was repaired: My List drawer images and links now resolve from `/products/` using root-relative paths. My List remains a pre-visit planner; stale Pistachio saved entries are pruned rather than silently substituting a different flavour.

Rebuilt all 12 ice creams using their individually opened official manufacturer pages. Imported full published ingredient facts, allergens, vegetarian statements, explicitly published gluten-free statements only, nutrition per 100 ml and verified award badge labels. Rum's 1.5% ingredient proportion is explicitly not presented as ABV. Manufacturer pack formats are preserved as research only, not shop stock. Product descriptions are concise original copy. All pages warn about changing recipes, current packaging, cones and shared scooping equipment. Source/provenance record: `docs/LAKES-ICE-CREAM-SOURCE-MAP.md`; structured factual snapshot: each catalogue record's `official` object.

Pistachio was removed from the current catalogue, collection cards, search data, ItemLists and sitemap. Plum & Damson was added as `plum-and-damson`, ID `ICE-WEB-013`, at `/products/plum-and-damson.html`. The old `/products/pistachio.html` is a noindex retirement notice linking to the current range, not an indexable stale product or a misleading automatic redirect to another flavour. Manufacturer warnings about pistachios/almonds remain intentionally intact.

## Final flavour list / individually inspected sources

1. Double Jersey — https://lakesicecream.com/ice-cream-product/double-jersery/
2. Thunder & Lightning — https://lakesicecream.com/ice-cream-product/thunder-lightning/
3. Raspberry Pavlova — https://lakesicecream.com/ice-cream-product/raspberry-pavlova/
4. Cartmel Sticky Toffee Pudding — https://lakesicecream.com/ice-cream-product/cartmel-sticky-toffee-pudding-ice-cream/
5. Biscoff (Belgian Biscuit) — https://lakesicecream.com/ice-cream-product/new-belgian-biscuit-ice-cream/
6. Death by Chocolate — https://lakesicecream.com/ice-cream-product/death-by-chocolate/
7. Mint Choc Chip — https://lakesicecream.com/ice-cream-product/mint-choc-chip/
8. Blackcurrant & Cream — https://lakesicecream.com/ice-cream-product/blackcurrant-and-cream/
9. Cookies & Cream — https://lakesicecream.com/ice-cream-product/cookies-and-cream/
10. Crushed Strawberry — https://lakesicecream.com/ice-cream-product/crushed-strawberry/
11. Plum & Damson — https://lakesicecream.com/ice-cream-product/plum-and-damson/
12. Rum & Raisin — https://lakesicecream.com/ice-cream-product/rum-and-raisin/

Range discovery: https://lakesicecream.com/luxury-ice-cream/ and https://lakesicecream.com/. Supplier workbook link retained in source map; workbook itself was not parsed. Research used complete current official HTML, with Cloud Browser inspection of the range and Plum & Damson page, not search snippets alone.

## Images and static/search outputs

All 12 exact flavour photographs downloaded from the image displayed on its official page, checked as a contact sheet, and converted to WebP quality 88 without crop/upscale. Dimensions 676 × 694, around 44–83 KB each. Stable `images/icecream/<catalogue-slug>.webp` filenames; exact remote URLs in source map and catalogue. Manufacturer cone photos are identified as serving suggestions, not allergen guarantees.

Updated 11 existing flavour pages, created Plum & Damson, retired Pistachio (13 affected route files). Updated collection cards and ItemList on `icecream.html` and `all-products.html`; product graph descriptions/images/manufacturer/verified additional properties/awards; canonical and social metadata; sitemap URLs and image entries. Product count remains 108, sitemap 125. Core Open Graph tags were preserved intact.

Added `scripts/build-icecream.mjs` and explicit product template. Running with `--check` rejects drift in generated pages, cards, schema and sitemap. Search-readiness CI remains intact and now includes this check. Gift/confectionery catalogue data was compared with the starting commit and is unchanged.

## Validation completed before push

- `node scripts/verify-search-readiness.mjs`: PASS, 108 products / 17 active core pages / 125 sitemap URLs.
- `node scripts/build-icecream.mjs --check`: PASS; second generation is unchanged.
- `node --check assets/site.js`: PASS.
- BeautifulSoup audit: 136 HTML pages, no broken internal href/src paths, duplicate IDs, invalid JSON-LD, unexpected H1 counts, raw head text or visible og:image fragments. Noindex redirect shells are correctly exempt from the H1 rule.
- JSDOM execution against the actual static pages and site.js: PASS for nested-product My List image/link resolution, adding, quantity changes, clearing, drawer close, stale Pistachio pruning, preserving prerendered cards, Plum search, 12-item icecream filter and mobile-menu open/close.
- Visual contact sheet of all 12 downloaded images inspected.
- Baseline live Cloud Browser Home and Ice Cream inspected; final post-deployment review is recorded below when available. No claim of physical mobile testing is made by these local checks.

## Sites and unresolved work

Sites owner listing returned three unrelated projects; editor listing returned none. No Black Sheep project ID or `.openai/hosting.json` was available. No duplicate project created and no unrelated Sites project changed. Existing Sites synchronization remains blocked on identifying/accessing the existing project; GitHub work proceeds independently as requested.

Next action: check the published GitHub revision, complete live desktop/mobile-width review of Home, Gifts, Peter Rabbit, Highland Cows, Ice Cream, one icecream product, Romney's, Full Range, About and Visit; then sync that exact revision to the existing Black Sheep Sites project when its access is available. Do not redo the manufacturer research: use the source map and catalogue snapshot. Never restore the old Work tree or force-push.
