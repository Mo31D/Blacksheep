# Black Sheep — Phase 6.7 Production Cutover Readiness Report

**Date:** 26 September 2026  
**Status:** READINESS COMPLETE — PRODUCTION CUTOVER NOT EXECUTED  
**Repository:** `Mo31D/Blacksheep` · `main`

## Final readiness evidence

Final guarded readiness workflow:
- run `36230644182` — **SUCCESS**.

The run verified all of the following without changing Production:

- Production source is still pre-cutover.
- The dedicated cutover workflow remains **manual-only**.
- The cutover workflow still requires:
  - `CUTOVER-PRODUCTION-D1`,
  - an approved 64-character package SHA,
  - GitHub `production` environment,
  - a D1 Time Travel bookmark before mutation,
  - guarded Product import,
  - Product parity,
  - Production-D1 publication regeneration,
  - post-cutover owner smoke as an explicit remaining gate.
- The legacy generic Production deploy path remains blocked.
- Production before-state:
  - latest migration `0008_concurrency_guards.sql`,
  - Product/Inventory/Reservation tables absent,
  - current readiness snapshot: 4 orders.
- Pending migrations remain `0009–0012`.
- Staging truth remains 146 ACTIVE Published Products with 0 active tracked baseline variants.
- Active Published staging R2 media requiring transfer: 0.
- Publication package:
  - 146 Products,
  - 162 files,
  - semantic mismatches: 0,
  - unsafe slug removals: 0,
  - SHA-256 `61d0b5f8cd4e038d3d6b38fff8bda77fe1bd491fc7f6c796ac59089522d7c3f7`.
- The exact post-cutover source was simulated only inside the ephemeral CI runner:
  - 162 publication files applied locally,
  - Production Worker feature flags applied locally,
  - Production Product Media R2 binding applied locally,
  - reservation cron applied locally,
  - storefront Production live-commerce marker enabled locally.
- Full simulated post-cutover Commerce validation passed.
- Simulated post-cutover Production Worker dry-run passed.
- Production after-state was identical to Production before-state.

## Production import/readiness hardening

The historical Phase 1 catalogue baseline is now frozen independently at:

`commerce/fixtures/product-core-baseline.catalog.js`

This prevents future publication changes to live `assets/catalog.js` from invalidating the deterministic initial Product Core import.

Prepared commands:
- guarded Production import: `npm run product-core:import:production`
- read-only Production parity: `npm run product-core:parity:production`

Production import protections:
- exact confirmation literal required,
- Product Core must be empty,
- any existing Product data blocks destructive re-import,
- non-import Product audit history blocks destructive import.

## Production publication readiness

The publication exporter can now read either staging or Production D1.

During the real cutover:
1. Production is migrated.
2. Initial 146 Products are imported.
3. Product Core parity must pass.
4. The 162-file package is regenerated **from Production D1**.
5. Its SHA must exactly match the approved SHA before any authority switch.

Prepared activation script:

`commerce/scripts/phase6-production-activate.mjs`

It owns the planned cutover source transition:
- verified 162-file publication package,
- `D1_PUBLIC_CATALOG_ENABLED=true`,
- `D1_COMMERCE_AUTHORITY_ENABLED=true`,
- `ORDER_RESERVATIONS_ENABLED=true`,
- Production `PRODUCT_MEDIA` R2 binding,
- `*/30 * * * *` reservation cleanup cron,
- Production live-commerce storefront marker.

## Deployment safety

The previous generic `Commerce Deploy` Production path is intentionally blocked.

The only prepared first-cutover path is:

`.github/workflows/phase6-production-cutover.yml`

It is `workflow_dispatch` only and has no automatic push trigger.

The workflow has **not been run**.

## Rollback

Before any Production migration, the cutover workflow captures a D1 Time Travel bookmark and Worker before-state.

No automatic destructive rollback is performed.

If legitimate orders or owner changes occur after cutover, the saved Time Travel bookmark must **not** be blindly restored because that would also remove those legitimate writes. The rollback matrix is documented in:

`docs/STOREFRONT-COMMERCE-PHASE6-PRODUCTION-CUTOVER-PLAN-2026-09-26.md`

## Current Production state

Production remains intentionally unchanged:
- migration `0008_concurrency_guards.sql`,
- Product/Inventory/Reservation tables absent,
- Product/commerce/reservation feature flags absent,
- Production live-commerce marker disabled,
- generated static catalogue remains checkout authority,
- no Phase 6 Product import,
- no Phase 6 Worker deploy,
- no 162-file Production publication apply.

## Decision gate

All reversible Phase 6 engineering and Production readiness work is complete.

The next action is the explicit owner decision to execute the guarded Production cutover. After that cutover, Phase 6 closes only after the owner/Admin/customer-order/notification smoke tests pass.
