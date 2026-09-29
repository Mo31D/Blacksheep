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

## Defect fix in source

`commerce/src/admin/shared-media.ts` now resolves storefront-relative image paths for the shared image preview; `commerce/src/admin/ui.ts` uses the same resolver for private Appearance preview. Stored image values and API payloads are unchanged. `commerce/test/admin-html-script.test.ts` checks relative, absolute and protocol-relative URLs and generated preview calls. TypeScript and all 77 files / 570 Commerce tests pass locally. This fix is **not** in deployed `d3ce371`; re-run the guarded staging workflow on its new commit before browser rechecking.

## Still to accept

- Re-deploy the committed preview fix to staging through the guarded workflow, then verify hero image in the editor and Winter/Christmas private previews on desktop, tablet and phone.
- Exercise test-only Product upload/reuse, Sections, Homepage, Appearance image workflows, inventory/stocktake, order/reservation and storefront theme behaviour. Record cleanup and route/network evidence. Do not write production business data.
- Choose an approved staging test mailbox and configure `STAGING_EMAIL_ALLOWLIST` only in the staging Worker before email QA. Never send staging test mail to the production owner or real customers.
- Obtain time-bounded deployed usage evidence for historical `loader.js`, `.b64` and restore assets before Phase 6 deletion. Source absence is insufficient.
- Production promotion remains unapproved and must not be performed.
