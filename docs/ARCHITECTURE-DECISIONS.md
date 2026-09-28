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
