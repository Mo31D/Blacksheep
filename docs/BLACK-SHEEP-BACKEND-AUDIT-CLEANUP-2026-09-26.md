# Black Sheep — Final Backend Audit, Cleanup & Regression

**Date:** 26 September 2026  
**Repository:** `Mo31D/Blacksheep`  
**Branch:** `main`  
**Audit start tip:** `0881632b29d154c2141451fe65d11a501bcf0835`  
**Post-cleanup code tip before this documentation update:** `1decb00b0b01ab1a90ca199c87cdd343a25400f9`  
**Authoritative final regression:** GitHub Actions run `36240828154` — **SUCCESS**  
**Dedicated post-cleanup Commerce CI:** `36240439223` — **SUCCESS**

This report is the authoritative final backend cleanup report for the 26 September 2026 audit. The older `docs/BACKEND-AUDIT-CLEANUP-2026-09-26.md` is retained as earlier audit evidence.

## 1. Starting state

The audit started from the then-current protected `main` at `0881632b29d154c2141451fe65d11a501bcf0835`.

Important facts already present on that source-of-truth tree:
- Production Phase 6 D1 commerce authority had already been cut over.
- Product Core, Inventory Core and Order Reservations were live in Production.
- Production schema was already at `0012_order_returns.sql`.
- a prior backend audit had passed and historical branch/placeholder cleanup had already run.
- the repository branch list already contained only `main`.
- Draft PR #7 had already been closed without merge.

The task therefore became a **fresh verification plus residual cleanup**, not a reconstruction of older branches or Work/Sites state.

## 2. Last-three-days architecture review

The current architecture was reviewed from `main`, including current docs, `commerce/package.json`, `commerce/wrangler.jsonc`, all current workflows, current Commerce source/tests/scripts, and recent commits.

Current authority model:
- Production D1 Product Core / Inventory Core is operational authority for identity, price, selling state, online orderability and inventory.
- `assets/catalog.js` is the generated/static published storefront snapshot and specialist-content extension, not backend pricing authority.
- the Commerce Worker persists orders in D1 and revalidates server-side.
- Phase 5 reservations protect tracked inventory across reviewed-order lifecycle transitions.
- Phase 6 public catalogue exposes published content only and powers live commerce state while preserving static canonical pages/fallback.
- Admin V2 is the operational owner interface for orders/products/inventory.

No restoration of the pre-Phase-6 generated backend catalogue architecture is valid.

## 3. Bugs / conflicts found

Residual issues found in the fresh audit:

1. Five retained staging QA workflows still contained obsolete `# trigger-...` comments used only to force historical reruns.
2. `Commerce CI` did not explicitly declare least-privilege `contents: read`.
3. The first temporary final-audit workflow run (`36240586996`) invoked `staging-publication-admin-e2e.mjs` before installing Playwright. It failed with `ERR_MODULE_NOT_FOUND: playwright`. All earlier gates in that same run had passed. This was an audit-orchestration defect, not an application regression.
4. README catalogue counts were stale: source-of-truth `assets/catalog.js` is 64 Gifts + 12 Ice Cream + 55 Romney's + 15 Hawkshead = 146, while README still described an older 41/12/55/16 breakdown and old Highland-Cow placeholder assumptions.
5. The Phase 6 implementation plan retained historical pre-cutover instructions without a sufficiently strong top-level supersession warning.

No active Commerce runtime conflict was found between old Commerce V1 generated authority and current Product/Inventory architecture.

## 4. Fixes made

- Commit `48bfd632344a4d7d5493503d13f830b0408ec497`:
  - removed five stale workflow trigger markers;
  - added explicit `permissions: contents: read` to `Commerce CI`.
- Temporary final audit was corrected so Playwright/Chromium/WebKit are installed before browser-backed publication E2E.
- Corrected audit then passed as run `36240828154`.
- Temporary final audit workflow was removed after success in commit `1decb00b0b01ab1a90ca199c87cdd343a25400f9`.
- README/current documentation was reconciled with the 146-product baseline and current authority model.
- Phase 6 plan now explicitly labels pre-cutover sections as historical execution evidence.

## 5. Branches deleted

Current GitHub branch inventory contains **only `main`**.

Seven historical branches had already been safely deleted by guarded cleanup workflow `36236510282` after confirming PR #7 was closed:
- `commerce-v1-catalog`
- `commerce-v1-pricing`
- `commerce-v1`
- `exact-local-v2`
- `recovery/black-sheep-work-2026-09-23`
- `restore-local-exact`
- `romneys-rebuild-2026-09-24`

The cleanup workflow subsequently verified those refs were absent and `main` remained present.

Because those refs were already deleted before this fresh audit began, their merge-bases/unique-commit counts cannot be recomputed from the current remote without recreating historical refs, which was intentionally not done. Recoverable PR head evidence:
- `commerce-v1-catalog`: PR #3 head `1a3deb8b5ef02afec5d3be4fc7b924d1020f5121`
- `commerce-v1-pricing`: PR #4 head `0f63625e81354bb3b9c34b8a0793123d8f675594`
- `commerce-v1`: latest retained PR head evidence is Draft PR #7 at `a22855434986df688d8e47c23748d78c1db95423`

Earlier guarded cleanup evidence established that useful Commerce work was already represented/superseded on current `main`; the completed post-cleanup regression independently confirms current `main` does not depend on those refs.

## 6. Branches retained and why

| Branch | Audit tip | Merge-base | Unique commits | Associated PR | Decision |
|---|---|---|---|---|---|
| `main` | `0881632b29d154c2141451fe65d11a501bcf0835` at audit start; advanced only by audited cleanup/docs | self | 0 relative to self | base for #1–#7 | **KEEP** — protected source of truth |

No other branch currently exists.

## 7. PRs closed / retained

- PR #1 — merged/closed.
- PR #2 — merged/closed.
- PR #3 — merged/closed.
- PR #4 — merged/closed.
- PR #5 — merged/closed.
- PR #6 — merged/closed.
- Draft PR #7, `Commerce V1 WIP: basket, checkout and order-request flow` — **closed, not merged**.

There are no stale open/draft PRs remaining.

## 8. Old code removed / proven absent

Previously removed and still absent:
- `commerce/src/domain/catalog.ts`
- `commerce/src/generated/catalog.ts`
- `scripts/build-commerce-catalog.mjs`
- legacy generated-catalog pricing tests
- `scripts/build-icecream.mjs`
- `scripts/build-romneys.mjs`

Also absent from active Commerce runtime/test source:
- `D1_COMMERCE_AUTHORITY_ENABLED`
- `COMMERCE_CATALOG`
- `requirePurchasableProduct`
- old `priceRequestedCart()` authority path.

A cleanup invariant gate also found no active `TODO`, `FIXME` or `HACK` marker in Commerce runtime/scripts.

The earlier repository-bloat pass removed 170 proven-unused historical placeholder PNGs. Immutable migrations and useful historical architecture/release documentation were retained.

## 9. Workflows retired / updated

Updated:
- `.github/workflows/commerce-ci.yml` — explicit `contents: read`.
- five staging QA workflows — stale trigger comments removed.

Retired after use:
- historical branch-cleanup one-shot workflow;
- historical placeholder-cleanup one-shot workflow;
- previous backend-audit one-shot workflow;
- this session's `backend-final-audit-once.yml` after successful run `36240828154`.

Retained workflows have distinct purposes: CI, guarded deployment, release-state/health diagnosis, staging deploy/E2E, Admin browser QA, checkout browser E2E, review/webhook E2E, publication validation and storefront overlay QA.

## 10. Basket regression result

**PASS.**

Static/unit contract:
- cart core;
- Basket page;
- Checkout page;
- order confirmation;
- Phase 6 live-commerce overlay.

Real staging browser E2E in the final audit:
- Production static checkout loads;
- delivery review UI;
- Turnstile widget renders with Production site key;
- Production origin → staging CORS;
- real staging API idempotent replay;
- duplicate replay creates one D1 order;
- network failure preserves Basket;
- network failure preserves idempotency key;
- synthetic row cleanup.

Server-side D1 pricing/orderability tests passed in the 195-test suite. Browser-supplied price is not authoritative.

Manual limitation: real Turnstile challenge-token issuance is intentionally not automated in headless CI.

## 11. Admin regression result

**PASS.**

Final staging Admin V2 E2E covered:
- authenticated session validation;
- start review;
- reduce unavailable quantities;
- substitutions;
- add/remove item;
- discount/surcharge/manual correction;
- collection ↔ delivery changes;
- send reviewed revision;
- payment request;
- customer review rendering;
- customer question;
- accept idempotency;
- mark paid → preparing → ready → complete;
- partial/full refund paths and idempotency;
- refund + cancel;
- message history;
- audit events;
- reports/refund gross-revenue behavior.

Admin browser QA passed desktop + WebKit/mobile overflow/detail/revision-control checks. Owner OTP/login and corrected iPad behavior remain separately owner-confirmed from Phase 4.

## 12. Product regression result

**PASS.**

Evidence:
- frozen Product Core validation: 146 products;
- Production import guards PASS;
- Product/Admin route and editor regression tests included in 33/195 Vitest PASS;
- Product media route/coexistence tests PASS;
- Admin Add → Draft → Publish → public API/static candidate → Archive E2E PASS;
- publication audit events CREATED/PUBLISHED/ARCHIVED retained;
- D1 public output uses Published state only;
- archive removes the synthetic Product from public API/static candidate and returns exact 146 baseline.

The current static baseline was independently reconciled as 64 Gifts + 12 Ice Cream + 55 Romney's + 15 Hawkshead = 146.

## 13. Inventory regression result

**PASS.**

`inventory-core:test` passed:
- immutable movement ledger;
- unique Initial Count;
- idempotency;
- optimistic balance concurrency.

Vitest/Admin regression also covered Inventory routes/reservation integration. Existing real-staging Phase 4 proof remains valid for Initial Count, Adjust, Physical Count, Stocktake, thresholds, Product↔Stock navigation and immutable ledger triggers.

## 14. Reservation regression result

**PASS.**

Current invariant suite passed:
- one reservation per revision;
- unique idempotency;
- immutable reservation items;
- no migration-side-effect inventory mutation.

The 195-test suite passed reservation creation/transitions, Admin reservation integration, expiry, customer-review reservation behavior, explicit Return-to-stock and concurrency guards.

Existing Phase 5 real-staging proof remains the lifecycle authority for:
- insufficient-stock rollback;
- untracked compatibility;
- decline release;
- supersede release/re-reserve;
- expiry;
- cancellation;
- payment commit;
- delivery/collection SALE;
- refund without stock mutation;
- explicit one-time Return-to-stock;
- one-unit/two-orders exactly-one-winner concurrency.

## 15. Phase 6 regression result

**PASS.**

Final audit verified:
- Production D1 public catalogue contract;
- 146 public Products;
- no tested private/admin fields leaked;
- D1/static catalogue parity;
- Production health reports `orderReservations=true`, `publicCatalog=true`, `commerceAuthority=true`;
- staging publication baseline at 146;
- D1-only publication candidate 146;
- rendered product/sitemap package;
- collection/full-range publication;
- deterministic package verification;
- package SHA-256 `61d0b5f8cd4e038d3d6b38fff8bda77fe1bd491fc7f6c796ac59089522d7c3f7`;
- Admin Publish/Archive propagation;
- storefront overlay Chromium/WebKit regression;
- static fallback and canonical-query isolation.

## 16. Search Readiness result

**PASS.**

Final verifier result:
- products: **146**
- active pages: **17**
- sitemap URLs: **166**
- placeholders: **0**

Relevant successful runs:
- cleanup commit: `36240439155`
- corrected full-audit commit: `36240828209`
- after one-shot workflow removal: `36241123400`

The legacy Ice Cream/Romney builder conflict is eliminated: Search Readiness runs only the current verifier and no retired category builder exists in the current tree.

## 17. Commerce CI result

**PASS.**

Dedicated post-cleanup run: `36240439223`.

Full `npm run check` also passed inside final audit `36240828154`:
- Product Core validation;
- Production guards;
- cart/legal contracts;
- TypeScript;
- fresh local migrations;
- migration upgrade `0000–0011 → 0012`;
- Inventory Core;
- Order Reservations;
- **33 Vitest files / 195 tests**;
- staging Worker dry-run.

## 18. Cloudflare runtime verification

**Direct ChatGPT Cloudflare connector: UNAVAILABLE in this session.**

Therefore this report does **not** claim an independent Cloudflare-dashboard/connector inspection of every Worker deployment/version/variable.

However, GitHub Actions Cloudflare credentials were available, and the successful final audit performed read-only Wrangler/API runtime checks without exposing secret values:
- Production latest D1 migration: `0012_order_returns.sql`;
- Active Published Products: **146**;
- active default variants: **146**;
- orders: **4**;
- active/committed reservations: **0**;
- Production health: OK, D1 bound;
- runtime feature health: Reservations/Public Catalog/Commerce Authority enabled;
- Resend provider/from/owner/webhook configuration reported configured;
- Production public catalogue: 146 and parity PASS.

Source configuration also confirms Production R2 `PRODUCT_MEDIA` binding and `*/30 * * * *` reservation expiry cron. Treat those two as source/config verification rather than direct connector-level dashboard verification.

## 19. Production safety / cutover status

Production Phase 6 cutover is already executed and remains active.

The final audit made **no Production mutation**:
- no Production deploy;
- no Production migration apply;
- no Production INSERT/UPDATE/DELETE;
- no secret mutation;
- no rollback/Time Travel restore.

Production read-only integrity remained stable at 146 Active Published Products, 146 active default variants, 4 orders and 0 active reservations during the audit.

The saved historical Time Travel bookmark must not be used casually because doing so could erase legitimate post-cutover orders.

## 20. Exact remaining work

No known backend code conflict remains and no required automated regression is failing.

The only remaining Phase 6 acceptance work is owner-facing Production smoke:
1. log into live Production Admin;
2. open Products and Stock on the normal owner device;
3. submit one ordinary live customer order;
4. confirm it appears in Admin;
5. confirm customer acknowledgement email arrives;
6. confirm owner new-order notification arrives;
7. confirm an untracked baseline Product creates no unexpected numeric reservation/stock movement.

A real Turnstile challenge token is also a manual browser/device gate by design; headless CI verifies widget/config/idempotency/error behavior but does not solve the challenge.

## Final state

The backend can be considered **clean and regression-stable at the automated/code level**:
- only `main` remains;
- no stale open PR remains;
- obsolete generated backend authority is absent;
- obsolete category builders are absent;
- residual workflow trigger debris is removed;
- full backend/Admin/Basket/Product/Inventory/Reservation/Phase 6 regression is green;
- Search Readiness, Commerce CI and Pages are green.

Phase 6 should be marked fully owner-accepted only after the remaining live Production smoke above.
