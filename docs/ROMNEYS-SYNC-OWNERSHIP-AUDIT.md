# Romney’s supplier sync ownership audit

29 September 2026; source review at main 7431c88.

## Caller and overwrite proof

`git grep -n -i sync-romneys-official-data` found only architecture/checklist/handoff references; no workflow, route, package script, generator or runtime HTML invokes the Python file. Its `main()` fetched manufacturer pages and images, wrote WebP bytes under `images/romneys/official/`, changed each Romney catalogue item’s `img` and `official` fields, then rewrote the entire `assets/catalog.js` file. Its fixed `sourceSyncedAt` date and length-based fact replacement were not an owner review or current provenance control. A failed image threshold happened after writes and did not roll them back.

## Current ownership

Product Core D1 owns published title, price, SKU, category, media association and publication status. `product_source_records` OFFICIAL payload and attributed official Product attributes own verified provenance. `phase6-publication-candidate.mjs` reads those records and published Product media, reconciles specialist static metadata, and produces an isolated candidate. The publication package renders and verifies the static snapshot. The successful read-only staging candidate run 36560733660 showed 146/146 baseline parity, 162 deterministic files and zero changed tracked files. `build-romneys-source-map.mjs` remains a read-only documentation generator from the static snapshot; storefront and Search Readiness still read `assets/catalog.js` and existing image assets.

## Decision and validation

The uncalled direct writer is retired. Existing catalogue data, official provenance records, WebP files and public URLs are retained; no content or data migration is needed. New supplier facts should be reviewed as provenance and entered through Product Core ownership, then published through the candidate pipeline. Git history preserves the old one-off scraper if historical methodology is needed.

Validation: tracked-reference search, source/data-flow inspection, Search Readiness PASS (146 products, 17 active pages, 166 sitemap URLs, zero placeholders) and Product Core validation PASS (146 products, 136 media). No network scrape, D1 mutation or storefront generation was performed by this retirement.
