# Black Sheep — Current Catalogue Field Audit

**Date:** 25 September 2026  
**Repository:** Mo31D/Blacksheep  
**Audited branch:** main  
**Audit source commit:** 66a5053ed2cf97502216b658f7e78c28873b7240  
**Frozen catalogue blob:** assets/catalog.js → b382d8e161f165f7291da34b1cb23bef06c2742d  
**Purpose:** Freeze the exact pre-migration product-data baseline before D1 Product/Inventory implementation.

---

## 1. Frozen baseline

The current catalogue contains **146 products**.

| Section | Products | Numeric price | SKU | Barcode | Image | Image pending |
|---|---:|---:|---:|---:|---:|---:|
| Gifts | 64 | 63 | 62 | 15 | 50 | 14 |
| Ice Cream | 12 | 0 | 0 | 0 | 12 | 0 |
| Romney's | 55 | 55 | 21 | 0 | 55 | 0 |
| Hawkshead Relish | 15 | 14 | 0 | 0 | 15 | 0 |
| Fragrances | 0 | 0 | 0 | 0 | 0 | 0 |
| **Total** | **146** | **132** | **83** | **15** | **132** | **14** |

Identity checks:
- 146 IDs / 146 unique IDs / no duplicates.
- 146 slugs / 146 unique slugs / no duplicates.
- 83 populated SKUs / 83 unique populated SKUs / no SKU duplicates.
- Duplicate product names exist and are legitimate, so name must never be used as identity.

Current explicit commerce states:
- 4 products are out-of-stock.
- 14 products are arriving-soon.
- 128 products have no explicit stock override and inherit current default behaviour.

Current media:
- 132 products have a main image path.
- 14 products have img=null and imagePending=true.
- 4 products have multi-image galleries.
- Repository currently contains 387 files below images/.
- Repository currently contains 147 HTML files below products/; that number is not treated as a product count because legacy/non-catalogue pages can coexist.

---

## 2. Categories

The current categories array contains 22 distinct values:

biscuits, cards, chutneys-pickles, fudge, gift-boxes, hawkshead, highland-cows, home-gifts, honey, icecream, jams-preserves, keyrings-badges, mint-cake, mugs, mustard, peter-rabbit, romneys, savoury-sauces, seasonal, soft-toys, sweets, toys-games.

Largest memberships:
- romneys: 55
- home-gifts: 41
- highland-cows: 35
- peter-rabbit: 29
- seasonal: 29
- fudge: 19
- hawkshead: 15
- sweets: 13
- icecream: 12
- biscuits: 11

### Primary-category inconsistency

145 products have the legacy singular category field.

One record does not:
- ROM-056 — Shortbread Selection 300g
- categories = ["romneys","biscuits"]
- singular category missing.

Migration rule:
- categories[] is authoritative membership.
- singular category is only a legacy primary-category hint.
- ROM-056 receives romneys as initial primary category because it is first in the authoritative membership list.
- future primary category is stored explicitly, not inferred from array order.

---

## 3. Current field coverage

### Present on all 146 products
- id
- slug
- name
- type
- categories
- label
- brand
- img, with 14 null values
- desc

### High-coverage fields

| Field | Present |
|---|---:|
| category | 145 |
| imageFit | 145 |
| price | 132 |
| confidence | 130 |
| sourceId | 118 |
| official | 86 |
| sku | 83 |
| note | 66 |
| dimensions | 48 |
| priceSource | 45 |
| range | 33 |
| material | 32 |

### Sparse/specialized fields
- packaging: 13
- suitability: 13
- care: 16
- barcode: 15
- sourceImages: 15
- availabilityStatus: 14
- availabilityLabel: 14
- availabilitySource: 14
- availabilityUpdatedAt: 14
- imagePending: 14
- features: 11
- sourceStatus: 19
- sourceNotes: 10
- lighting: 6
- battery: 3
- gallery: 4
- stockStatus: 4

Architecture implication:
- operational fields must be normalized,
- product-specific facts must remain flexible,
- supplier/verification metadata must not pollute the operational product table.

---

## 4. Nested official data

86 products contain an official object. It mixes:
1. supplier/manufacturer identity,
2. provenance and verification,
3. public factual product information,
4. image provenance.

Examples include manufacturer, brand, productCode, url, supplierUrl, verifiedAt, ingredients, allergens, nutrition, dietary, storage, pack, awards, imageSource and imageLocal.

Architecture decision:
- supplier/provenance data moves to product_source_records and supplier relations,
- public factual data becomes versioned product_attributes,
- image metadata becomes product_media,
- no operational price/inventory decision is automatically taken from an external supplier source.

---

## 5. Price baseline

132 products have numeric prices.

14 do not.

### Twelve Ice Cream flavour records
ICE-WEB-001 through ICE-WEB-010 plus ICE-WEB-012 and ICE-WEB-013 do not currently have online unit prices.

Migration decision:
- preserve their public content,
- initial online_ordering_enabled=false,
- invent no price.

### Other unpriced records
- HC-049 — Xmas Highland Cows Mistletoe — arriving soon, image pending.
- HR-007 — Red Onion Marmalade.

Migration decision:
- price stays null,
- checkout stays blocked until an owner-confirmed price exists.

---

## 6. Missing images

All 14 products without main imagery are Highland Cow products already marked arriving-soon:

HC-034, HC-035, HC-036, HC-037, HC-038, HC-039, HC-040, HC-041, HC-042, HC-043, HC-044, HC-045, HC-047 and HC-049.

Migration decision:
- create no fake image,
- import with zero media records plus a Missing image quality warning,
- do not automatically change publication state solely because media is missing.

---

## 7. Availability baseline

Explicit out-of-stock:
- PR-046 — Peter Rabbit Hanging Ornaments (Set of 4)
- HC-005 — Highland Cow Loo-Time
- HR-002 — Bloody Mary Ketchup
- HR-010 — Hot Garlic Pickle

Import mapping:
- sell_status = OUT_OF_STOCK.

The 14 Highland Cow image-pending records are arriving-soon.

Import mapping:
- sell_status = ARRIVING_SOON.

All other records:
- sell_status = AUTO.

No physical stock quantity is inferred from these labels.

---

## 8. Identity baseline

- 83 products currently have an SKU.
- 63 products do not.
- 15 products have a barcode.
- no populated SKU duplicates were found.

Rules:
- missing SKU is allowed,
- future non-null SKU must be unique,
- future non-null barcode must be unique,
- immutable UUID is the new internal identity,
- current catalogue ID remains a unique legacy alias.

---

## 9. Provenance warnings

19 products currently carry sourceStatus warnings, including owner-confirmation-required mappings and records with no current official match.

Migration rule:
- preserve confidence, priceSource, source, sourceStatus, sourceNotes, availabilitySource and verification dates,
- store these as internal provenance records,
- never silently promote uncertain supplier facts to owner-confirmed facts.

---

## 10. Legacy field to target mapping

| Current | Target |
|---|---|
| id | products.legacy_catalog_id |
| slug | products.current_slug plus product_slugs |
| name | product_versions.title |
| desc | product_versions.short_description |
| brand | product_versions.brand |
| label | product_versions.collection_label |
| type | product_versions.product_type |
| categories[] | product_version_categories |
| category | initial primary-category hint only |
| price | product_variants.price_minor |
| sku | product_variants.sku |
| barcode | product_variants.barcode |
| stockStatus | products.sell_status override |
| availabilityStatus | products.sell_status override |
| img | product_media legacy asset |
| gallery | product_media plus ordering relation |
| imageFit | media display-fit relation |
| imagePending | completeness warning |
| dimensions/material/packaging/suitability/care/range/etc. | product_attributes |
| official public facts | product_attributes |
| official/source verification | product_source_records |
| confidence/sourceStatus/sourceNotes | product_source_records |

---

## 11. Import safety rules

The deterministic importer must fail if:
- product count is not 146,
- any legacy ID duplicates,
- any slug duplicates,
- any populated SKU duplicates,
- any populated barcode duplicates,
- any current price changes,
- any explicit OUT_OF_STOCK / ARRIVING_SOON state changes,
- any current image path is lost,
- any category membership is lost.

It must not:
- invent prices,
- invent SKU/barcodes,
- infer physical stock quantity,
- infer supplier cost,
- convert warnings into verified facts,
- enable inventory tracking without an initial physical count.

---

## 12. Initial inventory policy

The current catalogue contains availability states, not trustworthy physical quantities.

Therefore:
- all imported default variants start with track_inventory=false,
- no on-hand quantity is invented,
- current orderability remains controlled by selling status, price and online-ordering flag,
- tracking is enabled only through an owner-approved INITIAL_COUNT operation.

This prevents creating a false inventory system from incomplete historical data.

---

## 13. Snapshot acceptance

This document is the frozen Phase 1 migration baseline.

Any catalogue edit before importer execution must either:
1. deliberately update the frozen baseline and parity expectations, or
2. rebase the importer baseline before staging import.

Do not silently import a later catalogue while claiming parity against this snapshot.
