# The Black Sheep Shop — current website

Production domain: **https://theblacksheepshop.co.uk**

## Runtime structure
- Static HTML pages.
- `assets/catalog.js` is the catalogue source of truth.
- `assets/site.js` renders product cards/details, filters, navigation helpers and **My list**.
- `assets/style.css` contains the shared Black Sheep visual system.
- `products/<slug>.html` is the canonical, indexable product-detail layer. Each product page contains its customer-facing content, metadata, canonical URL and Product/Breadcrumb/WebPage/Store JSON-LD directly in HTML.
- `product.html?type=...&slug=...` is legacy-only, `noindex`, and redirects visitors to the matching static product URL.

## Current curated catalogue
Only products with real product imagery and descriptions are retained:
- 41 Gifts: 29 Peter Rabbit + 12 Highland Cow.
- 12 Luxury Lakes Ice Cream flavours.
- 56 Romney's / confectionery products.
- 109 product records total.
- Hawkshead Relish remains an informational in-store range page; no individual Hawkshead products are currently published.
- Lakeland Fragrances and other empty legacy gift categories redirect to the current Gifts page.

Do not re-add old placeholder catalogue records unless the owner explicitly approves a real image and proper description.

## Navigation
The main navigation is deliberately simple:
Home · Gifts & Souvenirs · Ice Cream · Romney's · Hawkshead Relish · Full range · About · Visit

Gift-category selection lives inside `gifts.html`; there is no nested Gifts menu.

## My list
**My list** is a lightweight pre-visit planning feature stored in browser localStorage. It is not checkout, payment or online ordering. Removed/stale catalogue items are pruned from saved lists automatically.

## SEO
- Production `CNAME` is set to `theblacksheepshop.co.uk`.
- `sitemap.xml` contains the active pages plus all current static product URLs and product-image entries.
- Collection pages contain prerendered product cards/links in source HTML; JavaScript enhances filtering and My List without being required for discovery/indexing.
- `scripts/verify-search-readiness.mjs` and `.github/workflows/search-readiness.yml` guard the canonical/schema/sitemap/static-page invariants on future changes.
- `robots.txt` points to the production sitemap.
- Retired empty pages use noindex + immediate redirects.

## Images
Active Peter Rabbit/Highland Cow collection views now use the smaller real product WebP files where possible. Many old numbered PNG placeholders and recovery assets remain in the repository for history/recovery but are not part of the active catalogue.

## Current publishing rule
GitHub `main` is the source of truth. Preserve newer commits; do not restore the old broad placeholder catalogue, the old nested Gifts menu, or checkout functionality unless the owner explicitly requests it.

## Search architecture rule
- Keep `assets/catalog.js` as the catalogue data source, but do not make indexable product content depend on client-side rendering.
- Every published catalogue record must have a matching `products/<slug>.html` page and sitemap entry.
- Product and collection links must point to the static product URL, never back to the legacy query-string route.
- Do not add online-purchase Offer markup unless the site actually supports that purchase flow; current product pages describe in-store availability truthfully.
- Preserve the Store → WebSite → WebPage/CollectionPage/Product entity graph and self-referencing canonicals.

### Updating the verified Lakes Ice Cream range

`assets/catalog.js` is the data source. The `official` object on each ice-cream record preserves the manufacturer URL, exact image provenance, verification date, ingredients, allergens, dietary statements, awards and nutrition (per **100 ml**). See `docs/LAKES-ICE-CREAM-SOURCE-MAP.md`.

After changing an ice-cream record, run:

```sh
node scripts/build-icecream.mjs
node scripts/verify-search-readiness.mjs
node scripts/build-icecream.mjs --check
```

The builder updates the 12 static flavour pages from `scripts/templates/icecream-product.html`, ice-cream cards in both collections, their ItemLists, sitemap image entries, and the retired Pistachio route. CI rejects drift. It does not regenerate or overwrite unrelated gift/confectionery product pages. To change the flavour-page layout, edit the template/builder, not its generated output. Changing the number of flavours requires deliberately updating the builder's 12-card guard and reviewing shop stock.

### Verified Romney's / confectionery sources

Romney's/confectionery product provenance is stored internally in `docs/ROMNEYS-SOURCE-MAP.md`. Manufacturer URLs are verification metadata only and must **not** appear on customer-facing product pages, product images/names, or Product JSON-LD.

`assets/catalog.js` remains authoritative for Black Sheep prices and product identity. `scripts/build-romneys.mjs` regenerates the static Romney product pages, Romney collection, Full Range Romney cards, ItemLists and sitemap product entries. `scripts/verify-search-readiness.mjs` rejects supplier-link leakage, brand/schema mismatches, missing assets and collection-card drift.

After changing a Romney/confectionery record, run:

```sh
node scripts/build-romneys-source-map.mjs
node scripts/build-romneys.mjs
node scripts/verify-search-readiness.mjs
node scripts/build-romneys.mjs --check
```

Supplier retail prices are never a data source for Black Sheep pricing.
