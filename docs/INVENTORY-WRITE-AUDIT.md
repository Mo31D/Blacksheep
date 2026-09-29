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
- Same-attempt Stocktake receipt recovery is completed below. Edit/cancel/finalize fencing is completed below. Completed-response retry recovery is completed below; reservation concurrency is next.
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

Twelve real-schema cases cover these failures, unchanged ledger on replay, unrelated equal quantities, earlier session versions, malformed/wrong/duplicate receipts and mixed committed/pending items. TypeScript PASS; 65 files / 457 tests PASS. Published 9d87462; Commerce CI 36468252710 SUCCESS, including full check and browser regression. This does not make the entire multi-item finalization one transaction. Subsequent edit/cancel fencing is documented below.

## Completed: fence Stocktake mutations against concurrent edits/cancellation
Twelve race failures were reproduced (ten initial write/edit/cancel/finalizer cases, then two receipt-arrival preflight races). The Stocktake domain supplies a trusted SQL session-version/status predicate to inventory count services; it is evaluated inside the initial variant or balance write, not only in a preflight read. No HTTP payload can supply this predicate. Normal inventory callers retain their existing behaviour.

Once an attempt has committed movements, its items/cancellation cannot change that attempt until finalization is resumed. Both checks are atomic SQL conditions against the existing ledger; there is no new lock table, lease, flag or schema. Item saves also gate session summary updates on the original session version. Completed/REVIEW summary advancement ends that attempt. Finalization checks D1 affected-row metadata and rejects a stale summary instead of returning misleading success. Receipts arriving after either preflight or inventory-write conflicts are reconciled before summary persistence.

stocktake-concurrency.test.ts covers 15 real-schema cases for tracked/untracked items, both edit/cancel orderings, receipt arrival after edit preflight, concurrent finalizers and no-op counts. admin-stocktake-sessions.test.ts verifies HTTP 409/actionable feedback. Updated the prior earlier-attempt receipt fixture because editing a partially committed attempt is now intentionally blocked. TypeScript PASS; 66 files / 473 tests PASS. No schema/generated storefront changes or live stock writes. Linux CI recorded in handoff.

## Completed: replay an already completed Stocktake

stocktake.ts returns a shared completion projection on the first successful completion and subsequent finalize requests. Saved item outcomes own cumulative success/no-change counts, including prior REVIEW attempts; SKIPPED remains in the session summary. Snapshots describe live inventory, not a historical balance to restore. batchId is one actual session movement batch (deterministic by movement ID), or null if none exists; it is not a new receipt or an exhaustive list of batches. REVIEW responses retain per-attempt results. CANCELLED sessions still reject finalization.

Four additional real-schema cases cover a committed final summary with lost response for tracked/untracked stock, later stock movement preservation, no-op replay, and mixed outcomes across REVIEW. Three failures reproduced before the fix. TypeScript and all 477 tests pass. No schema or live-data mutation. Stocktake resilience source phase is closed; staging acceptance remains required. Next work belongs to order reservation lifecycle concurrency.
