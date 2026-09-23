# Black Sheep — Romney's official-source enrichment report

Date: 23 September 2026

## Scope

Added verified manufacturer/source information to **35 exact products** in the current 55-product Romney's / confectionery catalogue.

No Black Sheep shop price was changed.

The remaining **20 products** were deliberately left without official-source metadata because an exact current manufacturer product page was not verified. No approximate or similar product page was substituted.

## What changed

- Added an `official` object to 35 exact records in `assets/catalog.js`.
- Each verified record now stores:
  - current official product name,
  - exact official product URL,
  - manufacturer,
  - verification date,
  - official SKU where directly verified.
- Updated all 35 canonical static product pages under `products/`.
- Each verified product page now visibly shows:
  - Official product name,
  - a direct "Official product page" manufacturer link,
  - Product code where verified.
- Product JSON-LD now links to the official product page with `sameAs` and identifies the manufacturer.
- Corrected the brand for ROM-054 and ROM-055 to **Walker's Nonsuch** in:
  - catalogue data,
  - static product pages,
  - Romney's collection cards,
  - Full Range cards,
  - Product JSON-LD.
- Added `docs/ROMNEYS-SOURCE-MAP.md` as the persistent source/provenance map.
- Extended `scripts/verify-search-readiness.mjs` so CI expects exactly 35 current verified Romney source matches and checks that the source map/static page/Product schema retain those official URLs.

## Verified products

- ROM-013 — After Dinner Mint Fudge 150G → https://mintcake.co.uk/products/hand-made-after-dinner-mint-butter-fudge-150g-bag — SKU 5022259602977
- ROM-014 — Triple Choc Fudge 150G → https://mintcake.co.uk/products/hand-made-triple-chocolate-butter-fudge-150g-bag — SKU 5022259603097
- ROM-015 — Honey Fudge 150G → https://mintcake.co.uk/products/hand-made-honey-butter-fudge-150g-bag — SKU 5022259603066
- ROM-016 — Ginger Fudge 150G → https://mintcake.co.uk/products/hand-made-ginger-fudge-150g-bag-3-pack — SKU 5022259603059
- ROM-017 — Butter Fudge 150g → https://mintcake.co.uk/products/150g-hand-made-butter-fudge — SKU 5022259602960
- ROM-018 — Cointreau & Orange FUDGE 150G → https://mintcake.co.uk/products/hand-made-cointreau-orange-butter-fudge-150g-bag
- ROM-019 — CHOCOLATE ORANGE FUDGE 150G → https://mintcake.co.uk/products/hand-made-milk-chocolate-orange-fudge-150g-bag-3-pack
- ROM-020 — CHOCOLATE FUDGE 150G → https://mintcake.co.uk/products/hand-made-chocolate-butter-fudge-150g-bag — SKU 5022259603011
- ROM-021 — CAPPUCCINO FUDGE 150G → https://mintcake.co.uk/products/hand-made-cappuccino-fudge-150g-bag-3-pack — SKU 5022259603035
- ROM-022 — BANOFFEE FUDGE 150G → https://mintcake.co.uk/products/hand-made-banoffee-butter-fudge-150g-bag
- ROM-023 — RUM & RAISIN FUDGE 150G → https://mintcake.co.uk/products/hand-made-cumbrian-rum-raisin-butter-fudge-150g-bag
- ROM-024 — WHITE CHOC FUDGE 150G → https://mintcake.co.uk/products/hand-made-belgian-white-chocolate-butter-fudge-150g-bag — SKU 5022259603110
- ROM-025 — SALTED CARAMEL FUDGE 150G → https://mintcake.co.uk/products/hand-made-sea-salted-caramel-butter-fudge-150g-bag — SKU 5022259603080
- ROM-026 — VANILLA FUDGE 150G → https://mintcake.co.uk/products/hand-made-vanilla-fudge-150g-bag-3-pack — SKU 5022259603103
- ROM-027 — Cherry Bakewell Fudge 150G → https://mintcake.co.uk/products/hand-made-cherry-bakewell-butter-fudge-150g-bag — SKU 5022259602991
- ROM-028 — CLOTTED CREAM FUDGE 150G → https://mintcake.co.uk/products/hand-made-clotted-cream-butter-fudge-150g-bag — SKU 5022259603004
- ROM-030 — Romney's Kendal Mint Cake 85g Bar → https://mintcake.co.uk/products/85g-white-kendal-mint-cake
- ROM-031 — Brown Kendal Mint Cake 85g → https://mintcake.co.uk/products/85g-brown-kendal-mint-cake
- ROM-032 — Kendal Mint Cake 170g → https://mintcake.co.uk/products/170g-white-kendal-mint-cake
- ROM-033 — Brown Kendal Mint Cake 170g → https://mintcake.co.uk/products/170g-brown-kendal-mint-cake
- ROM-034 — Extra Strong White Kendal Mint Cake 170g → https://mintcake.co.uk/products/170g-extra-strong-white-kendal-mint-cake
- ROM-035 — Romneys Kendal Mint Cake Giant White 480g → https://mintcake.co.uk/products/480g-giant-white-kendal-mint-cake — SKU 5022259602755
- ROM-036 — Triple Pack Kendal Mint Cake 227g → https://mintcake.co.uk/products/227g-triple-pack-kendal-mint-cake
- ROM-037 — Chocolate Covered Kendal Mint Cake 113g → https://mintcake.co.uk/products/113g-chocolate-covered-kendal-mint-cake
- ROM-038 — Romney's Strawberry Bon Bons → https://mintcake.co.uk/products/strawberry-bon-bons — SKU 5022259601918
- ROM-040 — Thank You Cat Novelty Box 300g → https://mintcake.co.uk/products/300g-thank-you-cat-novelty-box — SKU 5022259601673
- ROM-041 — Thank You Dog Novelty Box 300g → https://mintcake.co.uk/products/300g-thank-you-dog-novelty-box
- ROM-042 — Thank 'Ewe' Novelty Box 300g → https://mintcake.co.uk/products/300g-thank-ewe-novelty-box
- ROM-047 — Cinder Toffee Bag 150g → https://mintcake.co.uk/products/150g-cinder-toffee-bag — SKU 5022259601581
- ROM-048 — Chocolate Coated Cinder Toffee 150g → https://mintcake.co.uk/products/150g-chocolate-coated-cinder-toffee — SKU 5022259601598
- ROM-049 — Peanut Brittle Bar 100g → https://mintcake.co.uk/products/100g-peanut-brittle-bar — SKU 5022259601529
- ROM-050 — Pink & White Nougat Bar 120g → https://mintcake.co.uk/products/120g-pink-white-nougat-bar — SKU 5022259601512
- ROM-051 — Cumberland Sausage 85G → https://mintcake.co.uk/products/85g-mallow-cumberland-sausages — SKU 5022259601574
- ROM-054 — Walkers Original Dreamy Creamy Toffee 50g → https://walkers-nonsuch.co.uk/product/dreamy-creamy-toffee-bars-50g/
- ROM-055 — Lovely Liquorice - Walker's Nonsuch Toffee Bar 50g → https://walkers-nonsuch.co.uk/product/lovely-liquorice-toffee-bars-50g/

## Intentionally unmatched products

These 20 current catalogue products do not yet have an exact current official product page verified:

- ROM-001 — Lakeland Rock
- ROM-002 — Dubai Chocolate
- ROM-003 — Giant Shortbread Cookies
- ROM-004 — Giant Choc Chip Cookie 250G
- ROM-005 — Giant Ginger & Lemon Cookie 250G
- ROM-006 — Ginger Biscuits 200G
- ROM-007 — Golden Crunch Biscuits 200G
- ROM-008 — Choc Chip & Orange Biscuits 200G
- ROM-009 — Chocolate Chip Biscuits 200G
- ROM-010 — Farmhouse Oaties Biscuits 200G
- ROM-011 — Shortcake Biscuits 200G
- ROM-012 — Cherry & Almond Biscuits 200G
- ROM-029 — Vanilla Fudge Bar 110g
- ROM-039 — ROMNEY'S Sweet Bag
- ROM-043 — Gift Box Assorted Toffee 200G
- ROM-044 — Gift Box Mint Cake 200G
- ROM-045 — Gift Box Assorted Fudge 200G
- ROM-046 — Gift Box Clotted Cream Fudge 200G
- ROM-052 — Romney’s Sherbet Flyer 75g
- ROM-053 — Fun Kandy Mallow Sheep 35g

## Important source/brand notes

- The Romney's section is a Black Sheep merchandising section, not a guarantee that every item is manufactured by Romney's.
- ROM-054 Dreamy Creamy Toffee and ROM-055 Lovely Liquorice are manufactured by Walker's Nonsuch and are now labelled accordingly.
- Products without an exact official match must remain unlinked until the exact current manufacturer/source page is confirmed.
- Manufacturer online prices must not replace Black Sheep in-store prices.
- Ingredients/allergen/nutrition data should only be added when taken from the exact current official product page and should be rechecked when recipes or packaging change.

## QA checkpoint

- Verified-source records in catalogue: 35
- Unmatched Romney's-section records: 20
- Total Romney's/confectionery records: 55
- Current head before this report: `2bfa8efcb52fb72de04957bda420544d7e7ddbc4`
- Source map: `docs/ROMNEYS-SOURCE-MAP.md`
- Regression checks: `scripts/verify-search-readiness.mjs`

