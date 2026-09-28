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

test/inventory-replay-identity.test.ts uses all migrations in SQLite and injects real competing writes before the atomic batch. Three tests failed before the fix. Fifteen cases verify pre-existing/racing mismatches, unchanged losing state, matching retries without extra movement, committed-but-lost responses, and uncommitted database failures. TypeScript PASS; all 63 files / 439 tests PASS. Published ca6605e; Linux Commerce CI 36465324317 SUCCESS, including full check and browser regression.

## Remaining work
- Same-attempt Stocktake receipt recovery is completed below. Concurrent session edit/cancel/finalize and completed-response retry semantics still require a separate audit.
- Bulk unchanged-count validation is completed below; Stocktake session-level recovery remains separate.
- Review whether same-target idempotency keys also need request payload/type fingerprints. This batch preserves existing contracts and only closes the asymmetric identity validation.
- Verify reservation release/consume/return concurrency and idempotency with real-schema execution, supplementing existing reservation tests and Linux runtime scripts.
- Deployed staging acceptance remains required; no live stock write or Worker deployment was performed.

## Completed: unchanged bulk counts respect versions
A matching quantity previously skipped expectedBalanceVersion validation. An intervening stock write could therefore be reported as unchanged despite a stale count baseline. bulkInventoryCount now validates the supplied version on its no-op path. A stale baseline is accepted only when the existing child idempotency key proves a committed replay through the shared replay guard. Current unchanged counts still create no movement; omitted versions retain their existing fallback contract.

Two failing cases reproduced stale and invalid versions before the fix. inventory-bulk-version.test.ts adds six real-schema cases, including retries after later stock changes and no extra movement on replay. TypeScript PASS; 64 files / 445 tests PASS. This is not a claim of atomic session finalization or strict idempotency payload fingerprints. No schema/UI/live-data changes.

Published bulk fix 10a068a: Commerce CI 36465848390 SUCCESS (full check and browser regression); Search 36465848387 and Pages 36465847112 SUCCESS.

## Completed: resume Stocktake after partial inventory commit
stocktake-recovery.test.ts reproduced four failures: tracked/untracked committed counts, later stock changes and a receipt from another chunk were falsely classified as conflicts after session result persistence failed. inventory.ts now owns a read-only getInventoryCountReplay boundary; stocktake.ts checks it before stale-baseline preflight. The existing session/version/chunk key format is preserved, including older chunk receipts. No new receipt table or inferred stock ownership.

Recovery requires exactly one movement for the current attempt, variant and location, a valid chunk key suffix, the expected count movement type/reason and matching counted quantity. Ambiguous or malformed receipts remain conflicts. Recovered batch IDs remain available; remaining items still use bulkInventoryCount. Later stock adjustments are never overwritten by recovery.

Twelve real-schema cases cover these failures, unchanged ledger on replay, unrelated equal quantities, earlier session versions, malformed/wrong/duplicate receipts and mixed committed/pending items. TypeScript PASS; 65 files / 457 tests PASS. Published 9d87462; Commerce CI 36468252710 SUCCESS, including full check and browser regression. This does not make the entire multi-item finalization one transaction or resolve simultaneous edits/cancellation.
