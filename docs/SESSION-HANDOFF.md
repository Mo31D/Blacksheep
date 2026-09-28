# Session handoff
Updated 28 September 2026. Repository Mo31D/Blacksheep; existing main only.

## Current phase / last completed
- Phase: inventory and Stocktake resilience. Previous main ab9bbae includes replay identity ca6605e and unchanged-count versions 10a068a; both passed Linux Commerce CI and browser regression.
- Previous implementation 9d87462 recovers same-attempt partial commits; Linux CI 36468252710 passed.
- Current implementation fences count writes with session version/status and prevents edits/cancellation once an attempt has saved movements. Racing receipts are reconciled; stale final summaries return a conflict.
- Twelve concurrency failures reproduced; 15 concurrency tests plus API feedback coverage now pass. TypeScript PASS; 66 files / 473 tests PASS.
- Publish current batch and record its Linux CI. No schema migration or live stock write. See INVENTORY-WRITE-AUDIT.md.

## Next recommended task
Review response-loss retries after the session is already COMPLETED, then reservation release/consume/return using real-schema concurrency tests. Current fencing covers edit/cancel/write races; it does not make all count items one transaction. Keep work in small independent commits.

## Decisions / risks
- D1 inventory balances/movements are authoritative. Stocktake owns workflow, not a second stock counter. Receipt lookup fails closed on ambiguous/type/quantity/key mismatches.
- Product maker and shop classification are distinct (BRAND-OWNERSHIP-AUDIT.md).
- Shared Media owns new uploaded bytes; Product/content versions own references. Preserve historical URLs, ownership guards and ambiguous-failure retention.
- No Worker deployment, schema migration, business-data mutation or synthetic email in this batch.
- Production clean Product routes remain disabled. Prior staging inspection showed older UI than main; deployed SHA was unknown. Do not reimplement source fixes because of deployment drift.
- Full historical validation evidence is in ARCHITECTURE-REHABILITATION-CHECKLIST.md. Local Windows workerd crashes at D1 startup; use Linux CI for runtime/migration gates.

## MANUAL ACTION REQUIRED
Deploy reviewed candidate to staging and accept Product/library/Section/Homepage/Appearance workflows and inventory/Stocktake behaviour before guarded production promotion. Source config does not prove deployed state. No new secrets or schema required for this batch.

## Git / workstation
- Fetch newest main before edits; no new branches or force push.
- GitHub connector publishes an identical local tree when Git credential manager stalls; fetch/rebase skips equivalent patches.
- Windows sparse checkout excludes only historical images/romneys/Con.png; preserve it in Git.
- Bundled Git needs GIT_EXEC_PATH at mingw64/bin. Local filesystem writes require tool escalation.
