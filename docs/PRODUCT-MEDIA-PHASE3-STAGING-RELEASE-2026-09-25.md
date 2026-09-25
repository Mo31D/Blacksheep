# Black Sheep — Phase 3 Product Media Staging Release

**Date:** 25 September 2026  
**Environment:** Staging only  
**Status:** **DEPLOYED — owner iPhone smoke-test pending**  
**Production cutover:** NOT PERFORMED

---

## 1. Release result

Cloudflare R2 was enabled and the isolated staging bucket was created successfully:

- bucket: `black-sheep-product-media-staging`
- region/location: `WEUR`
- storage class: `Standard`
- Production has no Product Media R2 binding.

Gated release:

- workflow: `Product Media Staging Phase 3`
- run: `36178631127`
- job: `108215277892`
- conclusion: **SUCCESS**
- release commit: `bbbe4157848d4104cf03dcbb447e29516b03cc68`
- staging Worker deployment: `119d4ceb-2678-40ce-9b43-4c2ede7b3523`
- staging Worker version: `19e62702-1fde-48b1-802f-6dbf66e68eb3`
- Worker version number: `68`

Every workflow gate passed:
- full Commerce validation,
- R2 enabled/bucket existence,
- staging Product Core schema,
- imported baseline guard,
- inventory-tracking guard,
- staging Worker deploy,
- staging Worker health,
- real `/media` route availability,
- Admin sign-in shell.

---

## 2. Product Media capabilities now live on staging

The Product Admin now supports:

- **Manage images** from Product detail,
- iPhone Photos / camera-compatible file picker,
- JPEG / PNG / WebP uploads,
- maximum 8 MB,
- magic-byte/signature validation,
- SHA-256 checksum,
- private R2 storage,
- same-origin delivery through `/media/:mediaId`,
- Draft-based gallery changes,
- automatic Primary image for the first upload,
- Make Primary,
- gallery reorder,
- editable alt text,
- non-destructive remove,
- **one-click Replace** preserving gallery position / Primary state / alt text,
- safe R2 cleanup,
- Product Media audit history.

Media content edits follow the existing Product Draft → Publish model.

---

## 3. Security and data integrity

Upload/write routes require the authenticated Admin session and same-origin protection.

The upload route validates:
- multipart form request,
- maximum size,
- MIME allow-list,
- actual file signature,
- Product version,
- archived-product state.

Media IDs are immutable.

R2 object keys are separate from public delivery URLs. The bucket is not directly exposed as the public product-image URL.

If D1 attachment fails after an upload, the route attempts R2 rollback.

Removing/replacing an image does not delete an R2 object while another active Product Media row still references the same storage key.

---

## 4. Legacy + R2 coexistence proven

The existing catalogue still has:

- **136 live `LEGACY_REPO` media records**

A reversible real-R2 integration test was performed after the release:

1. a temporary object was written to the staging R2 bucket,
2. a temporary R2 Product Media record was inserted into staging D1,
3. the deployed Worker served that object through `/media/med_phase3_smoke_delivery`,
4. GitHub Action run `36178979258` received **HTTP 200** and non-empty response bytes,
5. the temporary D1 row was deleted,
6. the temporary R2 object was deleted,
7. the temporary smoke workflow was removed.

This proves repository-backed legacy images and R2-backed managed media can coexist during the transition.

Final cleanup verification:
- live R2 media rows: **0**
- live legacy media rows: **136**
- staging R2 bucket object list: **empty**

No test residue remains.

---

## 5. Staging Product Core state after release

Direct post-release verification:

- products: **146**
- original PRODUCT_IMPORTED baseline: **146**
- inventory-tracked variants: **0**
- Product Core remains staging-only.

No real product image was injected by the automated smoke test.

---

## 6. Production safety

Production remains unchanged:

- migration count: **9 migrations total, latest `0008_concurrency_guards.sql`**
- Product Core migration `0009`: **NOT APPLIED**
- Production orders: **3**
- no Production `PRODUCT_MEDIA` R2 binding,
- no Production Product Media rollout,
- no inventory tracking,
- no storefront/checkout Product Core cutover.

---

## 7. Source validation

The Media source had already passed complete Commerce CI after:
- one-click Replace,
- Legacy/R2 coexistence hardening,
- Admin Media Manager,
- upload validation,
- immutable delivery route.

The release workflow then reran the full Commerce validation before deployment.

Relevant earlier source validation:
- Commerce CI `36176490850`: SUCCESS.

Release workflow:
- `36178631127`: SUCCESS.

Real delivery smoke:
- `36178979258`: SUCCESS.

---

## 8. Remaining sign-off

Only one Phase 3 gate requires the real owner session/device:

**authenticated iPhone Media Manager smoke-test**

Recommended safe test:
1. create `STAGING QA PRODUCT`,
2. upload from iPhone Photos/camera,
3. add a second image if available,
4. change Primary,
5. reorder,
6. edit alt text,
7. Replace one image,
8. Remove one image,
9. inspect Audit history,
10. Publish in staging Product Core,
11. Archive the temporary product.

After that test succeeds, Phase 2 owner mutation QA and Phase 3 iPhone QA can both be signed off and **Phase 4 — Inventory Core** can begin.
