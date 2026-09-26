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

## Current curated catalogue
Only products with real product imagery and descriptions are retained:
- 41 Gifts: 29 Peter Rabbit + 12 Highland Cow.
- 12 Luxury Lakes Ice Cream flavours.
- 55 Romney's / confectionery products.
- 16 Hawkshead Relish products.
- 146 product records total.
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
- Admin V2 review/refund/reporting work is tracked separately in `docs/ADMIN-V2-CHECKLIST.md`; staging completion must not be mistaken for a production Admin V2 release.

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
GitHub `main` is the source of truth for deployed code and generated static storefront files. Production D1 Published Product state is the operational product/commerce authority. Routine product, price, selling-state and stock changes should be made through Admin rather than by hand-editing catalogue code. Preserve newer commits, canonical `/products/<slug>.html` URLs and the request-order architecture; do not restore the old broad placeholder catalogue or nested Gifts menu.

## Commerce runtime boundary
- Static storefront files and product pages remain on the website layer.
- The separate `commerce/` Worker handles order API, admin routes, secure customer review and Resend webhook routes.
- Customer order submission and Admin V2 release state are deliberately tracked separately.
- Production Admin V2 must only move forward through the guarded release checklist; current staging success does not authorize a production migration/deploy.

## Search architecture rule
- Treat `assets/catalog.js` as the generated published storefront snapshot, not as the operational Product Core authority.
- Do not make indexable product content depend on client-side rendering.
- Every published catalogue record must have a matching `products/<slug>.html` page and sitemap entry.
- Product and collection links must point to the static product URL, never back to the legacy query-string route.
- Do not add online-purchase Offer markup unless the site actually supports that purchase flow; current product pages describe in-store availability truthfully.
- Preserve the Store → WebSite → WebPage/CollectionPage/Product entity graph and self-referencing canonicals.

### Updating the verified Lakes Ice Cream range

`assets/catalog.js` is the data source. The `official` object on each ice-cream record preserves the manufacturer URL, exact image provenance, verification date, ingredients, allergens, dietary statements, awards and nutrition (per **100 ml**). See `docs/LAKES-ICE-CREAM-SOURCE-MAP.md`.

The legacy `scripts/build-icecream.mjs` tool is retained only as a specialist-content maintenance helper for manufacturer ingredients/allergen/nutrition material that Product Core does not yet model. It is **not** a publication authority and is no longer part of Search Readiness CI. Any specialist-content maintenance must finish by reconciling through the Phase 6 publication pipeline and `scripts/verify-search-readiness.mjs`; do not commit builder output that contradicts D1 Published Product price, selling state, slug or online-orderability.

### Verified Hawkshead Relish sources

The 15 current Hawkshead Relish records store their manufacturer URL and verified product facts in `assets/catalog.js`; the internal provenance list is `docs/HAWKSHEAD-RELISH-SOURCE-MAP.md`. The public static pages live under `products/hr-*.html`, are pre-rendered in `hawkshead-relish.html` and `all-products.html`, and are included in `sitemap.xml`.

Do **not** import Hawkshead Relish manufacturer retail prices as Black Sheep prices. Numeric Hawkshead prices are published only from owner-confirmed Black Sheep pricing; currently 14 Hawkshead products have owner-confirmed prices and 1 remains unpriced.

Exact owner-supplied images are wired for every active Hawkshead Relish product in `images/hawkshead-relish/`. HR-001 has a two-image gallery (pack-shot + lifestyle). Five Fruit Marmalade (former HR-008) remains removed from the active catalogue at the owner's request.

### Verified Romney's / confectionery sources

Romney's/confectionery product provenance is stored internally in `docs/ROMNEYS-SOURCE-MAP.md`. Manufacturer URLs are verification metadata only and must **not** appear on customer-facing product pages, product images/names, or Product JSON-LD.

Production D1 Published Product state is authoritative for Black Sheep product identity, price and selling state. The legacy `scripts/build-romneys.mjs` helper remains only for specialist confectionery details that Product Core does not yet model; it is not part of CI publication authority. `scripts/verify-search-readiness.mjs` continues to reject supplier-link leakage, schema mismatches, missing assets and collection-card drift. Supplier retail prices are never a data source for Black Sheep pricing.


### Highland Cow placeholders

23 owner-supplied Highland Cow / seasonal product codes and names were added on 24 September 2026 as explicit placeholders. They have no inferred image or price, their product pages are `noindex,follow`, and they are excluded from the sitemap until image, price and verified product details are completed. Mapping: `docs/HIGHLAND-COW-PLACEHOLDERS.md`.
