# The Black Sheep Shop — current website

Production domain: **https://theblacksheepshop.co.uk**

## Runtime structure
- Static HTML pages.
- `assets/catalog.js` is the catalogue source of truth.
- `assets/site.js` renders product cards/details, filters, navigation helpers and **My list**.
- `assets/style.css` contains the shared Black Sheep visual system.
- `product.html?type=...&slug=...` renders product-detail pages from the catalogue.

## Current curated catalogue
Only products with real product imagery and descriptions are retained:
- 41 Gifts: 29 Peter Rabbit + 12 Highland Cow.
- 12 Luxury Lakes Ice Cream flavours.
- 55 Romney's / confectionery products.
- 108 product records total.
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
- `sitemap.xml` contains the active static pages plus current product-detail URLs.
- `robots.txt` points to the production sitemap.
- Retired empty pages use noindex + immediate redirects.

## Images
Active Peter Rabbit/Highland Cow collection views now use the smaller real product WebP files where possible. Many old numbered PNG placeholders and recovery assets remain in the repository for history/recovery but are not part of the active catalogue.

## Current publishing rule
GitHub `main` is the source of truth. Preserve newer commits; do not restore the old broad placeholder catalogue, the old nested Gifts menu, or checkout functionality unless the owner explicitly requests it.
