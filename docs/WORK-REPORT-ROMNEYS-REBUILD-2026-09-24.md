# Romney's product rebuild — final work report

Date: 24 September 2026  
Repository: `Mo31D/Blacksheep`  
Target branch: `main`  
Starting authoritative main: `99016db84e88e001f26374ed107c2b37a9fd4ccd`

## Scope completed

The Romney's / confectionery section was reconciled against current manufacturer sources while preserving Black Sheep as the seller and preserving the site's established static-product/search architecture.

Completed:
- Rebuilt the Romney's catalogue to **56 products** and the full site catalogue to **109 products**.
- Added **Shortbread Selection 300g** at the owner price of **£7.50**.
- Verified **37** Romney's-section records against exact current manufacturer pages (Romney's, Walker's Nonsuch or Elit as applicable).
- Added/retained **36 exact official local product images** in `images/romneys/official/`, converted to local WebP where appropriate.
- Enriched verified records with useful factual fields such as exact pack size, manufacturer/SKU where available, ingredients, allergens, dietary statements and nutrition.
- Corrected true third-party branding for Walker's Nonsuch and Elit products.
- Rebuilt every Romney's static detail page, `romneys.html`, `all-products.html`, ItemList JSON-LD and the product sitemap deterministically.
- Removed malformed duplicated catalogue tails that had accumulated after the first `</body>` in Romney's and Full Range pages.
- Made the Romney builder idempotent: a second `--check` run produces zero drift.
- Extended search-readiness QA to reject public supplier links, supplier `sameAs` leakage, brand/manufacturer schema mismatches, collection-card drift and duplicate official image provenance.
- Kept manufacturer URLs and source provenance **internal only** in `docs/ROMNEYS-SOURCE-MAP.md`.

## Black Sheep owner prices applied

Supplier/manufacturer retail prices were **not** copied into Black Sheep.

Applied owner prices:
- 200g biscuit bags: **£2.99**
- 150g fudge bags: **£3.85**
- Fudge bar: **£2.40**
- White Kendal Mint Cake 85g: **£1.50**
- White Kendal Mint Cake 170g / Large: **£2.80**
- Giant White Kendal Mint Cake 480g: **£4.70**
- Triple Pack Kendal Mint Cake 227g: **£4.90**
- Cinder Toffee 150g: **£3.30**
- Chocolate Coated Cinder Toffee 150g: **£3.50**
- Peanut Brittle 100g: **£2.10**
- Pink & White Nougat 120g: **£2.70**
- Shortbread Selection 300g: **£7.50**

Existing Black Sheep prices were retained where the owner's label could not be mapped safely to one exact product.

## Deliberately left unresolved

No product identity or size was guessed for:
- **Twin Biscuit Sachets — £6.90**: current 400g Biscuit Selection is only a candidate; its official listing does not prove “Twin Sachets”.
- **Boxed Fudge 150g — £4.90**: multiple distinct current 150g boxed fudge products exist.
- **Chocolate Covered Kendal Mint Cake Small / Medium / Large — £1.40 / £2.50 / £4.70**: the current exact 113g record is verified, but the shop's size labels are not yet mapped to exact weights.
- **Large Rock — £2.80**: current rock record does not establish the Large format.
- **Postcard Boxes — £4.95**: the four older 200g gift-box records are not proven to be the owner-described Postcard Boxes.
- Other older Romney's-section records with no exact current official page remain clearly marked `NO CURRENT OFFICIAL MATCH` in the internal source map.

## Customer-facing source rule

Public product pages do **not** show:
- manufacturer-source links,
- “Buy from manufacturer” links,
- supplier URLs,
- supplier retail prices,
- supplier URLs in Product JSON-LD.

The actual brand/manufacturer may still be shown as factual product information.

## QA

Final QA after owner-price reconciliation on `main`:
- **109** catalogue products.
- **56** Romney's / confectionery cards.
- **109** Full Range cards.
- **126** sitemap URLs.
- Zero legacy query-product URLs in sitemap.
- All generated product JSON-LD parseable.
- All required product/image files resolve.
- No public Romney's/Walker/Elit supplier URL leakage on customer pages.
- No duplicate official image provenance.
- Static Romney builder passes `--check` with zero drift.
- GitHub Actions owner-price reconciliation run: **35985625623 — success**.
- Final generated owner-price reconciliation commit: `a5ebfc2d57d36d079414260ae320b27377e68ce3`.

## Next work

1. Publish/sync the newest GitHub `main` to the **same existing** Black Sheep Sites project when its exact identity is available.
2. Perform live mobile + desktop QA after deployment.
3. Resolve only the explicitly pending product identities above when packaging/photo/weight evidence is available.
4. Search Console / live indexing review remains separate from repository QA.
