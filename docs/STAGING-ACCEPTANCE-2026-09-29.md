# Staging acceptance — 29 September 2026

Target: `main` `d3ce3717a6b9db6d3ae746452936f043669777e6`, deployed by [Commerce Staging V2 Deploy #48](https://github.com/Mo31D/Blacksheep/actions/runs/36616172660). Its pre-deploy validation, staging-only migration, Worker deployment and `/health` steps all succeeded. Read-only Cloudflare checks confirmed the 29 September 19:04 UTC staging deployment and D1 migration `0025_website_appearance_decorations.sql`. This is staging evidence only.

## Acceptance observed on deployed staging

| Area | Evidence | Result |
| --- | --- | --- |
| Password authentication | Signed in through staging `/admin`; authenticated Admin opened with STAGING badge. No email code was requested. | Pass |
| Products | Products view loaded 146 catalogue Products and search/filter/editor controls. No Product data was changed. | Read-only pass; upload/edit open |
| Appearance | Versioned DEFAULT published Appearance loaded after migration 0025. Selecting Winter enabled decorations; private Preview rendered Winter styling without publishing. After the test, the staging draft was reset to DEFAULT; the published version remained DEFAULT. | Partial pass |
| Image preview | Existing hero `/images/1.png` resolved against the staging Worker hostname in the editor and private preview, so the image was broken. Admin rendering must resolve storefront-relative paths against the storefront origin while retaining the stored reference. | Reproducible defect |
| Email isolation | Worker secret names include `ADMIN_PASSWORD` and `RESEND_API_KEY`, but not `STAGING_EMAIL_ALLOWLIST`. The deployed policy denies staging mail by default. No email was sent. | Safe fail-closed; email QA blocked |
| Shared Media | Uploaded the tracked 96,092-byte `assets/sheep-icon.png` through the staging Admin. The resulting `/media/asset_bd3b388a-22f7-4fa1-b6b3-70ccc163ab5a` image rendered at its 512px intrinsic width; D1 recorded the asset and staging R2 listed the same object/key and byte length. | Pass |
| Media reuse | Selected the new asset from Media Library into a private hero draft (private preview image rendered at 512px), a Section image field (512px, then discarded without saving) and a new QA Product draft gallery. The Product remained private and was archived after the test; the asset was archived, preserving historical references. | Pass for shared upload/reuse; direct per-screen upload still open |
| Appearance publish/restore | Published Christmas and Winter to staging only, observed versioned published state, then restored original version `wav_default_1` through the authenticated Admin API. Final `/v1/appearance` and Admin state: DEFAULT, decorations off, hero `/images/1.png`, no draft. | Pass at API/state boundary; UI Restore click remains unverified |
| Seasonal storefront preview | Public static storefront used `?commerce-preview=staging` to read staging API. Winter and Christmas each applied `data-theme-preset` and loaded `/assets/theme-layers.css` exactly when enabled. Visual review showed distinct restrained art and legible hero at desktop/tablet; 390px phone kept content legible, hid nonessential artwork and had no horizontal overflow (`scrollWidth` 381). Tablet was 753/768px; desktop was 1265/1280px. After DEFAULT restore the optional layer was absent. | Pass for normal devices; Save-Data/≤2 GiB manual emulation still open |
| Inventory and orders | Admin Stock view loaded 146 tracked products and the Stocktake entry point; an existing unfinished staging session was observed but not changed. Business/Test order tabs loaded separately; Test queue was empty. | Read-only pass; write-flow regression open |
| Direct Website image uploads | Uploaded tracked `assets/sheep-icon.png` through the Appearance hero control and a Section image control. Both new staging R2 images rendered at 512px in their respective editor previews. Refreshed without saving; the published DEFAULT hero remains `/images/1.png` and Section override remains empty. Both temporary assets were archived, not deleted. | Pass for Appearance and Section direct upload; Product direct upload open |
| Staging recipient policy | Configured `STAGING_EMAIL_ALLOWLIST` as a **staging-only Worker secret** for the user-approved test mailbox on 30 September. Read-back confirmed the binding name exists; value was not read or committed. No mail has been sent yet. | Configuration pass; delivery acceptance open |

## Defect fix in source

`commerce/src/admin/shared-media.ts` now resolves static storefront-relative image paths for the shared image preview, while preserving Worker-owned `/media/...` URLs so staging uploads still load from staging R2. `commerce/src/admin/ui.ts` uses the same resolver for private Appearance preview. Stored image values and API payloads are unchanged. `commerce/test/admin-html-script.test.ts` checks static, Media, absolute and protocol-relative URLs and generated preview calls. TypeScript and all 77 files / 570 Commerce tests pass locally after both patches. Neither fix is in deployed `d3ce371`; re-run the guarded staging workflow on the final commit before browser rechecking.

Source commits [deffbab](https://github.com/Mo31D/Blacksheep/commit/deffbab467a9c963eefb6ce137a101d8535e8412) and [509d153](https://github.com/Mo31D/Blacksheep/commit/509d15316ef6ff35fdb4d990877eed38a0de6f63) are on `main`. For `509d153`, Commerce CI [36618633316](https://github.com/Mo31D/Blacksheep/actions/runs/36618633316), Search [36618633413](https://github.com/Mo31D/Blacksheep/actions/runs/36618633413) and Pages [36618632065](https://github.com/Mo31D/Blacksheep/actions/runs/36618632065) all succeeded. The staging Worker still runs `d3ce371` until a guarded redeploy.

The pre-existing active QA Media record `asset_45e015c7-977d-4a53-ac29-9d9a4759b30a` had zero tracked uses but its R2 key did not exist (`GET` returned key-not-found; prefix listing was empty), explaining its broken Admin thumbnail. It was archived in staging, not deleted. This is fixture drift, not evidence that new uploads fail. The new QA asset and Product were also archived after the test. No production data or Worker changed, and no email was sent.

## Still to accept

- Re-deploy the committed preview fix to staging through the guarded workflow, then verify hero image in the editor and Winter/Christmas private previews on desktop, tablet and phone.
- Exercise direct per-screen Product upload, Homepage controls, inventory/stocktake write flow, order/reservation and customer checkout with isolated test data. Appearance/Section direct uploads and shared Media upload/reuse passed. A Turnstile-dependent checkout fixture remains a prerequisite for the corresponding flow.
- Send only staging test mail to the approved test mailbox and verify the guard rejects all other recipients. Never send staging test mail to the production owner or real customers.
- Obtain time-bounded deployed usage evidence for historical `loader.js`, `.b64` and restore assets before Phase 6 deletion. Source absence is insufficient.
- The zone is on Cloudflare Free Website; the read-only `/logs/received` probe returned `1010 auth.forbidden`. Obtain equivalent request/reference telemetry through an authorized source before deleting historical paths.
- Production promotion remains unapproved and must not be performed.
