# Session handoff

Updated 30 September 2026. Repository `Mo31D/Blacksheep`, existing `main` only. Remote `main` is authoritative: this workstation's local `.git` index/ref is stale and cannot create `.git/index.lock` in the sandbox. Use a fast-forward-only GitHub connector ref update if local Git remains restricted; never push the stale local ref, create a branch or force-push.

## Current phase / last completed task

Phase 7 staging acceptance remains open for Homepage, Stocktake/reservation writes, checkout/Turnstile and physical weak-device checks. Phase 8 Admin productization was registered in the checklist and `ADMIN-PRODUCTIZATION-AUDIT.md` **before** implementation; do not reopen closed backend phases without a reproducible Admin defect. Slice A is on remote `main` as `b43c23e`: `commerce/src/admin/ui.ts` presents one Website primary navigation item and four subordinate tasks, labels Admin Overview clearly and preserves legacy deep links/shortcuts; `commerce/test/admin-html-script.test.ts` verifies generated navigation. TypeScript and all 77 files / 570 tests passed locally. Commerce CI [36659493914](https://github.com/Mo31D/Blacksheep/actions/runs/36659493914), Search, Pages and guarded [staging deploy #51](https://github.com/Mo31D/Blacksheep/actions/runs/36659493906) succeeded. Desktop staging browser review confirmed Website/Sections/Appearance/Image Library routes. Phone-width acceptance remains open because the in-app browser's viewport override stayed at 1280px despite a 390px request. No production Worker/data changed.

Direct Product, Appearance hero and Section image uploads passed using tracked `assets/sheep-icon.png`; QA uploads and Products were archived. The staging-only `STAGING_EMAIL_ALLOWLIST` binding for the user-approved test mailbox is present after deploy, with no value committed. A synthetic test message returned 201/SENT, then D1 webhook `DELIVERED` through Resend. A non-allowlisted invalid recipient returned 502/FAILED with no provider ID. Synthetic order had no reservation/movement and was cleaned to zero rows. Inbox UI was not inspected. Details and fixture IDs: `STAGING-ACCEPTANCE-2026-09-29.md`.

## Current task / next recommended task

Slice B.1 source `581af6a` removes arbitrary pinning of all five Homepage modules in the D1 draft validator, Admin controls and published storefront renderer. TypeScript and all 78 files / 573 tests pass locally. Its Phase 6 browser QA exposed one stale assertion that still expected the old pinned order; the browser actually rendered the requested `COLLECTIONS,HERO,PRODUCT_RAIL,VISIT_SHOP,LOCAL_FAVOURITES` order. The assertion in `commerce/scripts/staging-storefront-overlay-qa.mjs` now expects owner-defined order; verify its rerun, Commerce CI and guarded staging deploy #52 before acceptance. Then inspect generated Admin controls and staging storefront. **Do not publish/restore the existing staging Homepage draft** merely to test ordering; establish ownership or use an isolated fixture. Complete Slice A's real 390px staging browser check of mobile bottom navigation/More and Website child routes using a browser whose viewport control works; keep its checkbox open until then. Card content/contextual editing remains next in Slice B. A synthetic staging order review/revision write flow passed and its rows were cleaned; Stocktake/reservation and full order lifecycle remain open.

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
- `554aa48`: registered Admin productization phase before implementation and recorded staging acceptance.
- `b43c23e`: Slice A navigation code/tests/docs; Commerce CI 36659493914, Search, Pages and staging deploy #51 SUCCESS. Live phone-width browser acceptance remains open.
