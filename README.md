# The Black Sheep Shop — Master Website Update

This version rebuilds the site around the full image-analysis report rather than the earlier simplified boutique concept.

## What changed
- Keeps the black/gold brand as the UI frame, but treats the physical shop as product-rich and colourful.
- Retains the eight primary Gifts & Souvenirs collections.
- Adds six evidence-backed secondary collections: Keyrings & Badges, Maps/Books/Jigsaws, Black Sheep Treats, Lakeland Fragrances, Home Gifts & Art, Toys & Games.
- Builds the catalogue from all 179 inventory rows in the master image report, with multiple-category tagging where useful.
- Adds a dedicated Lakeland Fragrances page.
- Rebuilds Hawkshead Relish using exact product names readable in the shop image, without adding unverified size/ingredient/allergen claims.
- Simplifies Romney's to the product families actually visible in the shop report until current SKUs are researched.
- Preserves the established Luxury Lakes Ice Cream range from the existing site source, while keeping allergen claims deliberately conservative.
- Removes customer-facing design commentary and avoids presenting unverified prices as current.
- Adds lazy-loading to catalogue imagery and reduces temporary PNG sizes while keeping the same replacement filenames.

## Images
Current/generated images are temporary. See `IMAGE_MAP.md`. Product placeholders `100.png` onward map directly to report inventory IDs so real in-store photos can later be dropped in without changing page code.

## Current-stock policy
The site deliberately says the range changes regularly. It does not claim that every photographed item is currently in stock.

## Domain-dependent SEO
The final production domain has not been provided. Therefore canonical URLs and a production sitemap cannot be completed correctly yet. `robots.txt` is safe to publish; create the final sitemap/canonical URLs once the live domain is confirmed.
