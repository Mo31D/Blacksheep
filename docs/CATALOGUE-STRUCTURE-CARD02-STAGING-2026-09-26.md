# Black Sheep Platform — CARD 02 Catalogue Structure Admin

Date: 26 September 2026  
Repository: `Mo31D/Blacksheep` · branch `main`  
Card: **CARD 02 — Catalogue Structure Admin redesign**  
Release state: **COMPLETE / STAGING VERIFIED**  
Production promotion: **intentionally not performed**

## Outcome

The old long, technical Category Manager is no longer the owner-facing way to organise the website.

Admin now has a dedicated **Catalogue** workspace with two separate concepts:

1. **Website structure** — the hierarchy customers browse.
2. **Brands & ranges** — product labelling/classification.

Website placement is therefore no longer presented to the owner as technical category enums.

## Owner-facing Catalogue UX

### Website structure

The owner can now:
- view main website sections as collapsible cards;
- see nested sub-sections;
- add a new main section;
- add a sub-section beneath a main section;
- rename a section;
- reorder sibling sections;
- show/hide a section from website navigation;
- add an optional short description;
- add an optional section-image address;
- archive a section;
- restore an archived section;
- search the hierarchy;
- optionally reveal archived entries.

The screen uses plain owner language and does not expose `PRODUCT_CATEGORY`, `COLLECTION_THEME` or similar implementation enums.

### Brands & ranges

Brands/ranges remain a separate owner workspace. Existing category storage is retained for this concept rather than being repurposed as website hierarchy.

## Safety / data model

### Migration

Added:

`commerce/migrations/0018_storefront_structure_admin.sql`

This adds the Storefront Structure audit ledger:
- `storefront_audit_events`
- indexes for node/event history

The migration is additive and does not delete or rewrite Product, Inventory, Order or existing Storefront Structure history.

### Guarded owner mutations

Storefront Structure writes use optimistic version checks.

The write path guards:
- stale concurrent edits;
- invalid nesting deeper than Main → Sub-section;
- archiving a parent while active children remain;
- editing archived nodes;
- invalid parent relationships;
- unsafe partial draft/audit writes.

Changes remain Storefront Structure drafts at this stage. **The public website does not consume these owner-created structure drafts yet.** That cutover belongs to later cards.

### Audit events

Audited operations include:
- node created;
- node updated;
- node moved;
- node archived;
- node restored.

Actor, before/after state, reason and timestamp are retained.

## Admin API

Added owner-authenticated routes for Storefront Structure:
- `GET /admin/api/storefront-structure`
- `POST /admin/api/storefront-structure`
- `PATCH /admin/api/storefront-structure/:id`
- `POST /admin/api/storefront-structure/:id/move`
- `POST /admin/api/storefront-structure/:id/archive`
- `POST /admin/api/storefront-structure/:id/restore`

Owner-facing conflict/error messages were added for version conflicts, invalid nesting, archive guards and other structure mutations.

## Admin information architecture

A top-level **Catalogue** destination now exists in desktop and mobile Admin navigation.

Products retains **Catalogue setup** as the bridge into this workspace, but the old owner-facing **Manage categories** sheet is no longer the primary Catalogue organisation UI.

## iPad / mobile

Catalogue received responsive rules for:
- iPad portrait;
- iPhone/WebKit;
- nested section rows;
- Brands & ranges rows;
- structure editor sheets;
- mobile bottom navigation;
- no horizontal overflow.

## Automated validation

### Commerce CI

Run: **36271016142** — PASS.

The Commerce suite also includes Storefront Structure Admin API/data-layer tests and validates the staging browser-QA script syntax.

A previous release-gate run recorded:
- **39 test files passed**
- **225 tests passed**
- migration upgrade validation passed through `0018`
- Worker dry-run passed.

### Staging deploy

Run: **36270522076** — PASS.

Verified:
- `0018_storefront_structure_admin.sql` applied to **black-sheep-commerce-staging**;
- staging Worker deployed successfully;
- staging health passed;
- staging custom-domain isolation passed;
- Production Worker and Production D1 were not modified.

Staging Worker version from the release gate:
`ba1762ff-45e3-41c1-a3d5-fcf6f0594665`

### Browser QA

Run: **36271024200** — PASS.

Browser proof includes:
- authenticated Admin;
- Catalogue hierarchy visible;
- main-section creation;
- two nested sub-section creations;
- menu visibility toggle;
- sub-section reorder;
- sub-section archive/restore;
- parent archive guard;
- no exposed technical category enums;
- iPad portrait Catalogue has no horizontal overflow;
- existing Product, Stock, Stock Value, Reports and Orders mobile/tablet checks still pass.

All synthetic Storefront Structure, category, session and order QA records were cleaned after the successful run.

## QA defects found and fixed during CARD 02

The test cycle caught two QA-harness defects before closure:
1. the staging injected session could select an obsolete Admin email; the harness now resolves an identity that the staging Worker actually accepts;
2. the parent Archive selector matched a nested child's button in strict mode; it now targets the parent action explicitly.

These were test-harness defects, not Storefront Structure data corruption. The final Browser QA is green.

## Production state

**Production was not deployed or migrated as part of CARD 02.**

The owner-facing implementation is complete and proven on Staging. Promotion remains intentionally deferred until the later release sequence requires it.

## Acceptance criteria

- [x] Owner can create a new main website section without GitHub.
- [x] Owner can create/reorder sub-sections.
- [x] Owner can choose whether a section appears in the main menu.
- [x] iPad portrait UX is clean and usable.
- [x] Existing structure is migrated without duplicate destinations.
- [x] Destructive actions are guarded and audited.

## Exact next action

Start **CARD 03 — Product Editor: placement + multi-location + live verification**.

Use the Storefront Structure model from CARD 01/02 in Product Add/Edit:
- Primary section;
- Primary sub-section;
- optional “Also show in” destinations;
- Brands & ranges separate from website placement;
- Save draft;
- Publish;
- verify against the public catalogue before showing **Published & live on storefront ✓**;
- provide **View on website** after successful verification.

Keep the work on Staging until CARD 03 acceptance gates pass.
