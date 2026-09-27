# Session handoff

Updated 27 September 2026. Repository `Mo31D/Blacksheep`, existing `main` only.

## Current phase

Architecture rehabilitation: discovery documented; shared HTTP image validation implemented and source-tested. This new programme continues the existing application. The previous CARD 00–14 board is marked closed; old dated reports remain release evidence, not the current next-task queue.

## Last completed / current task

- Baseline fetched: `1d08f3b`. Recent shared upload UX, single Stocktake and Product editing fixes preserved.
- Created architecture map, rehabilitation plan/checklist and decisions.
- Extracted duplicated image validation from Admin routes into `commerce/src/http/image-upload.ts`; existing endpoints/error contracts remain intact.
- Current task: finish validation evidence and commit/push the documentation and implementation on main.

## Next recommended task

Read `ARCHITECTURE-REHABILITATION-CHECKLIST.md`. First confirm Linux CI for this batch, then audit Product-specific upload/replace lifecycle and callers before consolidating R2 creation into Shared Media Library. Backend brand/classification projection is the next independent ownership task.

## Decisions / risks

- D1 owns operational commerce; main owns code/static outputs. No framework change or parallel application.
- Shared HTTP validation is complete; shared storage lifecycle consolidation is not. Product-specific endpoints still exist intentionally pending caller/history proof.
- Preserve versioned publication, media history, stock/reservation concurrency and existing static Product URLs. Production clean Product routes remain disabled.
- Source config is not proof of deployed configuration. No Worker deployment, remote D1/R2 mutation or synthetic email was performed here.
- Historical details from the former long handoff remain in Git at `1d08f3b:docs/SESSION-HANDOFF.md`; dated release reports and the completed platform board remain in docs.

## Validation

TypeScript and all 56 Vitest files / 330 tests PASS. Static/search and pre-migration check gates PASS (146 static products, 166 sitemap URLs). Full check stopped at local D1: Windows workerd access violation/stack overflow, plus initial sandbox log permissions. Elevated retry reproduced the runtime crash. Admin browser QA script syntax and staging Worker bundle dry-run PASS. Linux CI is required before claiming full readiness.

## MANUAL ACTION REQUIRED

Use existing Linux CI if Windows workerd remains unusable. Production promotion remains a separate guarded release after staging acceptance. No secret creation is required for this extraction.

## Git / workstation notes

- Starting commit: `1d08f3b`; batch titles are recorded in the rehabilitation checklist.
- Fresh Windows checkout excludes only `images/romneys/Con.png` through local sparse-checkout because it is a reserved Windows filename. The asset is preserved in Git; never stage its deletion.
- Bundled Git needs `GIT_EXEC_PATH` pointing at its `mingw64/bin` directory for HTTPS. Sandbox Git metadata/network writes require the provided approval mechanism.
