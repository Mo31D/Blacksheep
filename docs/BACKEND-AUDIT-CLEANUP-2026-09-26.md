# Black Sheep — Backend / Admin / Basket Audit & Cleanup

**Date:** 26 September 2026  
**Repository:** `Mo31D/Blacksheep`  
**Branch:** `main`  
**Scope:** last three days, with emphasis on Commerce backend, Admin V2, basket/checkout, Product Core, Inventory Core, Order Reservations and Phase 6 D1 authority.

## Final verdict

Current `main` passed the full backend regression audit.

The completed audit run was:

- Workflow: **Backend Full Audit Once**
- Run: `36235314026`
- Source commit: `f78cd9e4fc3abf6872c8cfc8a1ddc789c0255ec5`
- Conclusion: **SUCCESS**

The one-shot audit workflow was removed after the successful run because it had completed its purpose.

## Commerce / backend validation

Full `npm run check` passed.

Evidence:
- frozen Product Core validation: **146 products**
- Product Core Production guards: PASS
- cart core: PASS
- Basket page contract: PASS
- Checkout page contract: PASS
- order confirmation contract: PASS
- Phase 6 live-commerce overlay contract: PASS
- legal/customer-information checks: PASS
- TypeScript: PASS
- fresh local D1 migrations: PASS
- upgrade path `0000–0011 → 0012`: PASS
- Inventory Core ledger/concurrency checks: PASS
- Order Reservations invariant checks: PASS
- Wrangler staging dry-run: PASS

Vitest:
- **33 test files passed**
- **195 tests passed**
- **0 failed**

Covered areas include:
- public D1 catalogue,
- D1 pricing,
- order creation/repository,
- Admin routes and order actions,
- revisions,
- payments,
- refunds,
- customer review,
- email notifications,
- webhook verification,
- Product Admin,
- Product media,
- Inventory Core,
- Reservations,
- expiry,
- Return-to-stock,
- concurrency guards,
- Turnstile,
- health contract.

## Basket / checkout regression

Real browser E2E against the staging API passed.

Verified:
- Production static checkout page loads,
- Turnstile widget is rendered with the Production site key,
- Production origin → staging CORS path works for the controlled preview,
- real staging API idempotent replay,
- idempotent replay creates one D1 order,
- network failure preserves Basket,
- network failure preserves the idempotency key,
- synthetic test rows are cleaned after the test.

The browser suite records one expected manual gate: real Turnstile challenge-token issuance is not automated in headless CI.

## Admin regression

Admin browser QA passed.

Verified:
- authenticated Admin Orders view,
- desktop order list with no horizontal overflow,
- desktop order detail,
- desktop detail with no horizontal overflow,
- WebKit/mobile order-list behaviour,
- synthetic Admin QA data cleanup.

The owner separately confirmed the corrected login flow works.

## Storefront / Phase 6 regression

Storefront live-overlay QA passed.

Verified:
- real staging **146-product** overlay,
- card price/orderability,
- checkout preview submit-disabled safety,
- tracked Available=1 basket-cap behaviour,
- API-failure static fallback,
- preview exit restores Production live mode.

Search readiness also passes:
- products: **146**
- active pages: **17**
- sitemap URLs: **166**
- placeholders: **0**

## Production read-only verification

GitHub Actions still has valid Cloudflare credentials, even though the Cloudflare connector was not exposed in the current ChatGPT session.

The successful audit used those Actions credentials for read-only Production verification.

Production D1:
- latest migration: `0012_order_returns.sql`
- active published products: **146**
- active default variants: **146**
- orders at audit time: **4**
- active reservations: **0**

Production public catalogue:
- products returned: **146**
- D1/static parity mismatches: **0**

Production health/Admin reachability: PASS.

## Duplicate / obsolete backend authority cleanup

The old duplicate generated backend commerce authority has already been removed from current `main`.

Confirmed absent:
- `commerce/src/domain/catalog.ts`
- `commerce/src/generated/catalog.ts`
- `scripts/build-commerce-catalog.mjs`
- old generated-catalog pricing tests.

Confirmed absent from runtime/test source:
- `D1_COMMERCE_AUTHORITY_ENABLED`
- `COMMERCE_CATALOG`
- `requirePurchasableProduct`
- old `priceRequestedCart()` authority path.

**D1 is the sole backend commerce authority in current source.**

Legacy Ice Cream / Romney generated builders that conflicted with the Phase 6 publication pipeline are no longer present in the active build/search workflow.

## Runtime dead-code scan

A direct import scan of all **45** `commerce/src/**/*.ts` modules found no obvious orphan runtime module:
- `src/index.ts` is the Worker entrypoint,
- the remaining data/domain/security/notification/route/Admin modules are referenced by current runtime modules.

No `TODO`, `FIXME` or `HACK` marker was found in active Commerce runtime/scripts during the full audit.

## Workflow cleanup

Removed after successful use:
- `.github/workflows/backend-full-audit-once.yml`

Kept intentionally:
- Commerce CI,
- guarded Commerce deploy,
- read-only release-state audit,
- Production health diagnosis,
- staging deploy/E2E workflows,
- checkout browser E2E,
- Admin browser QA,
- customer-review/webhook E2E,
- Phase 6 publication workflows,
- storefront overlay browser QA,
- search-readiness workflow.

These retained workflows have distinct regression/release purposes and are not duplicate runtime authority.

## Pull requests

Old Commerce PR state is clean:
- PRs #1–#6 are closed; the intended incremental PRs were merged where applicable.
- Draft PR #7 (`Commerce V1 WIP`) was closed on 26 September 2026 and was **not** merged.
- Current `main` contains the completed Basket/Checkout/Admin/D1 implementation verified by the final backend audit.

## Branch cleanup assessment

Non-main branches are now historical/obsolete relative to the completed `main`:

- `commerce-v1-catalog`
- `commerce-v1-pricing`
- `commerce-v1`
- `exact-local-v2`
- `recovery/black-sheep-work-2026-09-23`
- `restore-local-exact`
- `romneys-rebuild-2026-09-24`

Branch tips range from 8 September to 24 September 2026; `main` is hundreds of commits ahead and the completed backend/storefront regression suite passes on current `main`.

All seven obsolete historical branches were deleted by a guarded one-shot GitHub Actions cleanup after verifying PR #7 was closed and preserving `main`.

Branch cleanup workflow run: `36236510282` — SUCCESS.

Post-cleanup branch list: **main only**.

## Historical placeholder-asset cleanup

A final repository-bloat pass was completed after the backend audit.

- exact legacy placeholder blob: `36b57af455721db234911805d3276eaba3ae5bfa`,
- exact unused files proved unreferenced: **170**,
- removed range: `images/108.png`, `images/109.png`, then `images/111.png` through `images/278.png`,
- `images/110.png` was intentionally retained because it is not the placeholder blob,
- the cleanup gate searched current HTML/JS/MJS/TS/JSON/CSS/YAML/Markdown references before deletion,
- Search Readiness passed after removal: **146 products / 17 active pages / 166 sitemap URLs / 0 placeholders**,
- full Commerce backend regression passed after removal,
- cleanup workflow run: `36237983836` — **SUCCESS**,
- cleanup commit: `4bb231f79a58637212af933d6ebbe28a14762ff2`.

No tracked file using that historical placeholder blob remains in current `main`.

## Remaining connector limitation

The Cloudflare ChatGPT connector was not available in this session. This did not block the audit because the final GitHub Actions audit had working Cloudflare credentials and performed the required D1/health/parity checks.

No Cloudflare secret values were exposed.

## Current state

Backend, Basket, Checkout, Admin, Product Core, Inventory, Reservations and Phase 6 D1 public-commerce paths are regression-green.

The repository is clear of the known duplicate backend catalogue authority, the completed one-shot audit workflow, and the 170 proven-unused historical placeholder PNGs.

The seven obsolete Git branch refs were deleted successfully, and the temporary branch-cleanup workflow was then removed.
