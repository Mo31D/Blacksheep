# Black Sheep — Phase 3 Product Media Readiness

**Date:** 25 September 2026  
**Environment target:** Staging only  
**Status:** CORE MEDIA CODE COMPLETE / RELEASE BLOCKED BY ACCOUNT-LEVEL R2 ACTIVATION

---

## Current blocker

Cloudflare R2 Object Storage is not enabled on the connected account.

Direct Cloudflare API result:

`10042 — Please enable R2 through the Cloudflare Dashboard.`

This is an account-level service activation requirement, not a repository or Worker-code error.

No alternate storage architecture has been substituted.

---

## Phase 2 closure completed in this session

Duplicate and Archive are now implemented and deployed to staging.

### Duplicate
Creates a new safe private Draft:
- new Product UUID,
- new unique slug,
- copied descriptive content/categories/media metadata/attributes,
- copied price,
- SKU cleared,
- barcode cleared,
- online ordering disabled,
- selling status set to NOT_FOR_SALE,
- inventory tracking remains off,
- audit event PRODUCT_DUPLICATED.

### Archive
Non-destructive:
- publication status ARCHIVED,
- selling status NOT_FOR_SALE,
- online ordering disabled,
- archived_at recorded,
- Product data/history retained,
- audit event PRODUCT_ARCHIVED.

Archived products are excluded from normal Product list/metrics and remain accessible through the dedicated Archived filter.

### Phase 2 staging evidence
- release commit: `397023d41be4afdadf859e6554302eee879abf87`
- workflow: Product Editor Staging Phase 2
- run: `36174114456`
- job: `108200446776`
- result: SUCCESS
- current staging deployment: `7984e631-902e-470b-bb0f-447bdb031b3b`
- current staging Worker version: `cdcfe773-b6cc-4910-8c86-a74f28bde66c`

Post-release safety check:
- staging products: 146
- original PRODUCT_IMPORTED events: 146
- tracked inventory variants: 0
- Production migrations: 0000–0008
- Production orders: 3

---

## Phase 3 code implemented

### Storage architecture
- private R2 bucket binding planned as `PRODUCT_MEDIA`,
- staging bucket name: `black-sheep-product-media-staging`,
- R2 binding exists in staging configuration only,
- no Production R2 binding has been added.

### Secure image upload
Authenticated route:

`POST /admin/api/products/:id/media`

Properties:
- Admin authentication required,
- same-origin write protection,
- multipart form upload,
- maximum file size 8 MB,
- JPEG / PNG / WebP only,
- magic-byte/signature verification,
- SHA-256 checksum,
- immutable media ID,
- deterministic R2 object path,
- upload rollback if D1 attachment fails,
- archived products rejected.

### Draft semantics
Media changes automatically create/use a Product content Draft.

This keeps Product imagery aligned with the existing Draft → Publish content model.

### Gallery management
Premium Admin Media Manager supports:
- upload from file picker/iPhone Photos/camera path,
- gallery thumbnails,
- first image automatically Primary,
- Make Primary,
- alt text,
- reorder with up/down controls,
- **one-click Replace** while preserving gallery position / Primary state / alt text,
- remove from Draft,
- audit history.

Published-version references are preserved when an image is removed from a Draft.

### R2 object safety
A physical R2 object is only eligible for deletion when no active Product Media row still references its storage key.

This is important because duplicated products can intentionally reuse an existing media object.

### Image delivery
Same-origin public media route:

`GET /media/:mediaId`

The route:
- resolves media through D1,
- reads the private R2 object,
- sends immutable cache headers,
- sends `nosniff`,
- uses SHA-256 as ETag when available,
- does not expose the bucket itself.

---

## Validation

Latest complete Media code validation:

- Commerce CI run: `36176490850` — SUCCESS
- Search readiness: SUCCESS
- Pages build/deployment checks: SUCCESS

Coverage includes:
- Product Media Admin UI hooks,
- valid PNG upload,
- invalid declared-type/signature rejection,
- immutable media delivery,
- one-click image replacement,
- explicit Legacy repository + R2 gallery coexistence,
- R2-unbound failure behavior,
- existing Commerce regressions,
- TypeScript,
- Worker dry-run.

A dedicated release workflow now exists:

`.github/workflows/product-media-staging.yml`

It will refuse deployment unless:
- R2 API is enabled,
- the exact staging bucket exists,
- full Commerce validation passes,
- imported Product Core baseline remains intact,
- tracked inventory remains 0.

---

## Not deployed yet

The Phase 3 Worker source has **not** been released to staging because the required R2 bucket cannot currently be created.

This is deliberate. The release gate prevents a partially configured Media UI from being treated as live.

---

## Exact next action

In the Cloudflare Dashboard, enable **R2 Object Storage** for the account.

After R2 is enabled, the remaining work can continue programmatically:

1. Create `black-sheep-product-media-staging` in Western Europe.
2. Confirm `PRODUCT_MEDIA` staging binding.
3. Trigger Product Media Staging Phase 3.
4. Verify health and media route.
5. Perform one controlled iPhone upload.
6. Verify Primary / reorder / alt text / remove.
7. Verify legacy-image + R2 coexistence.
8. Verify the already-implemented one-click Replace flow on real R2.

Production remains untouched.
