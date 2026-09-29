# Session handoff

Updated 29 September 2026. Repository `Mo31D/Blacksheep`; work directly on existing `main`. Remote main is authoritative because this workstation's `.git` index/ref remains stale and cannot create `.git/index.lock` in the current sandbox. Do not push the stale local ref or create a branch. Publish changed files through the GitHub connector with a fast-forward-only ref update if Git remains restricted.

## Current phase and last completed task

Phase 7 staging acceptance is in progress. `d3ce3717a6b9db6d3ae746452936f043669777e6` was deployed to staging by [Commerce Staging V2 Deploy #48](https://github.com/Mo31D/Blacksheep/actions/runs/36616172660), SUCCESS. Its checks, staging migration, deploy and health steps passed. Read-only Cloudflare checks confirmed the staging Worker deployment at 2026-09-29 19:04 UTC and D1 migration `0025_website_appearance_decorations.sql`. No production Worker deploy or production-data mutation was performed.

Staging password login succeeded. Products loaded 146 catalogue records. Appearance loaded the published DEFAULT version; Winter selection enabled optional decorations and private preview worked without publishing. A reproducible image-preview defect was found: stored storefront-relative hero `/images/1.png` resolved against the staging Worker host and broke in the editor/private preview. Source fix: `commerce/src/admin/shared-media.ts` resolves relative display URLs at the storefront origin and `commerce/src/admin/ui.ts` reuses it in private Appearance preview; stored references/API payloads stay unchanged. `commerce/test/admin-html-script.test.ts` covers the generated resolver. TypeScript and 77 files / 570 tests PASS locally. See `STAGING-ACCEPTANCE-2026-09-29.md` for evidence. This fix is not in deployment #48 and must be re-deployed to staging through the guarded workflow before browser recheck.

## Current task / next recommended task

Commit the tested preview fix, checklist, handoff and acceptance evidence to `main`; verify GitHub checks. Continue staging acceptance using test-only data: Product/Media/Section/Homepage uploads/reuse, inventory/stocktake, order/reservation, Appearance publish/restore, Winter/Christmas desktop/mobile and slow/weak-device safeguards. Re-run the guarded staging workflow on the new commit before claiming the preview defect is fixed in deployment. The available GitHub connector cannot dispatch workflows; do not use an ad hoc Worker upload.

## Decisions and unresolved risks

- The Worker/API and D1/R2 remain the canonical owners; public storefront paths are preserved. Appearance draft/publish/restore is versioned; decorations are opt-in and default off for existing published versions.
- Staging Worker secret names include `ADMIN_PASSWORD` and `RESEND_API_KEY` but **not** `STAGING_EMAIL_ALLOWLIST`. New staging mail policy fails closed, including Admin codes. Password sign-in works. Do not send test mail to the production owner or real customers. An authorized operator must choose a safe staging mailbox and set the staging-only allowlist before email acceptance; no address or secret belongs in Git.
- Phase 6 historical `loader.js`, `.b64` and restore assets remain untouched. Route parity and source absence are documented in `LEGACY-ASSET-REFERENCE-AUDIT.md`, but deployed external/cached consumers need time-bounded evidence before deletion.
- Local Windows workerd D1 launch fails; Linux Commerce CI is the complete runtime/migration gate. No production promotion without explicit user approval.

## Relevant commits

- `cde043a`: final Phase 5A theme/performance implementation; Commerce CI, Search, Pages and Storefront Overlay QA SUCCESS.
- `960c07e`: Phase 6 historical asset reference inventory; no deletion.
- `d3ce371`: latest staging deployed source/documentation, Commerce Staging V2 Deploy #48 SUCCESS.
- The preview fix in this handoff awaits the next main commit and GitHub check result; replace this line once published.
