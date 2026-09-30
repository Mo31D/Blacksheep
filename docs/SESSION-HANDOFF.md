# Session handoff

## OWNER OVERRIDE — 30 September 2026 — READ BEFORE CONTINUING

The owner clarified both the final hierarchy and the intended purpose of the out-of-band **Section level** edit. **Do not continue from the assumption that Peter Rabbit alone should become a new root, and do not treat the current two-level re-parenting UI as complete.**

### Why the previous edit was made

Commit `9bb2d7e` was intended to make hierarchy changes operate on the existing canonical Storefront node rather than forcing the owner to move Products manually. The desired invariant is:

`move/re-parent Section → stable node ID remains → Products/inventory/placements remain attached`.

The implementation achieved that invariant for a **leaf** section, which is why Peter Rabbit could be promoted from a Gifts child to a root without touching its 29 Product placements.

However, the first UI/data-layer implementation only supports two levels. A node that already has children is not offered parent destinations, and the data layer rejects nesting beneath an existing child. That limitation now blocks the real requirement: moving Romney's and Hawkshead Relish beneath Local Treats while retaining their own children.

### Changes made outside the Codex workstream

- `9054469`: Admin cookie `SameSite=Strict` → `SameSite=Lax` to preserve the authenticated session when the owner opens the public website and returns to Admin in Safari; `Secure` + `HttpOnly` retained.
- `4d1453b`: regression test for the session-cookie policy.
- `9bb2d7e`: first implementation of Admin Section re-parenting without moving Products; currently limited to a two-level hierarchy.
- `29b9950`: migration 0028 promoted the existing Peter Rabbit node from Gifts child to root; Product placements remained attached to the same stable node ID.
- `2a6fe3c`, `90981ab`: migration test/invariant updates.
- `43703f1`: corrected guarded Staging deploy; full validation + migration + Worker health succeeded. Production unchanged.

### Owner's exact final structure

There must be exactly six top-level Storefront/menu entries:

1. **Local Treats**
   - **Romney's**
     - preserve Romney's existing children (Mint Cake, Fudge, Biscuits, Sweets, Gift Boxes, etc.)
   - **Hawkshead Relish**
     - preserve Hawkshead's existing children (Chutneys & Pickles, Jams & Preserves, Honey, Mustard, Savoury Sauces, etc.)
2. **Lake District Souvenirs**
3. **Peter Rabbit Gifts**
4. **Highland Cows Ornaments**
5. **Ice cream**
6. **Christmas**

The required model therefore needs **at least three levels**:

```text
Local Treats
└── Romney's
    └── Mint Cake / Fudge / ...
```

and similarly for Hawkshead Relish.

### Required Codex action

1. Fetch newest remote `main` and review the out-of-band commits before editing.
2. Audit the cookie change for Safari-return behavior and security.
3. Treat `9bb2d7e` as a correct **first step toward stable-node re-parenting**, but incomplete because of the two-level restriction.
4. Extend hierarchy validation and the Admin Section-level editor to support moving a section **with existing children** under another section, while preventing cycles/self-parenting and preserving draft/publish/version/audit semantics.
5. Keep Product records, inventory and Product placements untouched. Do not flatten Romney's/Hawkshead, duplicate their children, or move Products individually.
6. Treat applied migration 0028 as immutable Staging history. Add a forward migration for Local Treats, the remaining promotions/renames/re-parenting and any required ordering/navigation changes.
7. Verify the published public navigation contains exactly the six roots above, while the nested Romney's/Hawkshead collection pages still expose their children and Products correctly.
8. Add regression coverage for the third level, moving parent nodes with children, cycle rejection, stable placement preservation, navigation, routes/breadcrumbs and sitemap output.
9. Update `docs/ADMIN-V2-CHECKLIST.md`, this handoff and relevant audit evidence with exact commits/runs.
10. Do **not** deploy Production unless the owner explicitly approves it after Staging review.


Updated 30 September 2026. Repository `Mo31D/Blacksheep`, existing `main` only. Remote `main` is authoritative: this workstation's local `.git` index/ref is stale and cannot create `.git/index.lock` in the sandbox. Use a fast-forward-only GitHub connector ref update if local Git remains restricted; never push the stale local ref, create a branch or force-push.

## Current phase / last completed task

Phase 7 staging acceptance remains open for Homepage, Stocktake/reservation writes, checkout/Turnstile and physical weak-device checks. Phase 8 Admin productization was registered in the checklist and `ADMIN-PRODUCTIZATION-AUDIT.md` **before** implementation; do not reopen closed backend phases without a reproducible Admin defect. Slice A navigation is complete: staging #51 desktop routes passed and exact generated Admin passed 390px/320px Chromium/WebKit CI 36684237786. Slice B.1 Homepage module ordering was implemented and accepted on staging #52. Slice C.1 verified the black sheep PNG sources are opaque and recorded the original-artwork replacement need; no asset changed. Slice C.2 Image Library wording/disclosure `8a89e5a` passed Commerce CI [36681553030](https://github.com/Mo31D/Blacksheep/actions/runs/36681553030), Search, Pages and guarded [staging deploy #53](https://github.com/Mo31D/Blacksheep/actions/runs/36681553091); desktop browser acceptance passed. Physical phone staging acceptance remains under Slice F because the in-app browser ignored its viewport override. No production Worker/data changed.

Direct Product, Appearance hero and Section image uploads passed using tracked `assets/sheep-icon.png`; QA uploads and Products were archived. The staging-only `STAGING_EMAIL_ALLOWLIST` binding for the user-approved test mailbox is present after deploy, with no value committed. A synthetic test message returned 201/SENT, then D1 webhook `DELIVERED` through Resend. A non-allowlisted invalid recipient returned 502/FAILED with no provider ID. Synthetic order had no reservation/movement and was cleaned to zero rows. Inbox UI was not inspected. Details and fixture IDs: `STAGING-ACCEPTANCE-2026-09-29.md`.

## Current task / next recommended task

Slice A is complete: exact generated Admin passed 390px/320px Chromium/WebKit CI 36684237786; physical phone staging acceptance remains under Slice F. Slice B.2 candidate `34e8c9e` adds ordered Homepage card node references, contextual Admin controls, private preview and published storefront rendering. `6fc54d5` corrected Wrangler seed syntax. `fa3c107` filters archived destinations; [Commerce CI 36689079301](https://github.com/Mo31D/Blacksheep/actions/runs/36689079301), Search, Pages, Storefront Overlay Browser QA and guarded [staging deploy #54](https://github.com/Mo31D/Blacksheep/actions/runs/36689079168) succeeded. Live staging Admin showed six collection and three local cards; an unsaved ↑ ↓ reorder reset on reload, preserving the existing draft. **Defect:** local cards showed blank image placeholders because the three canonical Section image fields are null although static Homepage cards use `/images/9.png`, `46.png`, `49.png`. New migration 0027 backfills only null published Section image fields; in-memory SQLite verified all three and preserved an owner-supplied Romney's image. Next: commit migration, verify CI/guarded staging and recheck local-card image previews. Do not overwrite the existing staging Homepage draft.

Slice B.1 is verified: `581af6a` removed arbitrary Homepage module pinning in D1/Admin/storefront; `496e8e3` updated stale browser QA. TypeScript and 78 files / 573 tests passed locally; Commerce CI 36660738268, browser QA 36660738158, Search, Pages and guarded staging deploy #52 succeeded. Live staging Admin exposed ↑ ↓ for all five modules; an unsaved Product strip move changed order, then reload restored the existing draft. **Do not publish/restore that draft** merely for QA; establish ownership or use an isolated fixture. Slice C.2 is verified on desktop staging #53: standalone category is optional, default General, explicitly not placement. Continue Slice B contextual Homepage content/card editing using canonical section references, then Slice C usage/duplicate handling. The current `usageCount` query in `data/shared-media.ts` counts historical versions as well as active references; do not label it “places currently used” without separating those states. Stocktake/reservation and full order lifecycle remain open.

## Decisions and unresolved risks

- Worker/D1/R2 and Shared Media remain canonical. Admin productization changes presentation and workflow, not domain ownership. Existing Appearance versioning and Product media lifecycle stay intact.
- Staging Workspace has an existing Homepage draft and unfinished Stocktake. A stale browser state produced an expected Homepage version conflict until Refresh. Do not publish/restore or mutate those records as QA fixtures without first establishing ownership.
- Phase 7 still needs deployed Stocktake/order/reservation and customer checkout/Turnstile tests, plus physical Save-Data/≤2 GiB acceptance. Source theme tests already cover device-policy decisions; normal-device seasonal browser checks passed. CAPTCHA completion requires action-time approval in browser automation. No production promotion without explicit user approval.
- Phase 6 historical `loader.js`, `.b64` and restore assets remain untouched. Route parity/source absence are documented in `LEGACY-ASSET-REFERENCE-AUDIT.md`; Cloudflare Free Website `/logs/received` returned `1010 auth.forbidden`. Obtain equivalent time-bounded external-consumer evidence before deletion.
- The black-background sheep issue originates in the tracked opaque indexed PNG source files (`sheep-icon.png`, `logo-primary.png`, `logo-compact.png`), not Shared Media processing. Do not substitute the simplified transparent `sheep-icon.svg` for the detailed original; obtain a transparent export of the same artwork and then test rendering. See the Admin audit/Phase 8 Slice C.1.
- Local Windows workerd D1 launch fails; Linux Commerce CI is the complete runtime/migration gate.

## Relevant commits

- `d3ce371`: initial staging deploy #48 and migration 0025.
- `deffbab`, `509d153`: static preview resolver; final Commerce CI 36618633316, Search 36618633413, Pages 36618632065 SUCCESS.
- `a92e196`: initial seasonal/Media staging acceptance record.
- `53bf362`: direct upload/mail configuration evidence and guarded staging deploy trigger; deploy #50, Search and Pages SUCCESS.
- `554aa48`: registered Admin productization phase before implementation and recorded staging acceptance.
- `b43c23e`, `d5c8bef`, `cf0bb93`: Slice A navigation and read-only 390px/320px Chromium/WebKit CI browser acceptance; Commerce CI 36684237786, Search and Pages SUCCESS. Physical phone staging check remains in Slice F.
- `581af6a`, `496e8e3`: all Homepage modules movable and browser QA assertion aligned; Commerce CI 36660738268, browser QA 36660738158, Search, Pages and staging deploy #52 SUCCESS. No Homepage draft was saved/published during staging check.
- `8a89e5a`: Image Library upload category disclosure/labels; Commerce CI 36681553030, Search, Pages and staging deploy #53 SUCCESS. No file uploaded during recheck.
