# Session handoff

Updated 29 September 2026. Repository `Mo31D/Blacksheep`; work directly on existing `main`. Remote main is authoritative because this workstation's `.git` index/ref remains stale and cannot create `.git/index.lock` in the current sandbox. Do not push the stale local ref or create a branch. Publish changed files through the GitHub connector with a fast-forward-only ref update if Git remains restricted.

## Current phase and last completed task

Phase 7 staging acceptance is in progress. `d3ce3717a6b9db6d3ae746452936f043669777e6` was deployed to staging by [Commerce Staging V2 Deploy #48](https://github.com/Mo31D/Blacksheep/actions/runs/36616172660), SUCCESS. Its checks, staging migration, deploy and health steps passed. Read-only Cloudflare checks confirmed the staging Worker deployment at 2026-09-29 19:04 UTC and D1 migration `0025_website_appearance_decorations.sql`. Latest source `main` is `509d153` with Commerce CI 36618633316, Search 36618633413 and Pages 36618632065 SUCCESS; the staging Worker still runs `d3ce371`. No production Worker deploy or production-data mutation was performed.

Staging password login and the 146-Product list passed. Shared Media upload to staging R2 and reuse in private hero, Section and QA Product draft passed; the Product and test asset were archived. The pre-existing missing-R2 QA asset was archived. Winter and Christmas were each published to staging, visually checked via storefront `?commerce-preview=staging` at desktop/tablet/phone widths, then original DEFAULT/version 1 restored. Final staging Appearance has decorations off, original `/images/1.png` hero and no draft. Stock and order Test/Business screens loaded; write flows remain open. `STAGING-ACCEPTANCE-2026-09-29.md` contains IDs, evidence, cleanup and limits.

A reproducible image-preview defect was found: static hero `/images/1.png` resolved against the staging Worker host. Source commits `deffbab` and `509d153` fix Admin display resolution while preserving Worker-owned `/media/...` on staging. Stored references/API payloads stay unchanged. `commerce/test/admin-html-script.test.ts` covers the generated resolver. TypeScript and 77 files / 570 tests PASS; final Linux CI passed. The fix is **not** in deployment #48 and must be re-deployed through the guarded staging workflow before browser recheck.

## Current task / next recommended task

Commit this updated acceptance record/checklist/handoff to `main` and verify GitHub checks. Next, have an authorized operator run the guarded Commerce Staging V2 Deploy workflow on `509d153` (or the subsequent docs-only main SHA) and recheck static hero previews in staging Admin. Continue independent test-only acceptance for direct Product/Section/Appearance upload, Homepage, stocktake/order/reservation, checkout/Turnstile and weak-device/Save-Data. The available GitHub connector and unsigned GitHub browser cannot dispatch workflows; do not substitute an ad hoc Worker upload.

## Decisions and unresolved risks

- The Worker/API and D1/R2 remain the canonical owners; public storefront paths are preserved. Appearance draft/publish/restore is versioned; decorations are opt-in and default off for existing published versions.
- Staging Worker secret names include `ADMIN_PASSWORD` and `RESEND_API_KEY` but **not** `STAGING_EMAIL_ALLOWLIST`. New staging mail policy fails closed, including Admin codes. Password sign-in works. Do not send test mail to the production owner or real customers. An authorized operator must choose a safe staging mailbox and set the staging-only allowlist before email acceptance; no address or secret belongs in Git.
- Phase 6 historical `loader.js`, `.b64` and restore assets remain untouched. Route parity and source absence are documented in `LEGACY-ASSET-REFERENCE-AUDIT.md`; the Cloudflare Free Website zone `/logs/received` probe returned `1010 auth.forbidden`. Obtain equivalent time-bounded deployed consumer evidence before deletion.
- Local Windows workerd D1 launch fails; Linux Commerce CI is the complete runtime/migration gate. No production promotion without explicit user approval.

## Relevant commits

- `cde043a`: final Phase 5A theme/performance implementation; Commerce CI, Search, Pages and Storefront Overlay QA SUCCESS.
- `960c07e`: Phase 6 historical asset reference inventory; no deletion.
- `d3ce371`: currently deployed staging source/documentation, Commerce Staging V2 Deploy #48 SUCCESS.
- `deffbab`: static image preview fix and initial staging evidence; Commerce CI/Search/Pages SUCCESS.
- `509d153`: Worker-owned `/media/...` guard; Commerce CI 36618633316, Search 36618633413 and Pages 36618632065 SUCCESS. This is latest implementation but not yet staging deployed.
