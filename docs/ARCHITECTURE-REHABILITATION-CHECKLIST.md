# Architecture rehabilitation checklist

Active project memory, started 27 September 2026 from `main` `1d08f3b`. Read `ARCHITECTURE-MAP.md`, `ARCHITECTURE-REHABILITATION-PLAN.md`, `ARCHITECTURE-DECISIONS.md` and `SESSION-HANDOFF.md` first. Earlier platform cards are historical release evidence; their closed work must not be reimplemented. Checkboxes mean the stated task/evidence only, not blanket production acceptance.

## Phase 0 — Discovery and continuation safety

- [x] Fetch current main and inspect recent history before edits. Fresh clone at `1d08f3b`; clean main verified. No branch created. Windows sparse checkout omits only tracked `images/romneys/Con.png`, which cannot be materialized normally on Windows; Git retains it.
- [x] Trace storefront, Admin, order/inventory/media/auth/email/publication owners. Added `ARCHITECTURE-MAP.md` with source-to-consumer flows, Admin IA, generation overwrite boundaries and configured environment differences. Evidence: entrypoint, routes, data modules, package scripts, Wrangler config and workflows reviewed. This is source evidence, not fresh deployed-state verification.
- [x] Establish concise plan and significant decisions in `ARCHITECTURE-REHABILITATION-PLAN.md` and `ARCHITECTURE-DECISIONS.md`. Replace contradictory chronological handoff with the current queue; historical details remain in dated reports and Git.

## Phase 1 — Data ownership and production risk

- [x] Reproduce and fix destructive Product upload/replace compensation. `routes/admin.ts` previously deleted the new R2 key when a post-save response read failed. `data/media-upload-cleanup.ts` now owns compensation for Product upload, replacement and shared-library upload, checks both ownership stores, preserves historical Product rows and fails closed on D1 errors. `test/media-upload-cleanup.test.ts` reproduced four failing committed/uncertain scenarios before the fix; the two unowned cases already passed. Validation on 28 September: TypeScript PASS; all 57 Vitest files / 339 tests PASS, including nine compensation cases and the unchanged media ownership/deletion suites.
- [ ] Audit Product/Shared Media upload and replace partial failures. Enumerate callers in UI, scripts, tests and external/deployed integrations; verify ambiguous D1 commit retains R2 objects and history. Existing `shared-media-ownership`, `shared-media-delete-claim`, `product-media-coexistence` tests are the minimum regression baseline.
- [ ] Define brand/category write authority at backend boundary. Inspect `product-editor.ts` create/save/duplicate/import paths and `ui.ts` projection. Compare existing D1 brand/category values read-only before proposing a migration; do not discard historical text blindly.
- [ ] Confirm every stock write enters inventory/reservation services, including Stocktake completion, returns and order revisions. Add concurrency/failure tests for any uncovered write path before changing it.

## Phase 2 — Shared media transport and lifecycle

- [x] Trace active Product media callers: `admin/ui.ts` add uses shared upload plus `/media/from-library`; replacement still posts multipart to `/media/:id/replace` and preserves gallery position/primary/alt text. `admin-products-readonly.test.ts` covers the old transport. Do not delete replacement as unused. External/deployed callers remain unverified; lifecycle migration is still open.

- [x] Centralize upload validation in `commerce/src/http/image-upload.ts`; `routes/admin.ts` imports the two contract readers. Removes duplicate multipart/size/MIME/signature/checksum logic while preserving metadata validation order and Product/library error codes. No route, storage key, D1 schema, UI or publication behaviour changed.
- [x] Add `commerce/test/image-upload.test.ts`: both readers, JPEG/PNG/WebP signatures, digest, missing/empty/oversized/type-mismatch files, exact 8 MiB boundary, alt/title normalization and error precedence. Validation: TypeScript PASS; all 56 Vitest files / 330 tests PASS, including existing Product route, library ownership and generated Admin script coverage.
- [ ] Consolidate Product-specific R2 creation/replacement into the shared asset lifecycle after Phase 1 caller/history proof. Preserve product associations and old public media URLs. Remove superseded endpoints only after consumers migrate and staging acceptance passes.
- [ ] Browser-verify Product, Section, Homepage and Appearance uploads/reuse as one non-technical workflow on mobile/tablet/desktop after deployment of the candidate. Recent `f91b72c`, `6e149c9`, `eb56845` already establish direct-upload UI; preserve them.

## Phase 3 — Backend and Admin boundaries

- [ ] Extract a cohesive Admin route area with dependency seams and unchanged authorization/error contracts; start with media after lifecycle audit. Do not introduce another router/application.
- [ ] Extract matching Admin UI responsibilities from `admin/ui.ts` with script syntax and existing browser-contract checks. Keep full Product editing in Products; Stocktake remains the single bulk-count workspace.
- [ ] Audit quick/full edits for identical validation/version/conflict semantics. Document intentionally independent classification, navigation placement, selling controls and publication.

## Phase 4 — Storefront publication and generation

- [x] Align primary CI and guarded deployment with the committed dependency lockfile. `.github/workflows/commerce-ci.yml` and `commerce-deploy.yml` use `npm ci --no-audit --no-fund` and key npm cache by `commerce/package-lock.json`, matching the documented local command. Explicit ephemeral Playwright install stays pinned and separate. Validation: lockfile install previously PASS; checked exact workflow diff and unchanged triggers/production confirmation. Final Linux CI remains the acceptance gate.

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
- [ ] Check Linux Commerce CI on the pushed implementation SHA, then staging upload/auth/order regression and guarded production promotion separately. No production deployment or D1/R2 mutation has been performed in this rehabilitation session.

## MANUAL ACTION REQUIRED

- If local Windows workerd continues failing, use existing Linux CI for the complete gate; repairing the machine runtime is independent of application refactoring.
- External secret/DNS/provider changes are not requested by this batch. If environment audit discovers a required change, record the exact action here without secret values and continue independent tasks.

## Commit ledger

- Baseline: `1d08f3b` (latest fetched main at discovery).
- Documentation batch: `docs: map architecture and establish rehabilitation memory`.
- First implementation batch: `refactor: centralise image upload validation` (validation and files recorded above).
- Published documentation: `f6f6ff6`; published image validation: `ed48978`. GitHub connector published trees identical to local commits because local Git credential manager stalled; local main reconciled by skipping equivalent patches. No force update or new branch.
- Second implementation batch: `fix: preserve owned media after upload failures` (shared compensation and regression proof above).
