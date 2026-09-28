# Architecture rehabilitation plan

Baseline: `1d08f3b`, 27 September 2026. Preserve the existing HTML/JavaScript storefront, TypeScript Worker, D1/R2, Resend and main-only workflow. The earlier CARD 00–14 programme is marked closed in its board; do not restart it from stale handoff paragraphs.

## Current state

The application already has domain/data modules, versioned content, D1 commerce authority, a shared media library and extensive regression tooling. Its largest remaining coupling is concentrated in the Admin route/UI files, static-versus-live publishing, legacy metadata projections and historical media lifecycle data. New image storage is now shared. See `ARCHITECTURE-MAP.md` for ownership and data flow.

## Problems found

| Group | Finding / action |
| --- | --- |
| Critical | Confirmed Product upload/replace error paths deleted R2 objects even after a successful D1 save followed by response-reload failure. Reproduced in regression tests and fixed by shared ownership-aware upload compensation. No evidence of actual production loss was collected. Inventory replay could also report another variant as successful after a competing key committed; shared identity validation fixes this proven race. Bulk unchanged-count version bypass is also fixed without adding movements for valid no-ops. Same-attempt Stocktake partial-commit recovery now uses verified ledger receipts. Simultaneous session edits/cancellation and stock/order concurrency remain priority audit areas. |
| Structural | Large `routes/admin.ts` and `admin/ui.ts` mix many business objects. Extract responsibilities incrementally behind existing contracts; do not replace the Admin. |
| Duplication | Image validation and new asset storage now have shared owners with contract/failure tests. Retained Product endpoints are association adapters, not competing storage creators. Product attachment/deletion is now guarded atomically and tested against the real SQLite schema. Section/Appearance URL writes now share atomic availability guards and real-schema race coverage. Historical objects remain a separate migration decision. |
| Admin UX | Recent main already removes URL-first ordinary image controls, duplicate search/product operations and duplicate bulk Stocktake. Preserve these. Audit full/quick edit semantics and accessible feedback next. |
| Data ownership | Resolved destructive UI projection: maker text and shop Brand/Range classification are distinct, confirmed by read-only production/staging audit. Preserve independent owners; no data migration. Specialist provenance/static metadata is still required by export. |
| Backend/API | Repeated JSON/error adapters and domain-specific catch blocks; do not blindly merge error semantics. Extract by responsibility after tests. |
| Storefront | Runtime reconciliation coexists with static fallback/indexable output. Catalogue/API success does not prove static publication. Preserve canonical URLs and deliberately disabled production clean Product routes. |
| Infrastructure | Source config explicitly separates D1/R2, but deployed secrets/kept variables require read-only verification. Local Windows checkout fails on historical `Con.png`; sparse exclusion preserves the tracked asset. |
| Maintainability | Session handoff contains mutually inconsistent historical next tasks and production states. Replace it with concise current memory and retain dated release reports/history as evidence. |
| Cleanup | Encoded recovery assets and old scripts need runtime, generator, workflow and deployed-reference checks before deletion. Supplier sync can rewrite catalogue; determine whether to retire or integrate it. |

## Target architecture

Keep one Worker composition root, HTTP adapters per business object, existing domain/data owners, one HTTP image validator and one eventual asset lifecycle service. Product content/version ownership stays distinct from operational inventory. Shared Media Library owns new uploaded assets; Product/Website entities own references and placement. Admin homes follow business objects. Public contracts project D1 state; static outputs are reproducible publication artifacts. Provider integration stays behind notification adapters. Environment differences remain explicit configuration, not hostname-dependent business logic.

## Incremental migration

1. Record current ownership and release boundaries; add contract coverage before changing a flow.
2. Centralize identical image input validation without changing endpoints, responses, storage or publication.
3. Audit media callers and ambiguous-commit paths; migrate Product-specific storage only with association/history and retry proof, then remove superseded endpoints.
4. Preserve the audited maker/classification distinction (BRAND-OWNERSHIP-AUDIT.md); audit stock writers next. Data migrations require staging comparison and rollback evidence.
5. Extract Admin route/UI responsibilities one business object at a time; preserve generated-script tests and browser contracts.
6. Verify static publication determinism and snapshot/live parity; retire legacy generators/assets only after dependency proof.
7. Run complete CI, staging integration/browser checks and explicit guarded production promotion. Record each evidence level separately.

Each implementation commit updates the checklist and handoff. Fetch remote main before commits/pushes; use fast-forward integration and never force-push. Do not mix data migrations, endpoint retirement and visual changes in one commit. Rollback code through a normal forward revert; never reset the application to an older snapshot or roll back business data blindly.
