# Platform completion and code review — 27 September 2026

Baseline: `679b130ba921eb42b1f99385a4dfd6d1b9df6ca8` on `main`.

## Verification ledger

- [x] Read current implementation cards and release handoff.
- [x] Recheck D1 after reset: staging queries and password sign-in work. Latest applied staging migration is 0022; 0023 remains pending.
- [x] Diagnose legacy archive bug: Production contains 139 active and 13 archived products. Original design products remained in the static catalogue because missing live records were skipped.
- [x] Implement atomic published-catalogue reconciliation, including original cards and old detail URLs; validate pagination before applying any removals.
- [x] Cover archived legacy products, newly added products, empty catalogues, partial failures and invalid pagination with regression tests.
- [ ] Pass candidate Chromium/WebKit archive checks in Linux CI, then verify deployed Production behaviour.
- [x] Pass 292 unit/browser-script tests across 51 files.
- [x] Pass TypeScript, dynamic storefront contracts and JavaScript syntax checks. Search Readiness passes (146 static products, 17 pages, 166 sitemap URLs).
- [ ] Pass full Commerce checks in Linux CI. Local Windows workerd crashes during local D1 startup; source/unit checks run separately.
- [x] Repair login feedback and cover browser `window.status` behaviour.
- [ ] Review shared-media lifecycle, history preservation and cleanup failure handling.
- [ ] Unify publish verification across Products, Structure, Homepage and Appearance.
- [ ] Review Admin navigation, focus, errors and owner-facing states.
- [ ] Review URL/SEO migration requirements against the current static hosting boundary.
- [ ] Complete staging browser and integration gates after D1 access resumes.
- [ ] Complete guarded Production QA and record deployed versions.

No card is complete merely because its code is present. Record source checks, local runtime checks, staging evidence and Production evidence separately. The implementation-card board remains the programme checklist.

## Environment notes

The repository contains `images/romneys/Con.png`, a Windows-reserved filename. The local sparse checkout excludes that historical asset; it is preserved on GitHub. Verify active asset references through Search Readiness.

## Review findings

Implemented in the current candidate:

- Static and newly added products now use one published-catalogue membership decision. Missing original cards are removed only after every catalogue page validates. An intentionally empty catalogue is accepted. Archived static detail pages show an unavailable notice and no purchase controls.
- The public feed remains the authority; an API outage retains the static fallback. Static HTML/sitemap publication remains a separate CARD 12 requirement, so this runtime fix alone does not retire indexed URLs at the server.
- Admin login feedback no longer collides with the browser's `window.status` property.
- Shared media ownership checks retain objects if D1 is unavailable; uncertainty must not permit destructive cleanup.
- One public-version verification helper now serves Product, Structure, Homepage and Appearance. It distinguishes staging evidence from Production evidence and does not claim rendered-site verification from an API response alone.
- Zero VAT values are preserved when displaying/editing product costs.

Open review findings, in priority order:

- CARD 11: permanent media deletion still needs an atomic database claim before R2 deletion, plus a retry path; upload cleanup must not delete an object after an ambiguous database commit.
- Product card/detail template interpolation needs consistent escaping of Admin-authored text.
- CARD 10 staging/browser acceptance, CARD 12 static publication/SEO, CARD 13 Admin simplicity, CARD 14 Production release remain open.

No Production database writes, product edits or Worker deployments were used to diagnose the archive issue. Production counts are a read-only observation on 27 September 2026, not a hard-coded catalogue expectation.
