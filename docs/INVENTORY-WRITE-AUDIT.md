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
- Bulk unchanged-count validation and Stocktake session-level recovery are completed below.
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

Four additional real-schema cases cover a committed final summary with lost response for tracked/untracked stock, later stock movement preservation, no-op replay, and mixed outcomes across REVIEW. Three failures reproduced before the fix. TypeScript and all 477 tests pass. Published 465610f; Linux Commerce CI 36529470545 SUCCESS, including full check and browser regression. Search 36529470522 and Pages 36529469805 SUCCESS. No schema or live-data mutation. Stocktake resilience source phase is closed; staging acceptance remains required. Next work belongs to order reservation lifecycle concurrency.

## Next phase opened: reservation lifecycle (29 September 2026)

Source audit started only after Stocktake completion fix 465610f was saved on GitHub. No reservation implementation change or live-data write yet.

| Transition | Owning service / callers | Atomic boundary to verify |
| --- | --- | --- |
| Release ACTIVE / COMMITTED | order-reservations.ts prepareReservationReleaseMutation; order-revisions.ts supersede/send, customer-review.ts decline, admin-orders.ts cancellation, expireDueReservations | Caller batches revision/order transition with balance release, reservation terminal state and events. |
| Consume COMMITTED | prepareReservationConsumeMutation; admin-orders.ts fulfilment | On-hand and reserved decrement together with CONSUMED state and SALE ledger; guarded by order and reservation versions/tokens. |
| Return CONSUMED | returnConsumedReservationToStock; Admin return endpoint | Refunded order guard, on-hand increment, returned_at receipt and RETURN/event in one batch. Catch recovery reads returned_at for a committed retry. |

Release/consume/return intentionally assign NULL to a NOT NULL mutation_token on guard failure: migration 0011 enforces rollback of the entire batch, including earlier variant updates. Preserve this guard unless executable tests justify a change; a simple conditional no-op replacement could allow partial commits.

Coverage inspected: test/order-reservations.test.ts checks generated statement contracts with a mock whose batch returns an empty array. scripts/test-order-reservations.mjs executes migration/schema invariants (unique keys, immutable membership and unchanged stock), not these domain concurrency scenarios. Neither is evidence that racing multi-variant transitions roll back correctly.

Next independently executable work:
1. Add all-migrations SqliteD1 fixtures with two tracked variants and real order/revision/reservation rows. Run the actual prepared release and consume statements. Change the second balance or order/reservation state after planning, before batch; prove the first balance, reservation, ledger and order/event changes all roll back. Also prove valid and all-untracked transitions.
2. Exercise returnConsumedReservationToStock with a competing return, a lost response after commit, and a stale refund/order guard. Assert exactly one RETURN per variant and one event, preservation of later stock adjustments, and no mutation on invalid refund state.
3. Test caller composition (expiry versus payment/fulfilment, cancellation and customer decline); only fix defects after reproduction. Do not equate builder SQL assertions with end-to-end transaction proof.

### Release/consume proof completed

reservation-transitions-concurrency.test.ts uses helpers/reservation-fixture.ts and actual all-migration SQLite statements. Fifteen cases verify ACTIVE/COMMITTED release, COMMITTED consume, tracked/all-untracked success and complete rollback on competing second-balance/reservation/order changes. The first balance plus composed earlier order/event writes are included in state equality. No production defect reproduced; retain existing NOT NULL guard. TypeScript and all 15 targeted cases pass. Published 355827a: Commerce CI 36530647707, Search 36530647828 and Pages 36530647230 SUCCESS. Full local suite 492/492 PASS.

### Return proof completed

reservation-return-concurrency.test.ts executes returnConsumedReservationToStock against the shared all-migrations fixture. Ten cases prove tracked/untracked replay, racing return, lost committed response, preservation of later stock adjustments, rollback on stale second balance/refund/order/reservation guards and rejection before refund. Exactly one RETURN per variant and one event are asserted. No defect reproduced; TypeScript and 10 targeted tests pass. Published 848876d: Commerce CI 36531316256, Search 36531316234 and Pages 36531315582 SUCCESS; full local suite 502/502 PASS.

### Caller composition: four reproduced failures fixed

reservation-callers-concurrency.test.ts executes real Admin actions, expiry and customer decline. Before the fix, expiry/payment/consumption winning before reservation-plan lookup made admin-orders.ts treat a missing expected ACTIVE/COMMITTED hold as an unguarded legacy action. Three tests proved stale payment, cancellation and completion could overwrite state or duplicate events. A fourth proved decline could invalidate a now-paid revision if payment won before its ACTIVE-hold lookup.

admin-orders.ts now guards lifecycle writes independently of whether a plan was found. The no-plan path atomically requires no reservation row for that revision, preserving truly historical reservation-free orders; normal order-state guards still apply. Its immediately following event requires changes() > 0 as well as the existing state/time checks, so a stale no-op cannot borrow another request's timestamp. SQLite documents this function as the last completed write's row count: https://www.sqlite.org/lang_corefunc.html#changes . Keep these two statements adjacent when no reservation plan exists. With a plan, the existing token/NOT NULL rollback fence is unchanged.

customer-review.ts adds the unpaid/payment-requested order condition directly to the revision decline UPDATE; subsequent writes already depend on that revision's new token. Existing conflict responses are preserved. Four failures now pass within 14 caller cases; TypeScript and full 69-file / 516-test suite PASS. GitHub gate pending publication. No schema or live-data changes. Bounded reservation tasks are complete in source; staging acceptance is separate.
