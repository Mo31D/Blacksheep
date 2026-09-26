# Black Sheep — Phase 6 Production Cutover Report

**Date:** 26 September 2026  
**Status:** AUTOMATED PRODUCTION CUTOVER COMPLETE — owner smoke pending  
**Repository:** `Mo31D/Blacksheep`  
**Production source cutover commit:** `97099d67c6a85afbcc90b797520873d9e44bb9b4`

## Approved package

- Files: 162
- SHA-256: `61d0b5f8cd4e038d3d6b38fff8bda77fe1bd491fc7f6c796ac59089522d7c3f7`
- Exact staging rebuild before Production write: PASS
- Production-D1 regeneration after import: same approved SHA — PASS

## Cutover execution

Guarded workflow:
- `36231139658` — executed the actual Production cutover.
- Authorization `CUTOVER-PRODUCTION-D1`: PASS.
- Unchanged-main / approved pre-cutover source gate: PASS.
- Full Commerce validation: PASS.
- D1 Time Travel rollback point captured before writes.
- Production R2 Product Media bucket created.
- Migrations `0009–0012`: applied successfully.
- Existing orders preserved.
- Initial 146 Product Core rows imported.
- Exact Production Product Core parity: PASS.
- Publication package regenerated from Production D1: PASS.
- Verified 162-file source activated and committed.
- Production Worker deployed with D1 Product/Inventory/Reservation authority.
- Runtime health: PASS.
- Production public catalogue: PASS.
- Production catalogue parity: PASS.

The original workflow stopped after the successful authority cutover because its Cron verification expected Cloudflare schedules as `result[]`, while the API returned `result.schedules[]`.

No destructive rollback was performed.

## Cron remediation

Cloudflare/Wrangler confirmed the Production reservation schedule:

`*/30 * * * *`

The Cron Trigger was applied with `wrangler triggers deploy`.

Final remediation/post-cutover verification:
- workflow `36231541379` — SUCCESS,
- Production D1 + Cron: PASS,
- runtime authority: PASS,
- public catalogue parity: PASS,
- storefront source deployment: PASS,
- canonical/static Product surface: PASS.

## Production state after automated cutover

- latest migration: `0012_order_returns.sql`,
- Active Published Products: 146,
- baseline tracked variants: 0,
- existing Production orders preserved: 4,
- Product/Inventory/Reservation schema is live,
- `ORDER_RESERVATIONS_ENABLED=true`,
- `D1_PUBLIC_CATALOG_ENABLED=true`,
- `D1_COMMERCE_AUTHORITY_ENABLED=true`,
- Production live-commerce storefront marker: enabled,
- Product Media R2 binding: `black-sheep-product-media-prod`,
- reservation expiry Cron: `*/30 * * * *`.

Production Worker version deployed by the cutover:
`b1a4f431-6054-4e24-a84f-ec2f663d6c2b`.

## Rollback evidence

Pre-cutover D1 Time Travel bookmark:

`00000069-00000000-000050f2-520c7a223d69419dc3f15f11a8565f4f`

This bookmark must not be restored blindly because legitimate orders created after the bookmark could be lost. Follow the rollback matrix in:

`docs/STOREFRONT-COMMERCE-PHASE6-PRODUCTION-CUTOVER-PLAN-2026-09-26.md`.

## Remaining owner smoke

Automated cutover is complete. Final owner acceptance requires:

1. Production Admin login.
2. Open Products and Stock and confirm normal operation.
3. Submit one ordinary customer order request through the live storefront.
4. Confirm the order appears in Admin.
5. Confirm the customer acknowledgement email arrives.
6. Confirm the owner notification email arrives.
7. Confirm no unexpected stock/reservation state is created for untracked baseline Products.

After those checks pass, Phase 6 can be marked fully CLOSED.
