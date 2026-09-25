# Black Sheep — Phase 6 Storefront / Commerce Staging Foundation

**Date:** 25 September 2026  
**Status:** Milestones 6.1–6.4 COMPLETE + REAL-STAGING VERIFIED  
**Repository:** `Mo31D/Blacksheep` · `main`  
**Production:** unchanged

## Completed scope

Phase 6 now has a staging D1 commerce authority without changing Production.

Completed:
- Published-only D1 public Product query.
- Public staging catalogue routes:
  - `GET /v1/catalog`
  - `GET /v1/catalog/:id`
- Public privacy contract.
- Exact generated-static vs D1 parity engine.
- D1 server-authoritative cart pricing.
- Staging-only D1 checkout authority flag.
- Real tracked-stock and pricing proof through the actual order-creation path.

## Public Product rules verified

The public D1 layer:
- reads only `current_published_version_id`,
- never falls back to Product Draft,
- includes ACTIVE Products only,
- uses the active default variant,
- uses D1 variant price,
- honors manual sell-state overrides,
- honors online-ordering enablement,
- calculates tracked Available as `On hand - Reserved - Safety stock`,
- keeps untracked AUTO Products on current orderability semantics.

Public responses do not expose cost price, supplier data, audit history, internal notes, barcode or Draft identifiers.

## 146-product parity proof

Workflow: `36199480713` — SUCCESS.

Result:
- generated catalogue: 146,
- D1 public catalogue: 146,
- missing in D1: 0,
- extra in D1: 0,
- field mismatches: 0,
- staging public products: 146,
- purchasable: 115,
- active tracked baseline products: 0.

Compared fields:
- public ID,
- slug,
- name,
- type,
- SKU,
- price,
- status,
- purchasable,
- non-purchasable reason.

## D1 checkout authority proof

Workflow: `36200073433` — SUCCESS.  
Real-staging QA run: `05d821c4e1`.

The temporary QA Product was tracked with one unit available and had separate Published + Draft content.

Verified:
- public query returned Published content and did not leak the secret Draft,
- initial D1 price 777 minor units was persisted in the first order,
- forged browser price was ignored,
- quantity 1 succeeded with Available 1,
- quantity 2 was rejected,
- D1 price changed to 888 minor units and the next order persisted 888,
- Reserved changed public Available from 1 to 0 and blocked ordering,
- `online_ordering_enabled=0` blocked ordering,
- manual `OUT_OF_STOCK` blocked ordering,
- Archive removed the Product from the public D1 catalogue.

The proof created two successful synthetic orders solely to verify server persistence. Both were deleted during cleanup.

Post-proof cleanup:
- QA orders: 0,
- QA Product: 0,
- QA variant: 0,
- QA inventory balance: 0,
- active staging baseline restored to 146 Products,
- temporary `black-sheep-phase6-checkout-qa` Worker deleted.

## Current staging runtime

- Worker deployment: `4e358034-e033-472c-a450-a52550058d25`.
- Worker version: `3603f5da-1521-4c01-8888-65b9ebea0d29`.
- D1 migration: `0012_order_returns.sql`.
- `D1_PUBLIC_CATALOG_ENABLED=true`.
- `D1_COMMERCE_AUTHORITY_ENABLED=true`.
- `ORDER_RESERVATIONS_ENABLED=true`.

## Production isolation

Direct Cloudflare verification after the proof:
- migration remains `0008_concurrency_guards.sql`,
- Product/Variant/Inventory/Reservation tables remain absent,
- `D1_PUBLIC_CATALOG_ENABLED` is absent,
- `D1_COMMERCE_AUTHORITY_ENABLED` is absent,
- Production checkout still uses the generated static commerce catalogue,
- current Production order count: 4.

No Production Worker deploy or D1 migration was performed by this milestone.

## Next milestone

Phase 6.5 — Storefront live overlay:
- consume public D1 Product state,
- update visible price/status/orderability,
- preserve static fallback,
- preserve canonical URLs,
- provide staging preview before general activation,
- verify responsive/mobile behavior.

After the overlay, Phase 6.6 builds the Admin Publish → static pages/cards/sitemap/JSON-LD publication pipeline.
