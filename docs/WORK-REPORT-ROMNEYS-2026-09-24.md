# Black Sheep — Romney's product pages rebuild
Date: 24 September 2026

## 1. Starting GitHub SHA

Task-start authoritative `main`: `2076e90674b6cd2e061a85137e13d0265da0e394`.

A small pre-staging image-preparation sequence advanced `main` to `99016db84e88e001f26374ed107c2b37a9fd4ccd`; all later implementation work was built as a fast-forward descendant of that state.

## 2. Final GitHub SHA

Final generated implementation before handoff/documentation-only cleanup: `7bac983fcba1a6fcd45d42ddb9ee97b7999e284c`.

The final `main` head after handoff/documentation commits is reported in the completion chat because a commit cannot self-reference its own SHA.

## 3. Products updated

- Rebuilt/reconciled all existing Romney's/confectionery static product pages from the authoritative catalogue.
- 55 pre-existing Romney's/confectionery records were retained and regenerated.
- Current Romney's/confectionery catalogue after this task: **56 products**.
- Current full catalogue: **109 products**.

## 4. Products added

- **ROM-056 — Shortbread Selection 300g — £7.50**
  - Exact current official product identified as **300G BUTTER SHORTBREAD SELECTION**.
  - Official SKU: `5022259602779`.
  - Exact official product image is hosted locally as WebP.
  - Static page, collection cards, Full Range, ItemList and sitemap were added/reconciled.

No record was invented for **Twin Biscuit Sachets — £6.90** or **Boxed Fudge 150g — £4.90** because exact 1:1 official identity was not sufficiently certain.

## 5. Products retired

None.

No existing Romney's/confectionery product was removed in this rebuild.

## 6. Exact price changes

Relative to the task-start `main`:

- **ROM-035 — Giant White Kendal Mint Cake 480g:** corrected from **£4.70 to £2.70**. The £4.70 owner price belongs to a chocolate-covered Large size and must not be applied to the non-chocolate Giant White 480g product.
- **ROM-056 — Shortbread Selection 300g:** added at **£7.50**.

Owner-confirmed prices already present at task start were preserved and verified, including:
- standard 200g biscuit records: **£2.99**
- standard 150g fudge bags: **£3.85**
- Vanilla Fudge Bar 110g: **£2.40**
- White/Brown/Extra Strong 170g Kendal Mint Cake: **£2.50**
- Triple Pack Kendal Mint Cake: **£4.90**
- Cinder Toffee: **£3.30**
- Chocolate Coated Cinder Toffee: **£3.50**
- Peanut Brittle: **£2.10**
- Pink & White Nougat: **£2.70**

The exact owner Small/Medium/Large mapping for chocolate-covered Kendal Mint Cake remains unresolved, so the verified 113g record keeps its existing Black Sheep price rather than receiving a guessed size price.

## 7. Official pages successfully matched

Current catalogue contains **37 exact official/manufacturer mappings**.

This includes:
- the verified Romney's fudge range
- verified 85g/170g/Giant/Triple/Chocolate-Covered Kendal Mint Cake products
- Strawberry Bon Bons
- Thank You Cat / Dog / Thank 'Ewe' novelty boxes
- Cinder Toffee / Chocolate Coated Cinder Toffee
- Peanut Brittle
- Pink & White Nougat
- Cumberland Sausage
- **Shortbread Selection 300g**
- **Dubai Chocolate** mapped to **Elit**
- two Walker's Nonsuch 50g toffee bars

Full per-product source URLs and verification fields are in `docs/ROMNEYS-SOURCE-MAP.md`.

## 8. Products still unmatched

**19 current catalogue records** remain without a safe exact current official page:
- ROM-001 Lakeland Rock
- ROM-003 Giant Shortbread Cookies
- ROM-004 Giant Choc Chip Cookie 250g
- ROM-005 Giant Ginger & Lemon Cookie 250g
- ROM-006 Ginger Biscuits 200g
- ROM-007 Golden Crunch Biscuits 200g
- ROM-008 Choc Chip & Orange Biscuits 200g
- ROM-009 Chocolate Chip Biscuits 200g
- ROM-010 Farmhouse Oaties Biscuits 200g
- ROM-011 Shortcake Biscuits 200g
- ROM-012 Cherry & Almond Biscuits 200g
- ROM-029 Vanilla Fudge Bar 110g
- ROM-039 Romney's Sweet Bag
- ROM-043 Gift Box Assorted Toffee 200g
- ROM-044 Gift Box Mint Cake 200g
- ROM-045 Gift Box Assorted Fudge 200g
- ROM-046 Gift Box Clotted Cream Fudge 200g
- ROM-052 Romney's Sherbet Flyer 75g
- ROM-053 Fun Kandy Mallow Sheep 35g

These records keep known Black Sheep information/images and are not force-matched to merely similar current products.

## 9. Brands corrected

- **Dubai Chocolate:** visible brand and Product schema use **Elit**, not Romney's.
- **ROM-054 / ROM-055:** retain **Walker's Nonsuch** as the actual brand/manufacturer.
- Romney's remains the retail collection grouping where appropriate, but Product brand/manufacturer reflects the real maker.

## 10. Images replaced

- **27 current Romney's/confectionery records** now use local optimised official product images.
- The final source-sync run refreshed **25 exact images**.
- The two Walker's images remain from previously verified local manufacturer copies because the manufacturer server returned HTTP 403 during the final automated refresh; their existing verified local copies and provenance were retained.
- **9 shared/generic Shopify `og:image` candidates were rejected** because the same image URL was returned for different products. Those products intentionally retain their existing Black Sheep product images instead of using a misleading "official" image.
- CI now rejects duplicate official-image provenance across different Romney records.

## 11. New page design/template changes

Romney's/confectionery detail pages now use a deterministic static template with:
- breadcrumb/back-to-range navigation
- large contained product image
- product name and Black Sheep retail price above the fold
- concise Black Sheep customer-facing description
- My List interaction
- brand, pack, product code, manufacturer and in-store availability rows
- progressive-disclosure sections for ingredients, allergens, dietary information, nutrition and awards when verified
- allergy/packaging-change warning
- existing cream/black/gold Black Sheep styling preserved

No whole-site redesign was performed.

## 12. Schema changes

- Product JSON-LD remains static and indexable on `/products/<slug>.html`.
- Product `brand` and `manufacturer` now reflect actual identity.
- Supplier/manufacturer product URLs are **not** exposed through `sameAs` or other customer-facing Product schema.
- No supplier retail price was imported.
- No ecommerce `Offer`/checkout claim was introduced.
- Black Sheep price and pack/factual details are represented without pretending the site is an online checkout.

## 13. Sitemap changes

Current generated sitemap:
- **126 URLs**
- **109 product URLs**
- **115 image entries**
- includes the new Shortbread Selection static product page
- contains no legacy `product.html?type=...&slug=...` product URLs

## 14. QA/tests and results

Final staged QA passed.

Verified:
- `node scripts/verify-search-readiness.mjs` — **PASS**
- `node scripts/build-romneys.mjs --check` — **PASS / all outputs match**
- **109** catalogue records
- **56** Romney's/confectionery records
- **56** Romney cards in `romneys.html`
- **109** cards in `all-products.html`
- no duplicate catalogue IDs/slugs/non-empty SKUs reported by the existing verifier
- no duplicate official image provenance
- no public “Manufacturer source” / “Buy from manufacturer”
- no supplier-shop URLs on customer product pages
- one H1 and one canonical on representative rebuilt product pages
- static `/products/<slug>.html` architecture preserved
- Product schema brand/manufacturer checks preserved
- sitemap/catalogue/static pages reconciled
- generated collection files contain one HTML document only; previous trailing duplicate catalogue markup was removed
- My List button remains wired to static Romney product slugs

## 15. Sites sync status

**Not performed in this session.**

The exact existing Black Sheep Work/Sites project was not resolved through the available repository workflow. Per owner instruction, **no duplicate Sites project was created**. GitHub `main` remains authoritative; the existing Sites project must sync from the newest `main` when its exact identity is available.

## 16. Live deployment status

At implementation-report creation, the validated source is ready for fast-forward to `main`. Live production verification follows the final `main` push. The completion chat records the observed deployment state.

## 17. Unresolved owner questions

1. **Chocolate Covered Kendal Mint Cake:** map owner labels **Small £1.40 / Medium £2.50 / Large £4.70** to exact Black Sheep weights/packaging. The exact 113g product is verified but its owner size label is not assumed.
2. **Rock:** confirm which actual pack is Small £1.50 and which is Large £2.80. Current unweighted Lakeland Rock remains £1.50.
3. **Twin Biscuit Sachets — £6.90:** confirm the exact pack/photo. The current official 400g Biscuit Selection is not described as “Twin Biscuit Sachets”, so it was not substituted.
4. **Boxed Fudge 150g — £4.90:** confirm the exact flavour/box; multiple current 150g boxed fudge products exist.
5. **Postcard Boxes — £4.95:** confirm whether any of ROM-043–046 correspond exactly to the owner-described Postcard Boxes before changing those records/prices.

## 18. Exact recommended next action

1. Fast-forward validated staging work to current GitHub `main` only if `main` has not advanced.
2. Let the normal `search-readiness` workflow pass on `main`.
3. Verify the live production domain on mobile and desktop for representative Romney, Elit and Walker pages.
4. Sync the **same existing** Black Sheep Sites project from the newest GitHub `main` when that project is identifiable; do not create a duplicate.
5. For the unresolved owner questions above, use actual Black Sheep packaging/photos/weights before applying any remaining size-specific prices.
