# Session handoff
Updated 29 September 2026. Repository Mo31D/Blacksheep; existing main only.

## Current phase / last completed
- Phase 5 staging email recipient guard implemented locally after the deployed environment audit proved staging shares the production owner recipient. `email-provider.ts` now denies staging/preview outbound delivery by default and accepts only exact `STAGING_EMAIL_ALLOWLIST` addresses; `send-attempt.ts` treats policy rejection as permanent. Production is unchanged. TypeScript and all 75 files / 562 tests PASS. Publish implementation/checklist/handoff and verify GitHub checks before generic config/error helper task.
- Phase 5 configured-versus-deployed environment audit published 3fb4954; Search 36566938518 and Pages 36566938270 SUCCESS. `DEPLOYED-ENVIRONMENT-AUDIT.md` records read-only Cloudflare API evidence. D1/R2 and nonsecret policy values match config, but deployed staging shares the production owner recipient and can email supplied customer addresses. Both deployed Worker builds remain from 27 Sep.
- Phase 5 email retry/idempotency/audit task published c6a54f9. `EMAIL-DELIVERY-OWNERSHIP-AUDIT.md` maps Admin/order/customer-review callers, Resend adapter, D1 audit and signed webhook. Shared retry policy, provider idempotency headers, post-send audit separation and late webhook status guards are in place. TypeScript and full 74-file / 558-test suite PASS. Commerce CI 36565389256, Search 36565389293 and Pages 36565388042 SUCCESS.
- Phase 4 supplier writer audit published 34134db (Search 36561969089 / Pages 36561968525 SUCCESS): uncalled Romney direct catalogue writer retired, with ownership/caller proof in ROMNEYS-SYNC-OWNERSHIP-AUDIT.md. Search Readiness PASS (146/17/166 URLs, zero placeholders) and Product Core validation PASS (146 products/136 media); no further work pending on this task. Existing catalogue, images and D1 data unchanged.
- Phase 4 candidate publication audit COMPLETE. Published exporter 0700cbd and current-state workflow gate efa0ccf. Read-only staging CI run 36560733660 SUCCESS: 146/146 Product parity, zero semantic/missing/new differences, 146 Product pages, 14 collection pages, zero verifier failures, deterministic 162-file package SHA-256 61d0b5f8cd4e038d3d6b38fff8bda77fe1bd491fc7f6c796ac59089522d7c3f7. No tracked site changes, unsafe slug removals or live mutation. Search 36560733694 / Pages 36560733344 SUCCESS.
- Product edit and lifecycle concurrency fixes published ee20351 and 4423238; full Commerce CI 36537699726 and 36538739167 SUCCESS, 551 local tests PASS. See PRODUCT-EDIT-OWNERSHIP-AUDIT.md.
- Reservation release/consume, return and caller fixes published 355827a, 848876d and 048432e; full CI SUCCESS. Stocktake code phase CLOSED at 465610f. See INVENTORY-WRITE-AUDIT.md.
- Shared Media route/UI extraction published 2b9d553 and 4504c07 with full CI SUCCESS. Product multipart adapters remain by design; external caller/deployed acceptance is pending.

## Next recommended task
Next task after the staging recipient guard is published and checks pass: consolidate only genuinely shared configuration/error helpers in Phase 5. Staging browser fallback/membership task is complete at 2853ca7 (QA 36562426938, Commerce CI 36562426866, Search 36562426836 and Pages 36562426290 SUCCESS).
## Decisions / risks
- D1 balances/ledger own stock; reservation and Stocktake services own workflows. Missing expected reservation state must not bypass order concurrency guards; truly reservation-free legacy orders remain supported.
- New image bytes belong to Shared Media; Product/content versions own references. Preserve historical URLs, atomic attachment guards and ambiguous-failure retention.
- Product maker differs from Brand/Range classification (BRAND-OWNERSHIP-AUDIT.md).
- Production clean Product routes remain disabled. Source tests do not prove deployed SHA or live acceptance. Local Windows workerd fails at D1 startup; Linux CI covers runtime/migrations.
- No Worker deployment, schema migration, business-data mutation or synthetic customer email in these tasks. Staging recipient isolation is currently absent in deployed settings; do not exercise mail with real addresses.

## MANUAL ACTION REQUIRED
At the deployment/acceptance phase, verify candidate SHA and external media callers, then accept Product/library/Section/Homepage/Appearance and inventory/order workflows on staging. Production deployment and production-data changes require explicit approval at that phase. Do not use production for fixture writes.
Before staging email acceptance, choose and configure a safe test mailbox/allowlist and verify the new source guard after authorized staging deployment. Deployed staging currently shares the production owner recipient; no address or secret is recorded here.
Configure `STAGING_EMAIL_ALLOWLIST` as a staging-only Worker secret at release. An absent allowlist intentionally blocks staging/preview mail, including Admin email codes; password login remains available. The current deployed Worker does not include the guard.

## Git / workstation
- Fetch latest main before edits; no new branches/force push. Publish each task and verify GitHub checks before the next.
- GitHub connector publishes an identical local tree when credential manager stalls; fetch/rebase skips equivalent patches.
- Windows sparse checkout excludes only historical images/romneys/Con.png; preserve it in Git. Bundled Git needs GIT_EXEC_PATH at mingw64/bin. Writes/tests may require tool escalation.
