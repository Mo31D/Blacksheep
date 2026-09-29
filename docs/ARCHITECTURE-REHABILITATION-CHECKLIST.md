# Architecture rehabilitation checklist

Active project memory, started 27 September 2026 from `main` `1d08f3b`. Read `ARCHITECTURE-MAP.md`, `ARCHITECTURE-REHABILITATION-PLAN.md`, `ARCHITECTURE-DECISIONS.md` and `SESSION-HANDOFF.md` first. Earlier platform cards are historical release evidence; their closed work must not be reimplemented. Checkboxes mean the stated task/evidence only, not blanket production acceptance.

## Phase 0 — Discovery and continuation safety

- [x] Fetch current main and inspect recent history before edits. Fresh clone at `1d08f3b`; clean main verified. No branch created. Windows sparse checkout omits only tracked `images/romneys/Con.png`, which cannot be materialized normally on Windows; Git retains it.
- [x] Trace storefront, Admin, order/inventory/media/auth/email/publication owners. Added `ARCHITECTURE-MAP.md` with source-to-consumer flows, Admin IA, generation overwrite boundaries and configured environment differences. Evidence: entrypoint, routes, data modules, package scripts, Wrangler config and workflows reviewed. This is source evidence, not fresh deployed-state verification.
- [x] Establish concise plan and significant decisions in `ARCHITECTURE-REHABILITATION-PLAN.md` and `ARCHITECTURE-DECISIONS.md`. Replace contradictory chronological handoff with the current queue; historical details remain in dated reports and Git.

## Phase 1 — Data ownership and production risk

- [x] Reproduce and fix destructive Product upload/replace compensation. `routes/admin.ts` previously deleted the new R2 key when a post-save response read failed. `data/media-upload-cleanup.ts` now owns compensation for Product upload, replacement and shared-library upload, checks both ownership stores, preserves historical Product rows and fails closed on D1 errors. `test/media-upload-cleanup.test.ts` reproduced four failing committed/uncertain scenarios before the fix; the two unowned cases already passed. Validation on 28 September: TypeScript PASS; all 57 Vitest files / 339 tests PASS, including nine compensation cases and the unchanged media ownership/deletion suites.
- [ ] Audit Product/Shared Media upload and replace partial failures. Enumerate callers in UI, scripts, tests and external/deployed integrations; verify ambiguous D1 commit retains R2 objects and history. Existing `shared-media-ownership`, `shared-media-delete-claim`, `product-media-coexistence` tests are the minimum regression baseline.
- [x] Audit maker/category ownership and remove destructive UI projection. Read-only production/staging D1 aggregates prove distinct concepts (BRAND-OWNERSHIP-AUDIT.md): 47 active production makers have no Brand/Range label; Walker's also appears under Romney's. ui.ts now preloads/saves an explicit Product brand / maker field in create/full edit; category selection cannot erase or replace it. Backend product-editor.ts already preserves omitted maker and copies it on duplicate; no schema/data migration. admin-product-brand.test.ts reproduces three prior UI failures; product-brand-ownership.test.ts verifies real-schema save/clear/duplicate. TypeScript PASS; 62 files / 424 tests PASS. Isolated local form layout inspected; deployed acceptance remains pending.
- [x] Map source inventory writers and fix asymmetric replay identity validation. INVENTORY-WRITE-AUDIT.md records service/caller ownership and remaining scope. inventory.ts now validates target identity centrally in replaySnapshot for both normal retries and catch recovery; initial-count movement type protection remains. inventory-replay-identity.test.ts reproduced three racing-key failures; 15 real-schema cases now pass, including rollback and lost-response recovery. TypeScript PASS; 63 files / 439 tests PASS. No schema or live data changes.
- [x] Validate unchanged bulk counts against expected balance versions in inventory.ts. inventory-bulk-version.test.ts reproduced two failures and covers six real-schema cases: stale/invalid version, current no-op, optional version and committed retries with/without later stock changes. Reuses replaySnapshot for proven retries; no extra movements for a current no-op. TypeScript PASS; 64 files / 445 tests PASS.
- [x] Recover same-attempt Stocktake partial commits from inventory movement receipts before stale-baseline preflight. inventory.ts owns read-only receipt lookup/validation; stocktake.ts merges recovered successes/batch IDs and applies remaining items through bulkInventoryCount. Existing keys/schema preserved. stocktake-recovery.test.ts reproduced four failures and now covers 12 real-schema recovery/mismatch cases. TypeScript PASS; 65 files / 457 tests PASS. Files and boundaries documented in INVENTORY-WRITE-AUDIT.md.
- [x] Fence Stocktake edit/cancel/finalize races. inventory.ts accepts a trusted domain-only SQL guard on count writes; stocktake.ts supplies session version/status, blocks changes after ledger receipts, reconciles racing receipts and verifies final summary writes. routes/admin.ts exposes actionable 409 feedback. stocktake-concurrency.test.ts has 15 real-schema cases; 12 race failures reproduced before their fixes. Recovery and API tests updated. TypeScript PASS; 66 files / 473 tests PASS. No migration or live mutation. See INVENTORY-WRITE-AUDIT.md.
- [x] Verify published fe4790d against latest main on 29 September. Commerce CI 36470349358 SUCCESS (full check and browser regression), Search 36470348637 SUCCESS, Pages 36470348575 SUCCESS. This verifies source/build delivery, not Worker deployment.
- [x] Close Stocktake resilience source work: completed-response retries now project saved APPLIED/UNCHANGED outcomes in stocktake.ts, shared with first completion and cumulative across REVIEW attempts. Current snapshots are read-only; actual ledger batch ID or null replaces invented completion receipts. stocktake-recovery.test.ts reproduces three previous failures and covers four new scenarios including later adjustments, no-op completion, skipped items and prior REVIEW outcomes. TypeScript PASS; 66 files / 477 tests PASS. No schema, UI layout or live stock changes. Published 465610f; Linux Commerce CI 36529470545 SUCCESS (full check and browser regression), Search 36529470522 and Pages 36529469805 SUCCESS. Staging acceptance remains separate.
- [x] Open next inventory-risk phase after publishing Stocktake fix 465610f: trace release/consume/return owners and caller batch boundaries. INVENTORY-WRITE-AUDIT.md records the matrix, NOT NULL rollback guard and evidence limits of existing mock/schema tests. No reservation logic changed.
- [x] Reservation release/consume: reservation-transitions-concurrency.test.ts executes actual builders against all migrations with helpers/reservation-fixture.ts. Fifteen cases cover ACTIVE/COMMITTED release and COMMITTED consume, valid/two-variant/all-untracked transitions, stale second balance, reservation and order guards. Complete before/after state comparison proves rollback includes earlier balance/order/event writes. Existing guards passed; no production logic changed. TypeScript PASS and targeted 15/15 PASS; Published 355827a: Commerce CI 36530647707, Search 36530647828 and Pages 36530647230 SUCCESS. Full local suite 492/492 PASS.
- [x] Reservation return: reservation-return-concurrency.test.ts adds ten real-schema cases for tracked/untracked replay, competing return, lost committed response, later adjustments and stale second balance/refund/order/reservation guards. Asserts one RETURN per variant, one event and complete rollback. Non-refunded order rejected unchanged. Existing implementation passed; no production code change. TypeScript and targeted 10/10 PASS; full GitHub gate pending publication.
- [ ] Verify caller composition for expiry versus payment/fulfilment, cancellation and customer decline. Fix only reproduced defects. Stocktake source phase is closed; neither its fencing nor receipt recovery claims one transaction across all count items.

## Phase 2 — Shared media transport and lifecycle

- [x] Trace active Product media callers: `admin/ui.ts` add uses shared upload plus `/media/from-library`; replacement still posts multipart to `/media/:id/replace` and preserves gallery position/primary/alt text. `admin-products-readonly.test.ts` covers the old transport. Do not delete replacement as unused. External/deployed callers remain unverified; lifecycle migration is still open.

- [x] Centralize upload validation in `commerce/src/http/image-upload.ts`; `routes/admin.ts` imports the two contract readers. Removes duplicate multipart/size/MIME/signature/checksum logic while preserving metadata validation order and Product/library error codes. No route, storage key, D1 schema, UI or publication behaviour changed.
- [x] Add `commerce/test/image-upload.test.ts`: both readers, JPEG/PNG/WebP signatures, digest, missing/empty/oversized/type-mismatch files, exact 8 MiB boundary, alt/title normalization and error precedence. Validation: TypeScript PASS; all 56 Vitest files / 330 tests PASS, including existing Product route, library ownership and generated Admin script coverage.
- [x] Consolidate all new image persistence in commerce/src/data/media-upload.ts. Library, Product upload and Product replacement routes now create library assets before versioned Product associations. Existing transport contracts, old public URLs and add/replace domain logic remain; no schema or historical-object migration. Failed attachments retain reusable library assets. Tests: media-upload.test.ts, media-upload-cleanup.test.ts, admin-products-readonly.test.ts and helpers/media-upload-db.ts cover actual asset creation, R2 failure, ambiguous D1 commit, failed attachment/reload and successful add/replace. Validation: TypeScript PASS; 58 files / 349 tests PASS. Linux gate tracked in handoff.
- [x] Guard Product add/replace against concurrent library archive/delete, including the from-library caller of addAdminProductMedia. data/product-media.ts begins the D1 batch with one optimistic Product update that also checks asset status and deletion jobs. A failed guard leaves Product/version/media/audit rows untouched and returns the existing conflict contract. test/product-media-attachment.test.ts executes actual migrations and domain SQL in in-memory SQLite (Node 22.13+); ten cases failed before the fix, then all fourteen tests passed, including real delete-claim-first and attachment-first orderings and preserved slot/primary/alt/fit/history. TypeScript PASS; 59 files / 363 tests PASS. Published ce6b620; Linux Commerce CI 36392535999 SUCCESS including full check/browser regression. Local SQLite tests complement the D1 runtime gate.
- [x] Protect new Section/Appearance image references from concurrent archive/deletion. Shared predicates in data/shared-media-attachment.ts now guard Product storage keys and newly used content URLs inside the first batch write. storefront-structure.ts creation gates node/version/audit together; updates and website-appearance.ts draft saves retain optimistic version checks. Existing archived references, null/static/external images and unchanged slots remain editable. test/storefront-media-attachment.test.ts reproduced 30 failures before the fix; 56 tests now cover five write paths, actual deletion-claim ordering, mixed image maps and unchanged archived content. Reused real migration/SQLite adapter in test/helpers/sqlite-d1.ts. TypeScript PASS; 60 files / 419 tests PASS. No schema or generated content changes. Linux CI tracked in SESSION-HANDOFF.md.
- [ ] Retire Product multipart endpoints only if all callers migrate; replacement is still active, so retain it. Historical storage migration is separate and not required for new uploads.
- [ ] Browser-verify Product, Section, Homepage and Appearance uploads/reuse as one non-technical workflow on mobile/tablet/desktop after deployment of the candidate. Recent `f91b72c`, `6e149c9`, `eb56845` already establish direct-upload UI; preserve them.

## Phase 3 — Backend and Admin boundaries

- [ ] Extract a cohesive Admin route area with dependency seams and unchanged authorization/error contracts; start with media after lifecycle audit. Do not introduce another router/application.
- [ ] Extract matching Admin UI responsibilities from `admin/ui.ts` with script syntax and existing browser-contract checks. Keep full Product editing in Products; Stocktake remains the single bulk-count workspace.
- [ ] Audit quick/full edits for identical validation/version/conflict semantics. Document intentionally independent classification, navigation placement, selling controls and publication.

## Phase 4 — Storefront publication and generation

- [x] Align primary CI and guarded deployment with the committed dependency lockfile. `.github/workflows/commerce-ci.yml` and `commerce-deploy.yml` use `npm ci --no-audit --no-fund` and key npm cache by `commerce/package-lock.json`, matching the documented local command. Explicit ephemeral Playwright install stays pinned and separate. Validation: lockfile install previously PASS; checked exact workflow diff and unchanged triggers/production confirmation. Linux Commerce CI 36369475275 SUCCESS on 4a3a64e, including locked install, full check and browser regression.

- [ ] Run candidate export → package `--check` → verifier using an approved read-only D1 export and isolated output directory. Record deterministic hashes, parity and canonical/link results; never use the repository root as package output.
- [ ] Audit `scripts/sync-romneys-official-data.py` catalogue-writing use. Integrate verified provenance into the canonical publication inputs or retire with caller proof; do not allow routine supplier sync to override owner commerce values.
- [ ] Verify fallback behaviour for API failure and static/live membership across archived/new products in actual staging browsers. Keep production clean Product routes disabled; URL migration is separate work.

## Phase 5 — Orders, communications and environments

- [ ] Review email retry/idempotency/audit boundaries across notification services, authenticated Admin actions and signed webhook processing. Do not send synthetic customer email from production.
- [ ] Verify configured-versus-deployed D1/R2, Admin URLs, origin/Turnstile policy and secret presence without logging values. Confirm actual staging recipient policy; environment names alone do not isolate email.
- [ ] Consolidate configuration/error helpers only where semantics truly match; retain intentional staging and production differences.

## Phase 6 — Proven legacy cleanup

- [ ] Inventory `.b64`, restore assets, `loader.js` and legacy scripts against runtime HTML, generators, workflows and deployed content. Record replacement and reference evidence before deleting anything.
- [ ] Remove historical compatibility paths only after data migration and consumers are verified; keep canonical public URLs and history references valid.

## Phase 7 — Validation and release

- [x] Run source/static gates: frozen Product Core validation, production import guards, storefront placement compatibility, cart/checkout/legal/dynamic-storefront/homepage contracts, JS syntax, TypeScript and Search Readiness. PASS: 146 static products / 17 active pages / 166 sitemap URLs / zero placeholders. Counts describe the fixture/static snapshot, not current live D1.
- [x] Complete `npm run check` for first extraction `ed48978` in Linux CI: run `36344781535` SUCCESS including complete checks and Chromium/WebKit archive regression; Search Readiness `36344781570` and Pages `36344781456` SUCCESS. Local Windows workerd crashes at D1 startup even elevated; local Admin browser QA script syntax and Wrangler staging bundle dry-run PASS. This CI result covers the first extraction only; each later implementation needs its own gate.
- [ ] Check Linux Commerce CI on the pushed implementation SHA, then staging upload/auth/order regression and guarded production promotion separately. No Worker deployment or business-data D1/R2 mutation has been performed. Read-only staging browser inspection created/revoked an authentication session.

## MANUAL ACTION REQUIRED

- If local Windows workerd continues failing, use existing Linux CI for the complete gate; repairing the machine runtime is independent of application refactoring.
- External secret/DNS/provider changes are not requested by this batch. If environment audit discovers a required change, record the exact action here without secret values and continue independent tasks.

## Commit ledger

- Baseline: `1d08f3b` (latest fetched main at discovery).
- Documentation batch: `docs: map architecture and establish rehabilitation memory`.
- First implementation batch: `refactor: centralise image upload validation` (validation and files recorded above).
- Published documentation: `f6f6ff6`; published image validation: `ed48978`. GitHub connector published trees identical to local commits because local Git credential manager stalled; local main reconciled by skipping equivalent patches. No force update or new branch.
- Second implementation batch: `fix: preserve owned media after upload failures` (shared compensation and regression proof above).

## Continuation evidence - 28 September 2026

- Cleanup fix 7533b8a: Commerce CI 36369246615 SUCCESS; Search 36369246569 and Pages 36369246245 SUCCESS.
- Locked dependency workflows 4a3a64e: Commerce CI 36369475275 SUCCESS; Search 36369475264 and Pages 36369474892 SUCCESS.
- Staging browser inspection (signed out afterwards) showed older duplicate search and URL-first Appearance controls despite newer main UI fixes. Treat as deployment drift; deployed SHA was not established. Do not reimplement those fixes. Candidate upload workflows still require acceptance after staging deployment.

- Shared storage 87cf4b3: Commerce CI 36391977922 SUCCESS (full check and Chromium/WebKit archive regression); Search 36391977918 and Pages 36391976789 SUCCESS.

- Product attachment guard ce6b620: Commerce CI 36392535999 SUCCESS including full D1/runtime check and Chromium/WebKit archive regression. Both implementation commits are on main; local main reconciled cleanly without force push.

- Section/Appearance guard 202f24d: Commerce CI 36429624306 SUCCESS including full check and browser regression.

- Maker ownership fix 12800da: Commerce CI 36464029093 SUCCESS (full check and browser regression); Search 36464029200 and Pages 36464026579 SUCCESS. No Worker deployment or business-data changes.

- Inventory replay guard ca6605e: Commerce CI 36465324317 SUCCESS (full check and browser regression); Search 36465324327 and Pages 36465324062 SUCCESS.
- Bulk count versions 10a068a: Commerce CI 36465848390 SUCCESS (full check and browser regression); Search 36465848387 and Pages 36465847112 SUCCESS. All 445 local tests and TypeScript passed. No Worker deployment or business-data mutation.

- Stocktake receipt recovery 9d87462: Commerce CI 36468252710 SUCCESS (full check and browser regression); Search 36468252672 and Pages 36468251570 SUCCESS. TypeScript and all 457 local tests passed. Concurrent session edits/cancellation remain a separate open task.
