# Session handoff
Updated 29 September 2026. Repository Mo31D/Blacksheep; existing main only.

## Current phase / last completed
- Phase 3: shared-media Admin route extraction completed locally. New routes/admin-shared-media.ts owns library HTTP contracts; existing admin.ts retains Origin/auth/DB guards. http/admin-json.ts owns unchanged JSON readers/responses. Product adapters remain. TypeScript PASS; 70 files / 526 tests PASS, including ten new composition cases. Published 2b9d553: Commerce CI 36535646763, Search 36535646738 and Pages 36535646426 SUCCESS, including full check/browser regression.
- Media Library UI extraction published 4504c07. Full production/staging HTML byte-identical; TypeScript and 526 tests PASS. Commerce CI 36536432053, Search 36536432063 and Pages 36536431166 SUCCESS.
- Product draft/quick/variant fix published ee20351: Commerce CI 36537699726, Search 36537699891 and Pages 36537700321 SUCCESS. Nine same-millisecond failures reproduced; 537 local tests PASS.
- Product lifecycle/media fence published 4423238: Commerce CI 36538739167, Search 36538739265 and Pages 36538738373 SUCCESS. Seven stale-success failures reproduced; TypeScript and 72 files / 551 tests PASS. See PRODUCT-EDIT-OWNERSHIP-AUDIT.md.
- Reservation source tasks COMPLETE: release/consume proof 355827a (CI 36530647707), return proof 848876d (CI 36531316256), four caller-race fixes 048432e (CI 36534277220). All full checks/browser regression, Search and Pages SUCCESS. Details: INVENTORY-WRITE-AUDIT.md.
- Source media caller audit 4bc7ff8 passed Search 36535024251 and Pages 36535023864; docs-only commit did not trigger Commerce CI. Six relevant suites / 39 tests PASS. See MEDIA-CALLER-AUDIT.md.
- Stocktake code phase CLOSED (465610f, CI 36529470545 SUCCESS). Do not revisit unless a new test proves a high-risk defect.

## Next recommended task
Phase 4 publication candidate export is the only current task. Local Windows exporter failed before D1 due spawnSync(npx.cmd) EINVAL; script now invokes local Wrangler through Node. Local retry reached Wrangler but lacks CLOUDFLARE_API_TOKEN, so no D1 result. Publish the script fix to trigger publication-candidate-staging workflow; inspect its read-only export, package --check and verifier artifacts. Record hashes, parity and canonical/link findings, then close the checklist item only if proven. Its output is isolated; never target repository root. Do not retire Product multipart routes.

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
