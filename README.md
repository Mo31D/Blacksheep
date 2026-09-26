# The Black Sheep Shop — current website

Production domain: **https://theblacksheepshop.co.uk**

## Runtime structure
- Static HTML pages.
- D1 Product Core + Inventory Core are the production operational source of truth for product state, price, online orderability and inventory.
- `assets/catalog.js` is the published static storefront snapshot generated/reconciled from that operational state; it is no longer the operational authority.
- `assets/site.js` renders product cards/details, filters, navigation helpers and **My list**.
- `assets/style.css` contains the shared Black Sheep visual system.
- `products/<slug>.html` is the canonical, indexable product-detail layer. Each product page contains its customer-facing content, metadata, canonical URL and Product/Breadcrumb/WebPage/Store JSON-LD directly in HTML.
- `product.html?type=...&slug=...` is legacy-only, `noindex`, and redirects visitors to the matching static product URL.

## Current published/static catalogue baseline
The current D1/static publication baseline contains:
- 64 Gifts: 29 Peter Rabbit + 35 Highland Cow.
- 12 Luxury Lakes Ice Cream flavours.
- 55 Romney's / confectionery products.
- 15 Hawkshead Relish products.
- 146 product records total.

Product completeness is controlled by current Product Core/publication state. Do not infer missing owner prices, images or product facts, and do not revive removed legacy catalogue records.
- Hawkshead Relish now has canonical individual product pages using verified manufacturer facts; Black Sheep prices are not inferred from manufacturer retail prices.
- Lakeland Fragrances and other empty legacy gift categories redirect to the current Gifts page.

Do not re-add old placeholder catalogue records unless the owner explicitly approves a real image and proper description.

## Navigation
The main navigation is deliberately simple:
Home · Gifts & Souvenirs · Ice Cream · Romney's · Hawkshead Relish · Full range · About · Visit

Gift-category selection lives inside `gifts.html`; there is no nested Gifts menu.

## Basket and order-request flow
The storefront now includes a persistent browser basket backed by the current catalogue, plus `basket.html`, checkout details and `order-requested.html`.

- Adding an item uses the current server-authoritative catalogue identity/price model.
- The customer submits an **order request**; no payment is taken at submission.
- The Commerce Worker accepts `POST /v1/orders` with validation, Turnstile verification, idempotency and D1 persistence.
- Availability, reviewed quantities, fulfilment changes and the final amount are confirmed before payment.
- Admin V2, Product Core, Inventory Core and the reviewed-order workflow are live against Production D1; release history remains documented in `docs/ADMIN-V2-CHECKLIST.md` and the Product/Inventory phase reports.

## SEO
- Production `CNAME` is set to `theblacksheepshop.co.uk`.
- `sitemap.xml` contains the active pages plus all current static product URLs and product-image entries.
- Collection pages contain prerendered product cards/links in source HTML; JavaScript enhances filtering and My List without being required for discovery/indexing.
- `scripts/verify-search-readiness.mjs` and `.github/workflows/search-readiness.yml` guard the canonical/schema/sitemap/static-page invariants on future changes.
- `robots.txt` points to the production sitemap.
- Retired empty pages use noindex + immediate redirects.

## Images
Active Peter Rabbit/Highland Cow collection views use the smaller real product WebP files where available. The 26 September 2026 cleanup removed 170 proven-unused historical placeholder PNGs; remaining recovery/history assets are retained only where still referenced or intentionally useful.

## Current publishing rule
GitHub `main` is the source of truth for deployed code and generated static storefront files. Production D1 Published Product state is the operational product/commerce authority. Routine product, price, selling-state and stock changes should be made through Admin rather than by hand-editing catalogue code. Preserve newer commits, canonical `/products/<slug>.html` URLs and the request-order architecture; do not restore the old broad placeholder catalogue or nested Gifts menu.

## Commerce runtime boundary
- Static storefront files and product pages remain on the website layer.
- The separate `commerce/` Worker handles order API, admin routes, secure customer review and Resend webhook routes.
- Customer order submission, Admin operations, reviewed-order reservations and fulfilment now share Production D1 as their operational source of truth.
- Commerce code changes still require guarded CI/staging regression before any explicit Production deployment.

## Search architecture rule
- Treat `assets/catalog.js` as the generated published storefront snapshot, not as the operational Product Core authority.
- Do not make indexable product content depend on client-side rendering.
- Every published catalogue record must have a matching `products/<slug>.html` page and sitemap entry.
- Product and collection links must point to the static product URL, never back to the legacy query-string route.
- Do not add online-purchase Offer markup unless the site actually supports that purchase flow; current product pages describe in-store availability truthfully.
- Preserve the Store → WebSite → WebPage/CollectionPage/Product entity graph and self-referencing canonicals.

### Updating the verified Lakes Ice Cream range

`assets/catalog.js` is the data source. The `official` object on each ice-cream record preserves the manufacturer URL, exact image provenance, verification date, ingredients, allergens, dietary statements, awards and nutrition (per **100 ml**). See `docs/LAKES-ICE-CREAM-SOURCE-MAP.md`.

The former standalone Ice Cream builder has been retired. Specialist manufacturer ingredients/allergen/nutrition provenance remains in `assets/catalog.js` and `docs/LAKES-ICE-CREAM-SOURCE-MAP.md`; any customer-facing publication must flow through the Phase 6 publication pipeline and `scripts/verify-search-readiness.mjs`.

### Verified Hawkshead Relish sources

The 15 current Hawkshead Relish records store their manufacturer URL and verified product facts in `assets/catalog.js`; the internal provenance list is `docs/HAWKSHEAD-RELISH-SOURCE-MAP.md`. The public static pages live under `products/hr-*.html`, are pre-rendered in `hawkshead-relish.html` and `all-products.html`, and are included in `sitemap.xml`.

Do **not** import Hawkshead Relish manufacturer retail prices as Black Sheep prices. Numeric Hawkshead prices are published only from owner-confirmed Black Sheep pricing; currently 14 Hawkshead products have owner-confirmed prices and 1 remains unpriced.

Exact owner-supplied images are wired for every active Hawkshead Relish product in `images/hawkshead-relish/`. HR-001 has a two-image gallery (pack-shot + lifestyle). Five Fruit Marmalade (former HR-008) remains removed from the active catalogue at the owner's request.

### Verified Romney's / confectionery sources

Romney's/confectionery product provenance is stored internally in `docs/ROMNEYS-SOURCE-MAP.md`. Manufacturer URLs are verification metadata only and must **not** appear on customer-facing product pages, product images/names, or Product JSON-LD.

Production D1 Published Product state is authoritative for Black Sheep product identity, price and selling state. The former standalone Romney's builder has been retired; specialist confectionery provenance remains in `docs/ROMNEYS-SOURCE-MAP.md` and published static output is reconciled through the Phase 6 publication pipeline. `scripts/verify-search-readiness.mjs` continues to reject supplier-link leakage, schema mismatches, missing assets and collection-card drift. Supplier retail prices are never a data source for Black Sheep pricing.


### Highland Cow catalogue follow-up

The current published/static baseline contains **35 Highland Cow records** inside the 64-product Gifts section. Some newer seasonal records still need owner-supplied dedicated imagery or final data; missing values must not be inferred. Their current publication/orderability state is governed by Product Core and the Phase 6 publication pipeline, not by the older 24 September placeholder assumptions. `docs/HIGHLAND-COW-PLACEHOLDERS.md` is retained as historical mapping evidence.
