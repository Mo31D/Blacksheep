# Black Sheep — Phase 6.7 Production Cutover Runbook

**Date:** 26 September 2026  
**Status:** READY FOR EXPLICIT CUTOVER APPROVAL — NOT EXECUTED  
**Repository:** `Mo31D/Blacksheep` · `main`  
**Production authority:** still generated static catalogue / migration `0008`

## 1. Purpose

This runbook is the only approved path for moving Production from the legacy generated-commerce authority to the D1 Product / Inventory / Reservation architecture already proved on staging.

The cutover is intentionally separated from readiness. Creating this runbook, import support and workflow does **not** authorize or perform Production mutations.

## 2. Verified before-state

Read-only readiness workflow:
- GitHub Actions run: `36229437082` — SUCCESS.
- Production latest migration: `0008_concurrency_guards.sql`.
- Production orders at readiness snapshot: 4.
- Production Product/Inventory/Reservation tables: 0.
- Production Phase 6 flags: absent.
- Production Product Media R2 binding: absent.
- Staging latest migration: `0012_order_returns.sql`.
- Staging ACTIVE Published Products: 146.
- Staging active tracked baseline variants: 0.
- Staging active R2 media used by Published Products: 0.
- Publication candidate Products: 146.
- Publication semantic mismatches: 0.
- Retired slug aliases: 0.
- Publication package files: 162.
- Approved readiness package SHA-256:
  `61d0b5f8cd4e038d3d6b38fff8bda77fe1bd491fc7f6c796ac59089522d7c3f7`.
- Package plan: 0 added / 162 changed / 0 deletions / 0 unsafe slug removals.

If any Product/content change occurs on staging before cutover, this package SHA is stale. Re-run readiness and approve the new SHA; never force the old package through.

## 3. Safety design

The cutover must preserve order availability throughout:

1. Existing Production Worker continues serving orders while additive migrations/import run.
2. Initial Product import has exact 146-product parity and all variants start inventory-untracked.
3. Publication package is generated from **Production D1 after import**, not trusted solely from staging.
4. Production-generated package SHA must equal the explicitly approved package SHA.
5. Worker authority is enabled only after Production parity passes.
6. Storefront live overlay has static fallback; if the public D1 API is unavailable the static Product output remains usable.
7. Existing `orders` data is never deleted or rewritten by Product import.
8. Normal generic Production deploy is blocked during the cutover transition; only the dedicated cutover workflow may perform the first migration/import/activation.

## 4. Required explicit workflow inputs

The dedicated workflow must require:

- `confirmation = CUTOVER-PRODUCTION-D1`
- `expected_package_sha = <approved 64-character SHA-256>`

A mismatch aborts before the authority switch.

## 5. Pre-cutover gate

Immediately before any Production write:

- checkout must be the current `main`,
- Commerce CI must pass,
- Search Readiness must pass,
- publication/Admin E2E evidence must remain green,
- Production must still be at `0008_concurrency_guards.sql`,
- Product/Inventory/Reservation tables must still be absent,
- Production source flags must still be disabled,
- staging must remain at `0012_order_returns.sql`,
- staging must contain 146 ACTIVE Published Products,
- candidate semantic mismatches must be 0,
- package deterministic check must pass,
- package SHA must equal the workflow input,
- unsafe slug removals must be 0.

Any failed gate = **STOP**.

## 6. Capture rollback point

Before migrations:

1. Retrieve the current D1 Time Travel bookmark for `black-sheep-commerce-prod`.
2. Save it as workflow evidence and print the exact restore command.
3. Capture:
   - current migration,
   - order count,
   - order status counts,
   - current Worker deployment/version,
   - current source commit.

Cloudflare D1 Time Travel is automatically available for supported D1 databases. Restoring to a bookmark is destructive, so the bookmark is an emergency pre-cutover restore point, not the default rollback after new customer orders have arrived.

## 7. Prepare Production Product Media storage

Create or confirm the private R2 bucket:

`black-sheep-product-media-prod`

The initial 146-Product import currently needs no R2 object copy because the verified Published baseline has zero active R2 media; all existing publication media are legacy repository assets.

The bucket is still required at cutover so Production Admin Product Media uploads work immediately after Product Core becomes live.

Do not delete the bucket during rollback if it contains any owner-uploaded media.

## 8. Apply additive database foundation

Apply only the pending migrations, in order:

1. `0009_product_inventory_foundation.sql`
2. `0010_inventory_core.sql`
3. `0011_order_reservations.sql`
4. `0012_order_returns.sql`

Then verify:
- latest migration is `0012_order_returns.sql`,
- existing order count is unchanged,
- existing order rows/statuses are unchanged,
- Product tables exist but are still empty before import.

Any unexpected order mutation = **STOP and investigate before authority activation**.

## 9. Initial Production Product Core import

Run the guarded importer only after migrations:

`npm run product-core:import:production`

The command itself includes the hard-coded confirmation `IMPORT-PRODUCTION-PRODUCTS`.

Production safeguards:
- Product Core must be empty,
- any existing Production Product row blocks destructive re-import,
- any non-import Product audit history blocks destructive import,
- frozen Phase 1 baseline is stored separately at `commerce/fixtures/product-core-baseline.catalog.js`,
- expected import = 146 Products / 146 variants / 146 import audit events.

Never re-run the initial importer after owner Product changes exist.

## 10. Production Product Core parity

Run:

`npm run product-core:parity:production`

Require:
- PASS,
- 146 Products,
- exact identity/content/SKU/barcode/price/status/category/media/attribute/provenance parity,
- inventory tracked = 0.

This gate is read-only.

## 11. Regenerate publication package from Production D1

Export from Production:

`node scripts/phase6-publication-candidate.mjs --remote --env production ... --require-baseline-parity`

Then render/verify/package the full static output.

Require:
- Products: 146,
- semantic mismatches: 0,
- Product pages: 146,
- collection/full-range pages: 14,
- unsafe slug removals: 0,
- deterministic = true,
- package SHA exactly equals the approved `expected_package_sha`.

A different Production-generated hash = **STOP**. Do not deploy Worker authority or apply storefront files.

## 12. Prepare cutover source changes

Use `commerce/scripts/phase6-production-activate.mjs`.

It applies only:
- the verified 162-file publication package,
- Production `PRODUCT_MEDIA` R2 binding,
- Production reservation/public-catalogue/D1-commerce flags,
- Production reservation cleanup cron `*/30 * * * *`,
- `BLACK_SHEEP_PRODUCTION_LIVE_COMMERCE=true`.

Before approval this script may be used in `--dry-run` mode only.

After source activation, run the full Commerce validation before deployment.

## 13. Production Worker activation

Deploy the activated Worker only after all preceding gates pass.

Expected Production runtime after deploy:
- `ORDER_RESERVATIONS_ENABLED=true`,
- `D1_PUBLIC_CATALOG_ENABLED=true`,
- `D1_COMMERCE_AUTHORITY_ENABLED=true`,
- `PRODUCT_MEDIA` bound to `black-sheep-product-media-prod`,
- reservation expiry cron every 30 minutes,
- existing Resend/Turnstile/Admin secrets retained.

Health must report:
- environment = production,
- database = bound,
- orderReservations = true,
- publicCatalog = true,
- publicCatalogContract = `d1-published-v1`,
- commerceAuthority = true.

## 14. Storefront publication and live overlay

The cutover source commit contains:
- D1-generated `assets/catalog.js`,
- 146 Product pages,
- 14 collection/full-range pages,
- sitemap,
- Product JSON-LD/canonical state,
- Production live-commerce marker.

The public storefront must still work if the D1 API fails because the static package is the fallback.

Verify after Pages deployment:
- 146 public Products,
- canonical URLs unchanged,
- Product JSON-LD price/availability matches Production D1,
- no Draft content,
- no horizontal/mobile regression,
- basket Add controls reflect current public state,
- API failure simulation still leaves static pages usable.

## 15. First post-cutover operational proof

Before declaring cutover complete:
- confirm Admin login,
- open Products and Stock in Production,
- verify 146 imported Products,
- verify baseline products are inventory-untracked,
- verify a known Product price matches storefront/API,
- verify public catalogue count = 146,
- verify an ordinary customer order can still be submitted,
- verify owner/customer email notifications still arrive,
- verify order appears in Admin.

Do not turn on inventory tracking for real Products during the cutover itself. Tracking/Initial Count is a separate owner operational action.

## 16. Rollback matrix

### A. Failure before Production Worker authority deploy

Preferred action:
- stop,
- leave current Worker live,
- revert the cutover source commit if it was pushed,
- Product tables may remain dormant if migrations/import succeeded.

If exact pre-cutover D1 state is required and **no legitimate Production writes occurred after the bookmark**, Time Travel may restore the saved bookmark.

### B. Failure immediately after authority deploy, before any new legitimate order/admin mutation

- redeploy the previous Production Worker/source configuration,
- turn off live-commerce source marker by reverting the cutover commit,
- verify static fallback,
- optionally restore the saved D1 bookmark if exact pre-cutover DB state is required.

### C. Failure after new customer orders or owner Product changes exist

**Do not blindly Time-Travel restore.** It would also roll back legitimate post-cutover writes.

Instead:
- revert/deploy the previous Worker authority,
- keep additive D1 tables and new order data intact,
- switch storefront to static fallback,
- reconcile Product/order state,
- decide a targeted repair or a carefully planned restore with preservation of intervening orders.

### D. R2 rollback

If the Production media bucket is empty it may be removed later.  
If any Product Media object has been uploaded, retain the bucket and its objects during rollback.

## 17. Cutover completion criteria

Phase 6 is COMPLETE only when all are true:

- Production migrations `0009–0012` applied,
- 146 initial Products imported with parity PASS,
- Production-generated publication package matches approved SHA,
- Production Worker flags/binding/cron active,
- public catalogue = 146,
- storefront/browser checks PASS,
- one real Production order flow PASS,
- Admin Products/Stock PASS,
- Resend notifications PASS,
- cutover source commit deployed,
- rollback bookmark/evidence retained,
- no unexplained Product/static/SEO mismatch.

## 18. Current decision gate

**Do not execute the Production cutover from this document alone.**

The next irreversible action requires explicit owner approval to run the dedicated Production cutover workflow with its confirmation string and approved package SHA.
