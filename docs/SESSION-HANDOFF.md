# Session handoff
Updated 29 September 2026. Repository Mo31D/Blacksheep; existing main only.

## Current phase / last completed
- Phase 4 supplier writer audit complete locally: uncalled Romney direct catalogue writer retired, with ownership/caller proof in ROMNEYS-SYNC-OWNERSHIP-AUDIT.md. Search Readiness PASS (146/17/166 URLs, zero placeholders) and Product Core validation PASS (146 products/136 media); publication and GitHub checks pending this task. Existing catalogue, images and D1 data unchanged.
- Phase 4 candidate publication audit COMPLETE. Published exporter 0700cbd and current-state workflow gate efa0ccf. Read-only staging CI run 36560733660 SUCCESS: 146/146 Product parity, zero semantic/missing/new differences, 146 Product pages, 14 collection pages, zero verifier failures, deterministic 162-file package SHA-256 61d0b5f8cd4e038d3d6b38fff8bda77fe1bd491fc7f6c796ac59089522d7c3f7. No tracked site changes, unsafe slug removals or live mutation. Search 36560733694 / Pages 36560733344 SUCCESS.
- Product edit and lifecycle concurrency fixes published ee20351 and 4423238; full Commerce CI 36537699726 and 36538739167 SUCCESS, 551 local tests PASS. See PRODUCT-EDIT-OWNERSHIP-AUDIT.md.
- Reservation release/consume, return and caller fixes published 355827a, 848876d and 048432e; full CI SUCCESS. Stocktake code phase CLOSED at 465610f. See INVENTORY-WRITE-AUDIT.md.
- Shared Media route/UI extraction published 2b9d553 and 4504c07 with full CI SUCCESS. Product multipart adapters remain by design; external caller/deployed acceptance is pending.

## Next recommended task
After publishing and verifying the Romney writer retirement, the next open independent item is actual staging browser fallback/membership across archived and new Products. Browser inspection must be read-only and retain production clean Product routes disabled.
## Decisions / risks
- D1 balances/ledger own stock; reservation and Stocktake services own workflows. Missing expected reservation state must not bypass order concurrency guards; truly reservation-free legacy orders remain supported.
- New image bytes belong to Shared Media; Product/content versions own references. Preserve historical URLs, atomic attachment guards and ambiguous-failure retention.
- Product maker differs from Brand/Range classification (BRAND-OWNERSHIP-AUDIT.md).
- Production clean Product routes remain disabled. Source tests do not prove deployed SHA or live acceptance. Local Windows workerd fails at D1 startup; Linux CI covers runtime/migrations.
- No Worker deployment, schema migration, business-data mutation or synthetic customer email in these tasks.

## MANUAL ACTION REQUIRED
At the deployment/acceptance phase, verify candidate SHA and external media callers, then accept Product/library/Section/Homepage/Appearance and inventory/order workflows on staging. Production deployment and production-data changes require explicit approval at that phase. Do not use production for fixture writes.

## Git / workstation
- Fetch latest main before edits; no new branches/force push. Publish each task and verify GitHub checks before the next.
- GitHub connector publishes an identical local tree when credential manager stalls; fetch/rebase skips equivalent patches.
- Windows sparse checkout excludes only historical images/romneys/Con.png; preserve it in Git. Bundled Git needs GIT_EXEC_PATH at mingw64/bin. Writes/tests may require tool escalation.
