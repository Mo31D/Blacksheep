# Session handoff

Updated 28 September 2026. Repository Mo31D/Blacksheep, existing main only.

## Current phase / last completed
- Discovery, shared input validation and safe failed-upload compensation complete.
- Published f6f6ff6 (architecture), ed48978 (validation), 7533b8a (safe compensation), 4a3a64e (locked CI dependencies).
- Published 87cf4b3: refactor: unify new image storage in shared library. All three upload routes now use data/media-upload.ts. Product multipart endpoints remain active adapters; gallery/version mutations and historical URLs unchanged. No schema migration.
- Published ce6b620: fix: guard product media attachments against deletion. Shared availability/deletion-job guard is inside the Product version UPDATE in both add/replace batches.
- Local validation: TypeScript PASS, 59 Vitest files / 363 tests PASS. Fourteen real SQLite/migration-schema tests cover race orderings and slot/history; ten reproduced failures before the fix. Linux Commerce CI 36392535999 SUCCESS, including full check and browser regression. Current task complete; proceed with the next audit below.

## Next recommended task
Audit Section/Appearance asset-reference writes against the same deletion-claim race. Source review: storefront-structure.ts createAdminStorefrontNode inserts node/version unconditionally; updateAdminStorefrontNode guards only node version. website-appearance.ts saveAdminWebsiteAppearanceDraft guards only appearance version. New URL references need atomic availability/deletion checks. Preserve unchanged archived references (historical content remains readable), static/external URLs and both existing/new draft paths. Use the real SQLite test adapter pattern from product-media-attachment.test.ts to reproduce first. Do not assume Product guards cover other entities. Then address backend Brand/category authority only after read-only data comparison. Staging acceptance remains separate from source/CI verification.

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
- Local Windows workerd crashes at D1 startup even elevated. Use Linux CI for migrations/runtime checks; do not claim local full-check success.

## MANUAL ACTION REQUIRED
Deploy the reviewed candidate to staging and accept Product add/replace, library reuse, Section/Homepage/Appearance uploads and history before guarded production promotion. No new secrets/schema needed. Source config does not prove deployed state.

## Git / workstation notes
- Fetch remote main before changes. No new branches or force push.
- GitHub connector publishes identical local trees when Git credential manager stalls; reconcile main by fetch/rebase skipping equivalent patches.
- Windows sparse checkout excludes only historical images/romneys/Con.png; preserve it in Git.
- Git needs bundled GIT_EXEC_PATH at mingw64/bin. Filesystem is read-only; local writes require tool escalation.
- Historical handoff remains at 1d08f3b:docs/SESSION-HANDOFF.md.
