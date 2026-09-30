# Session handoff — 30 September 2026

Repository `Mo31D/Blacksheep`, existing `main` only. Always fetch remote `main` first; this workstation's local `.git` index/ref is stale and cannot write `.git/index.lock`. Use fast-forward-only GitHub ref updates if Git remains restricted. No Production deployment or Production business-data change without explicit owner approval.

## Current phase and task

Phase 8 Admin productization continues. The owner clarified a six-root Storefront hierarchy: Local Treats (Romney's and Hawkshead Relish, each retaining its children), Lake District Souvenirs, Peter Rabbit Gifts, Highland Cows Ornaments, Ice cream, Christmas. This overrides the earlier two-level assumption. The stable-node Section level implementation `9bb2d7e` was reviewed as a useful first step; staging-applied migration `0028` is immutable.

**Current candidate, not yet staging-accepted:** forward migration `0029_local_treats_three_level_structure.sql`, guarded three-level validation, nested Admin Section tree and Product placement picker, recursive public collection traversal and ancestor trail. Existing node IDs, Product placements, inventory, slugs and legacy URLs remain intact. Migration clones published versions and aligns hierarchy fields on any owner draft while retaining its other content. Local TypeScript, generated Admin syntax, dynamic storefront contract, 81 files / 581 Vitest tests, and Python SQLite checks with foreign keys/draft/placement assertions passed. Windows workerd cannot launch the Wrangler local D1 upgrade test; Linux Commerce CI is required.

**Next action:** commit the candidate and trigger the guarded Staging workflow; inspect Commerce CI and staging migration/deploy. Then verify published API/navigation has exactly six roots, Local Treats → Romney's/Hawkshead → original children, collection pages/Products, legacy routes/canonicals/sitemap, and Admin controls without altering owner drafts. Update `ADMIN-V2-CHECKLIST.md`, `ARCHITECTURE-REHABILITATION-CHECKLIST.md`, this handoff and audit with exact commit/run/browser evidence. Continue remaining Phase 8 slices in order.

## Reviewed out-of-band changes

- `9054469`, `4d1453b`: `SameSite=Lax` Admin cookie and regression test; `Secure` and `HttpOnly` retained. Physical iPhone/Safari return check still open.
- `9bb2d7e`: first Section level selector; was leaf-only/two-level. Extend it, do not revert it.
- `29b9950`, `2a6fe3c`, `90981ab`: staging-applied Peter Rabbit promotion migration `0028` and test updates. Do not rewrite `0028`.
- `43703f1`: corrected guarded Staging deploy [36699343936](https://github.com/Mo31D/Blacksheep/actions/runs/36699343936) passed; Production unchanged.

## Other open work and constraints

- Slice A navigation accepted; Slice B.1 all five Homepage modules reorder accepted. Slice B.2 Homepage destination cards passed CI [36690358702](https://github.com/Mo31D/Blacksheep/actions/runs/36690358702) and guarded staging [36691299996](https://github.com/Mo31D/Blacksheep/actions/runs/36691299996). Read-only staging Admin recheck on 30 September showed all three local image previews loaded at natural widths 1400/1400/1600px; B.2 closed. Existing Staging Homepage draft belongs to an unknown owner: do not Save, Preview (which saves), Publish or Restore as QA.
- Subsequent Phase 8: contextual Homepage editor, Shared Media usage/duplicate handling, named destination picker, statuses/unsaved feedback, mobile/visual acceptance. Preserve canonical domain owners and Shared Media.
- Phase 7 staging Stocktake/reservation writes, checkout/Turnstile and physical weak-device checks remain open. CAPTCHA needs action-time approval. A properly transparent export of the detailed sheep artwork is required before replacing opaque tracked PNGs. Legacy asset deletion remains blocked on external-consumer evidence.
- User-approved test mailbox is configured as a staging-only allowlist secret; no value in repository. Prior staging email reached Resend `DELIVERED`; inbox UI unverified. See `STAGING-ACCEPTANCE-2026-09-29.md`.
