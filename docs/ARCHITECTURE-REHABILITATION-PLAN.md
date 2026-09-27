# Architecture rehabilitation plan

Baseline: `1d08f3b`, 27 September 2026. Preserve the existing HTML/JavaScript storefront, TypeScript Worker, D1/R2, Resend and main-only workflow. The earlier CARD 00–14 programme is marked closed in its board; do not restart it from stale handoff paragraphs.

## Current state

The application already has domain/data modules, versioned content, D1 commerce authority, a shared media library and extensive regression tooling. Its largest remaining coupling is concentrated in the Admin route/UI files, static-versus-live publishing, legacy metadata projections and parallel media lifecycle paths. See `ARCHITECTURE-MAP.md` for ownership and data flow.

## Problems found

| Group | Finding / action |
| --- | --- |
| Critical | No newly proven production corruption in this source review. Media D1/R2 partial failure and stock/order concurrency remain highest-risk review areas; preserve existing ownership/claim and concurrency tests. |
| Structural | Large `routes/admin.ts` and `admin/ui.ts` mix many business objects. Extract responsibilities incrementally behind existing contracts; do not replace the Admin. |
| Duplication | Product and shared-library HTTP upload readers duplicate validation and hashing. Centralize first with contract tests. Product-specific storage endpoints still require a caller/lifecycle audit. |
| Admin UX | Recent main already removes URL-first ordinary image controls, duplicate search/product operations and duplicate bulk Stocktake. Preserve these. Audit full/quick edit semantics and accessible feedback next. |
| Data ownership | Brand text remains backend-writable independently of category relationships despite unified UI. Specialist provenance/static metadata is still required by export. Define field-level projection rules before migration. |
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
4. Define authoritative brand/classification projections and all write paths; migrate data only with staging comparison and rollback evidence.
5. Extract Admin route/UI responsibilities one business object at a time; preserve generated-script tests and browser contracts.
6. Verify static publication determinism and snapshot/live parity; retire legacy generators/assets only after dependency proof.
7. Run complete CI, staging integration/browser checks and explicit guarded production promotion. Record each evidence level separately.

Each implementation commit updates the checklist and handoff. Fetch remote main before commits/pushes; use fast-forward integration and never force-push. Do not mix data migrations, endpoint retirement and visual changes in one commit. Rollback code through a normal forward revert; never reset the application to an older snapshot or roll back business data blindly.
