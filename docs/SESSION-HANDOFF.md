# Session handoff

Updated 28 September 2026. Repository Mo31D/Blacksheep, existing main only.

## Current phase / last completed
- Prior main 90c1d58 includes shared image input/storage, safe compensation and Product deletion-race protection; all prior implementation CI passed.
- Completed Section/Appearance guard: 202f24d; Commerce CI 36429624306 SUCCESS.
- Last completed: 12800da preserves product maker independently of shop range labels. Removed destructive UI projection; explicit maker field preloads existing values. Read-only production/staging audit documented in BRAND-OWNERSHIP-AUDIT.md; no database writes/migration.
- TypeScript PASS; 62 files / 424 tests PASS, including three UI regressions and two real-schema ownership tests. Isolated local form layout reviewed; this is not deployed acceptance.
- Maker fix is saved on main; Commerce CI 36464029093, Search 36464029200 and Pages 36464026579 SUCCESS.
- Current batch: inventory replay identity validation. Three racing-key failures reproduced, central replay guard implemented; TypeScript and 439 tests PASS. See INVENTORY-WRITE-AUDIT.md. Publish and record Linux CI before next implementation.

## Next recommended task
Reproduce Stocktake retry after inventory writes commit but session result persistence fails; verify preflight versus idempotency and session/item races. Then review bulk unchanged-version semantics and reservation transitions. Source inventory writer mapping is complete; broader concurrency audit remains open. Maker/category ownership audit is complete; preserve the distinct owners. Also review the remaining shared_media_references registration helper for atomicity; its only current runtime caller follows protected Product attachment, so it is not an independent image persistence owner.

## Decisions / risks
- D1 owns commerce; main owns code/static outputs. Production clean Product routes remain disabled.
- New bytes belong to library assets; Product rows own versioned gallery associations. Historical Product-scoped R2 data stays valid.
- A saved asset survives failed attachment/reload; ambiguous D1 ownership never authorizes R2 deletion. Failed attachments can leave reusable assets visible in Media Library.
- Library deletion counts Product media rows directly, including history. No endpoint retirement or old asset migration in this batch.
- No Worker deployment, business-data D1/R2 mutation or synthetic email performed. Automatic Pages build is separate.
- Read-only staging browser inspection found older duplicate search/URL-first Appearance UI than main; deployed SHA unknown. Signed out. Do not mistake deployment drift for new source defects.

## Validation evidence
- ed48978: Linux Commerce CI 36344781535 SUCCESS.
- 7533b8a: Linux Commerce CI 36369246615 SUCCESS.
- 4a3a64e: Linux Commerce CI 36369475275 SUCCESS, including locked install/full check/browser regression. Search 36369475264 and Pages 36369474892 SUCCESS.
- 87cf4b3: Commerce CI 36391977922 SUCCESS including full check and Chromium/WebKit archive regression; Search 36391977918 and Pages 36391976789 SUCCESS.
- ce6b620: TypeScript and 363 local tests PASS; Commerce CI 36392535999 SUCCESS (full check and Chromium/WebKit archive regression).
- Section/Appearance guard 202f24d: TypeScript and 419 local tests PASS; Linux Commerce CI 36429624306 SUCCESS.
- Local Windows workerd crashes at D1 startup even elevated. Use Linux CI for migrations/runtime checks; do not claim local full-check success.

## MANUAL ACTION REQUIRED
Deploy the reviewed candidate to staging and accept Product add/replace, library reuse, Section/Homepage/Appearance uploads and history before guarded production promotion. No new secrets/schema needed. Source config does not prove deployed state.

## Git / workstation notes
- Fetch remote main before changes. No new branches or force push.
- GitHub connector publishes identical local trees when Git credential manager stalls; reconcile main by fetch/rebase skipping equivalent patches.
- Windows sparse checkout excludes only historical images/romneys/Con.png; preserve it in Git.
- Git needs bundled GIT_EXEC_PATH at mingw64/bin. Filesystem is read-only; local writes require tool escalation.
- Historical handoff remains at 1d08f3b:docs/SESSION-HANDOFF.md.
