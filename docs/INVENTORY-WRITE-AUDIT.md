# Inventory write-path audit
Started 28 September 2026 on main ceda039. This is a bounded source audit, not production acceptance.

## Owners and callers
- inventory.ts owns initial counts, manual adjustments and physical counts. Each writes balances plus append-only movements in a D1 batch. routes/admin.ts invokes these services; bulkInventoryCount delegates each item to them.
- stocktake.ts owns count-session workflow and delegates final counts to bulkInventoryCount. It does not write balances directly. Session result persistence occurs after inventory batches.
- order-reservations.ts owns reserved/consumed/returned stock. order-revisions.ts, admin-orders.ts, customer-review.ts and expiry processing compose its reservation statements into their transitions. The Admin return endpoint calls returnConsumedReservationToStock.
- public-catalog.ts/products.ts read availability. inventory-valuation.ts derives value/snapshots; it does not modify quantities.
- SQL writer search in commerce/src found balance writes only in inventory.ts and order-reservations.ts. Runtime migration/test scripts and staging QA fixture cleanup are separate from business writers.

## Completed: replay identity after batch failure
All three inventory count/adjust services checked variant/location on normal idempotent replay but skipped those checks in catch recovery. A competing request could commit the same key for another variant after the initial read. The losing D1 batch rolled back, but returned the other variant's successful snapshot.

replaySnapshot now requires expected variant/location and applies the check on every entry. Initial-count replay additionally preserves its existing INITIAL_COUNT requirement. Existing conflict code maps to HTTP 409. No schema, UI or balance-write SQL changes.

test/inventory-replay-identity.test.ts uses all migrations in SQLite and injects real competing writes before the atomic batch. Three tests failed before the fix. Fifteen cases verify pre-existing/racing mismatches, unchanged losing state, matching retries without extra movement, committed-but-lost responses, and uncommitted database failures. TypeScript PASS; all 63 files / 439 tests PASS. Linux CI must be recorded after publication.

## Remaining work
- Reproduce Stocktake recovery after inventory writes succeed but session result persistence fails. Its preflight currently runs before child idempotency recovery; inspect retry classification and session/item version races.
- Audit bulk unchanged-count handling against an explicitly stale balance version.
- Review whether same-target idempotency keys also need request payload/type fingerprints. This batch preserves existing contracts and only closes the asymmetric identity validation.
- Verify reservation release/consume/return concurrency and idempotency with real-schema execution, supplementing existing reservation tests and Linux runtime scripts.
- Deployed staging acceptance remains required; no live stock write or Worker deployment was performed.
