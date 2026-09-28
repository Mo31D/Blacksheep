# Session handoff
Updated 28 September 2026. Repository Mo31D/Blacksheep; existing main only.

## Current phase / last completed
- Phase: inventory and Stocktake resilience. Previous main ab9bbae includes replay identity ca6605e and unchanged-count versions 10a068a; both passed Linux Commerce CI and browser regression.
- Current implementation: recover same-attempt Stocktake partial commits from validated inventory ledger receipts before stale-baseline preflight. Existing keys/schema retained; later stock changes preserved.
- Four failures reproduced first; 12 real-schema recovery tests now pass. TypeScript PASS; 65 files / 457 tests PASS.
- Publish this implementation and record its Linux Commerce CI before closing the batch. See INVENTORY-WRITE-AUDIT.md.

## Next recommended task
Reproduce simultaneous Stocktake edit/cancel/finalize races and completed-response retry behaviour. Recovery here handles an unchanged attempt after partial persistence, not an atomic whole-session transaction. Then audit reservation release/consume/return with real-schema failure tests. Keep work in small independent commits.

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
