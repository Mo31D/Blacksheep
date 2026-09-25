# Black Sheep — Phase 5 Order Reservations Staging Release

**Date:** 25 September 2026  
**Status:** COMPLETE + REAL-STAGING VERIFIED  
**Repository:** `Mo31D/Blacksheep`  
**Branch:** `main`  
**Production:** unchanged

## Scope completed

Phase 5 connects reviewed order revisions to Inventory Core on staging so tracked stock is reserved, released, committed, consumed and explicitly returned without silent overselling.

Implemented and verified:
- reviewed revision Send creates tracked-stock reservations atomically,
- insufficient stock rejects Send without partial holds,
- replayed Send is idempotent,
- untracked products preserve existing behaviour,
- decline, supersede, cancellation and expiry release stock,
- payment commits the hold without changing On hand,
- delivery consumes at SHIPPED,
- collection consumes at COMPLETED,
- refund alone changes no inventory,
- explicit owner Return-to-stock restores physical stock exactly once,
- Admin order detail exposes reservation and live inventory state,
- scheduled expiry cleanup runs every 30 minutes on staging,
- optimistic concurrency prevents two orders from winning the same final unit.

## Release evidence

GitHub Actions:
- Phase 5 staging workflow: `36195902160` — SUCCESS.

Cloudflare staging:
- Worker version: `c591003d-ab57-45dd-ba3c-abc302c61b79`.
- latest D1 migration: `0012_order_returns.sql`.
- `ORDER_RESERVATIONS_ENABLED=true`.
- expiry cron: `*/30 * * * *`.

Real-staging QA run:
- QA run ID: `3f6f4cfa6b`.
- Collection lifecycle: PASS.
- Delivery lifecycle: PASS.
- Insufficient stock rollback: PASS.
- Untracked compatibility: PASS.
- Decline release: PASS.
- Supersede release/re-reserve: PASS.
- Expiry: PASS.
- Cancellation: PASS.
- One-unit / two-orders concurrency: exactly one winner.

Retained immutable evidence:
- `ORDER_RESERVATION`: 8.
- `RESERVATION_RELEASE`: 6.
- `SALE`: 2.
- `RETURN`: 1.
- terminal reservation states: CONSUMED 2 / EXPIRED 1 / RELEASED 6.
- explicit returned marker: 1.

Post-proof cleanup:
- ACTIVE/COMMITTED QA holds: 0.
- QA inventory balances: 0.
- active/tracked QA variants: 0.
- temporary QA Worker: deleted.
- immutable order/reservation/movement proof retained.

## Defect found by real D1 and fixed

The first real-staging Send proof exposed a D1 placeholder/binding mismatch in the `ORDER_RESERVATION` ledger insert. The builder had one extra placeholder for `actor_type`.

Fix:
- restored `actor_type='ADMIN'` as a SQL literal,
- kept the actor email as the bound actor ID,
- added regression checks that compare SQL placeholder counts with bound values for reservation mutation builders.

The successful proof above was run only after the fix.

## Production isolation

Production was checked before and after the staging proof:
- latest migration: `0008_concurrency_guards.sql`,
- Product/Inventory/Reservation tables: 0,
- production orders: 3,
- reservation feature flag: absent,
- cron schedules: none.

No Product Core, Inventory Core, reservation or return migration was applied to Production.

## Release conclusion

Phase 5 Order Reservations is complete on staging. The remaining pre-cutover item belongs to Phase 4 UX sign-off: owner re-test of corrected OTP login and iPad portrait Admin master/detail behaviour.

Phase 6 storefront/commerce stock authority remains locked pending a separate cutover plan and approval.
