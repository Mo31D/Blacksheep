# Session handoff

Updated 28 September 2026. Repository `Mo31D/Blacksheep`, existing `main` only.

## Current phase

Architecture rehabilitation: discovery and shared image validation complete; media failure-safety fix validated locally. Read the rehabilitation checklist/map/plan/decisions. Earlier CARD 00–14 board is closed historical evidence, not the active queue.

## Last completed / current task

- Published `f6f6ff6` architecture docs and `ed48978` image validation extraction. Linux Commerce CI `36344781535` SUCCESS including full check and browser archive regression. Search Readiness `36344781570` and Pages `36344781456` SUCCESS.
- Reproduced four destructive Product upload/replace cases: D1 saved an image but later response reload failed, or ownership became uncertain; old catch blocks still deleted R2 bytes.
- New `data/media-upload-cleanup.ts` centralizes compensation across all three upload routes. Delete only after successful ownership reads find no Product/history or library owner. Existing-asset deletion still uses normal reference/claim rules.
- Current task: publish `fix: preserve owned media after upload failures`, confirm its own Linux CI, then continue caller/lifecycle audit.

## Next recommended task

Audit Product-specific media endpoint callers in UI, scripts and deployed integrations before lifecycle consolidation. Existing successful add/replace and historic public URLs must survive. Then inspect backend Brand/Range projection before attempting data migration.

## Decisions / risks

- D1 owns operational commerce; main owns code/static outputs. Preserve storefront design, indexed Product URLs, versioned publication and stock/reservation concurrency.
- Shared input validation and failed-upload cleanup now have single owners. Product-specific creation/replacement storage paths still exist pending migration proof.
- Uncertain ownership retains data; possible orphan cleanup is preferable to corrupting persisted associations.
- No Worker deployment, remote D1/R2 mutation or synthetic email was performed. Automatic Pages build on main is separate from Worker deployment.
- Production clean Product routes stay disabled. Source config does not prove deployed secrets/settings.

## Validation

Latest fix: TypeScript PASS, 57 Vitest files / 339 tests PASS. New regression tests first reproduced four failures before the fix. First extraction's full Linux CI is green; the cleanup fix requires its own CI result.

Local Windows workerd fails during D1 startup even outside the sandbox. Initial static/search gates and Worker dry-run passed. Use Linux CI for complete migration/inventory/runtime checks; do not claim local full-check success.

## MANUAL ACTION REQUIRED

Production promotion remains a guarded release after staging acceptance. No new secret or schema change is needed. Local runtime repair is independent of application work.

## Git / workstation notes

- Baseline `1d08f3b`; published commits `f6f6ff6`, `ed48978`. GitHub connector published identical trees after local credential manager stalled; local main reconciled without a force update/new branch.
- Windows sparse checkout excludes only historical `images/romneys/Con.png`; preserve it in Git.
- HTTPS Git needs bundled `GIT_EXEC_PATH` at `mingw64/bin`. Filesystem is now read-only; use explicit tool escalation for local writes.
- Historical long handoff remains at `1d08f3b:docs/SESSION-HANDOFF.md` and dated release reports.
