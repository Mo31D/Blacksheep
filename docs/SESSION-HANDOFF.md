# Session handoff
Updated 29 September 2026. Repository Mo31D/Blacksheep; existing main only.

## Current phase / last completed
- Previous main verified: fe4790d. Its Commerce CI 36470349358, Search 36470348637 and Pages 36470348575 all completed SUCCESS, including full check and browser regression.
- Stocktake resilience source phase CLOSED: receipt recovery (9d87462), session/write fencing (fe4790d), and completed-response retry fix 465610f. Completion uses saved cumulative item outcomes without stock writes; first completion and retries share the projection.
- Published implementation 465610f: stocktake.ts and stocktake-recovery.test.ts; three failures reproduced, four new recovery cases. TypeScript PASS; 66 files / 477 tests PASS. Linux Commerce CI 36529470545 SUCCESS, including full check and browser regression; Search 36529470522 and Pages 36529469805 SUCCESS.
- Current phase: reservation lifecycle audit opened after publication. Owner/caller and rollback-boundary matrix recorded in INVENTORY-WRITE-AUDIT.md; no reservation implementation changes yet.

## Next recommended task
Implement the first reservation audit item: two-variant real-schema release/consume tests with competing balance/order/reservation changes before batch. Preserve the intentional NOT NULL rollback guard; existing mock and schema checks do not prove domain race handling. Then cover return replay and caller composition. Stocktake source work is closed; live staging acceptance is still pending. No schema migration or production data changes in this batch.

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
