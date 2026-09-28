# Architecture decisions

## 2026-09-27 — Preserve the current stack and authority boundaries

**Decision:** Keep the static storefront, Commerce Worker and D1/R2. D1 owns operational commerce; Git main owns code and static publication. Static metadata is an export input where explicitly required, never a second checkout pricing source.

**Why:** Existing production workflows and tests already implement these boundaries. Rehabilitation should remove duplication without losing established behaviour or indexed URLs.

**Rejected alternative:** A new framework/app or shadow catalogue would create another migration and competing authority.

## 2026-09-27 — One HTTP image validation owner

**Decision:** `commerce/src/http/image-upload.ts` owns multipart/file/type/size/signature/hash validation for Product and shared-library uploads. Thin named readers retain metadata validation and existing error namespaces/precedence. Domain services continue to own storage associations and lifecycle.

**Why:** All upload entry points must enforce identical binary rules. This is a safe extraction independent of the higher-risk D1/R2 lifecycle migration.

**Rejected alternative:** Removing Product endpoints immediately or making every image a Product image would conflate transport validation with association/history semantics. Permanent parallel storage ownership is also not the target; retirement requires caller and migration proof.

## 2026-09-27 — Separate source verification from deployment evidence

**Decision:** Track local checks, Linux CI, staging acceptance and production promotion independently. Retain production clean Product routes disabled until a dedicated canonical/redirect migration.

**Why:** A public-feed version match does not prove rendered HTML, and a main push does not deploy the Worker.

**Rejected alternative:** Marking work production-complete solely from unit tests or an old release report hides environment drift.

## 2026-09-27 — Upload failure does not prove an unowned object

**Decision:** All upload compensation goes through `data/media-upload-cleanup.ts`. Delete a newly generated key only after successful reads find neither a Product media owner nor an active/archived library owner; Product history rows also retain ownership. Preserve the original error on cleanup failure.

**Why:** D1 may commit before a later read fails. Unconditional R2 deletion turns an HTTP failure into a broken persisted image. Ownership uncertainty must retain data.

**Rejected alternative:** A route-local success flag misses ambiguous database commits and would duplicate lifecycle policy. This helper is only for new-upload compensation, not a substitute for atomic claims when deleting existing assets.

## 2026-09-28 — Lock dependency resolution at CI and release boundaries

**Decision:** Primary Commerce CI and guarded deployment use `npm ci` and cache by the committed lockfile, matching local setup. Explicit pinned browser-only tooling remains a separate ephemeral step.

**Why:** Validation and release must use the same dependency graph; package/lock drift should fail rather than being silently reconciled during a release.

**Rejected alternative:** Fresh dependency resolution with `npm install` in the primary gates weakens reproducibility. A new build framework or composite workflow is unnecessary for this correction. Ancillary QA workflows can be aligned in a separate reviewed task.

## 2026-09-28 - Library ownership for every new upload

**Decision:** data/media-upload.ts is the sole new R2 image creation service. The library and retained Product upload/replace routes call it. Product media and version rows retain gallery placement/history ownership; library assets own new bytes and reusable identity. Old objects and URLs are not rewritten.

**Why:** Product replacement was an active caller creating a competing storage lifecycle. Keeping its transport but changing its persistence owner removes that duplication without changing the full editor or historical associations. Direct Product media references already participate in library usage/deletion checks.

**Rejected alternative:** Deleting the replacement endpoint breaks an active UI. Deleting a successfully created library asset when attachment fails destroys reusable content and can corrupt an ambiguously committed association. Retain it; independent library archive/delete remains the cleanup mechanism.

## 2026-09-28 - Check asset availability inside the Product write

**Decision:** Product add/replace performs the shared asset availability check in the initial optimistic UPDATE of its D1 batch. Archived/deleted assets and any deletion job block the batch's token-gated mutations. Legacy Product keys without a library row remain supported.

**Why:** A prior HTTP/domain read can race with archive/delete. The deletion side already checks Product/history references atomically; both write directions must participate for protection to hold.

**Rejected alternative:** Another preflight lookup or best-effort reference insert after attachment cannot prevent an image deletion already claimed before the Product write. No new lock table/schema is needed.

## 2026-09-28 - Guard newly used content images, retain historical references

**Decision:** shared-media-attachment.ts owns the SQL availability predicates for Product keys and content URL sets. Section create/update and Appearance draft saves apply them in the first D1 batch write. Subsequent version/audit writes require that owner write to succeed.

**Why:** Preflight reads cannot stop a concurrent deletion claim. Only newly selected URLs need ACTIVE assets: old version references already protect archived images, so ordinary text edits must remain possible. One JSON binding covers Appearance image maps without per-image query loops.

**Rejected alternative:** Requiring every retained image to be ACTIVE breaks edits to historical content; post-save reference registration is too late to stop deletion. Separate content and audit commits would permit partial saves.
