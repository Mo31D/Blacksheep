# Media caller and failure-boundary audit

29 September 2026; main 048432e. Source-only continuation of the open caller audit; existing storage/ownership fixes are retained.

| Consumer | Transport / owner | Status |
| --- | --- | --- |
| Admin Product add | ui.ts shared upload POST /admin/api/media, then POST /admin/api/products/:id/media/from-library | Current ordinary upload and existing-library selection both use library-owned bytes and versioned Product association. |
| Admin Product replace | ui.ts POST /admin/api/products/:id/media/:mediaId/replace multipart | Active. Preserve position, primary, alt and fit/history semantics. Do not retire. |
| Product multipart add | POST /admin/api/products/:id/media in routes/admin.ts | No active UI add call found, but route contract/regression consumers remain; deployed/external callers unknown. Retain transport while it delegates storage to the shared service. |
| Website Media / Section / Homepage / Appearance | ui.ts shared upload helper and existing content association saves | Shared library upload, content owners retain draft/version references. |
| Staging QA | scripts/staging-admin-browser-qa.mjs plus commerce-staging-admin-browser-qa.yml | Browser-driven upload, reuse, archive and guarded deletion; script mutates staging fixtures and was not executed in this audit. |
| Automated route/domain tests | admin-products-readonly, media-upload-cleanup, media-upload, shared-media-ownership/delete-claim and product-media-coexistence | Contract/failure coverage retained and rerun: six files / 39 tests PASS. |

Repository search covered commerce/src, commerce/test, commerce/scripts, root scripts and .github (including endpoint fragments and storage writes). No additional upload implementation was found. This is not evidence about remote clients or deployed Worker version.

## Failure ownership

All three HTTP upload adapters call data/media-upload.ts uploadSharedMediaImage. It alone writes new R2 bytes and creates the library owner. A library write failure delegates compensation to media-upload-cleanup.ts: delete only after both Product and library ownership checks prove absence; preserve objects on uncertain reads/commits and preserve the original error.

Product association happens after library creation. Failed association or response reload therefore retains a reusable asset. Existing tests cover both add and replacement at before-commit, after-commit, unknown-read, attachment, response-reload and success boundaries. Product attachment/archive guards already have real-schema coverage; no duplicate implementation was added here.

Old-object deletion is a different operation: product-media.ts computes deletion eligibility from remaining references and library ownership; routes/admin.ts applies that result. Shared-library deletion uses its claim/reference workflow. Never reuse new-upload compensation to delete an existing object. Historical objects/URLs remain intact.

## Retention and external acceptance

Retain multipart Product replacement because the current UI depends on it. Retain multipart add pending proof about deployed/external consumers. Both adapters already share one byte-storage owner; retention does not recreate a competing persistence service.

MANUAL ACTION REQUIRED: before any transport retirement, verify deployed candidate SHA and relevant external/client usage, then accept Product/Section/Homepage/Appearance upload/reuse on staging across mobile/tablet/desktop. No Worker deployment, staging fixture mutation or production data mutation occurred. Source route extraction may proceed independently while preserving all transports and contracts.
