# Session handoff

Updated 30 September 2026. Repository `Mo31D/Blacksheep`, existing `main` only. Remote `main` is authoritative: this workstation's local `.git` index/ref is stale and cannot create `.git/index.lock` in the sandbox. Use a fast-forward-only GitHub connector ref update if local Git remains restricted; never push the stale local ref, create a branch or force-push.

## Current phase / last completed task

Phase 7 staging acceptance remains open for Homepage, Stocktake/order/reservation writes, checkout/Turnstile and physical weak-device checks. Phase 8 Admin productization has been registered in the checklist and `ADMIN-PRODUCTIZATION-AUDIT.md` **before** implementation; do not reopen closed backend phases without a reproducible Admin defect. The latest committed code fix is `509d153` (static-image preview resolver). `53bf362` triggered guarded [Commerce Staging V2 Deploy #50](https://github.com/Mo31D/Blacksheep/actions/runs/36657909849), SUCCESS. Browser recheck on staging: existing `/images/1.png` loaded from the storefront origin at 1400px in editor and private preview; Product `/media/...` loaded from staging R2 at 512px. No production Worker/data changed.

Direct Product, Appearance hero and Section image uploads passed using tracked `assets/sheep-icon.png`; QA uploads and Products were archived. The staging-only `STAGING_EMAIL_ALLOWLIST` binding for the user-approved test mailbox is present after deploy, with no value committed. A synthetic test message returned 201/SENT, then D1 webhook `DELIVERED` through Resend. A non-allowlisted invalid recipient returned 502/FAILED with no provider ID. Synthetic order had no reservation/movement and was cleaned to zero rows. Inbox UI was not inspected. Details and fixture IDs: `STAGING-ACCEPTANCE-2026-09-29.md`.

## Current task / next recommended task

Publish the updated staging evidence, Phase 8 checklist registration and initial Admin audit to remote `main`; verify GitHub checks. Then perform Phase 8 Slice A as a bounded navigation/IA change: one Website workspace with subordinate Homepage, Sections/collections, Appearance/themes and Image Library; one obvious Overview. Preserve existing routes/deep links and API contracts. Test generated Admin and mobile navigation, update checklist/handoff, commit and verify checks before the next slice. Continue independent Phase 7 staging gates using isolated fixtures; do not overwrite the existing Homepage draft or unfinished Stocktake.

## Decisions and unresolved risks

- Worker/D1/R2 and Shared Media remain canonical. Admin productization changes presentation and workflow, not domain ownership. Existing Appearance versioning and Product media lifecycle stay intact.
- Staging Workspace has an existing Homepage draft and unfinished Stocktake. A stale browser state produced an expected Homepage version conflict until Refresh. Do not publish/restore or mutate those records as QA fixtures without first establishing ownership.
- Phase 7 still needs deployed Stocktake/order/reservation and customer checkout/Turnstile tests, plus physical Save-Data/≤2 GiB acceptance. Source theme tests already cover device-policy decisions; normal-device seasonal browser checks passed. CAPTCHA completion requires action-time approval in browser automation. No production promotion without explicit user approval.
- Phase 6 historical `loader.js`, `.b64` and restore assets remain untouched. Route parity/source absence are documented in `LEGACY-ASSET-REFERENCE-AUDIT.md`; Cloudflare Free Website `/logs/received` returned `1010 auth.forbidden`. Obtain equivalent time-bounded external-consumer evidence before deletion.
- Local Windows workerd D1 launch fails; Linux Commerce CI is the complete runtime/migration gate.

## Relevant commits

- `d3ce371`: initial staging deploy #48 and migration 0025.
- `deffbab`, `509d153`: static preview resolver; final Commerce CI 36618633316, Search 36618633413, Pages 36618632065 SUCCESS.
- `a92e196`: initial seasonal/Media staging acceptance record.
- `53bf362`: direct upload/mail configuration evidence and guarded staging deploy trigger; deploy #50, Search and Pages SUCCESS.
