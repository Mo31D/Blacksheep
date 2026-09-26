# Black Sheep Platform — Implementation Cards

Updated: 26 September 2026  
Repository: `Mo31D/Blacksheep` · branch `main`  
Purpose: authoritative implementation board for the next architecture programme.

> GitHub Issues are disabled in this repository. These repository-native cards are therefore the execution source of truth. Update card status and acceptance criteria in the same milestone that changes implementation state.

## Status legend

- `READY` — may start now.
- `BLOCKED` — dependency not complete.
- `IN PROGRESS` — implementation underway.
- `STAGING VERIFIED` — code + targeted staging/browser proof passed.
- `PRODUCTION VERIFIED` — live release and smoke proof passed.
- `COMPLETE` — documentation/cleanup closed.

## Programme rules

1. Always fetch newest `main` before editing.
2. D1 remains the operational source of truth.
3. Do not create a second independent category/storefront model.
4. Public-facing changes follow **Edit → Draft → Preview → Publish → Verify live**.
5. Preserve current orders, product history, inventory history and indexed URLs during migration.
6. No feature is called Production complete from source inspection alone.
7. Every card closes with automated checks, targeted browser QA, documentation and exact next action.
8. Owner-facing language must remain non-technical and iPad-friendly.

---

## CARD 00 — Architecture freeze & source-of-truth map
**Status:** READY  
**Depends on:** none

**Goal:** freeze the target architecture before feature implementation.

**Scope**
- Map authoritative ownership for Products, Inventory, Storefront Structure, Navigation, Homepage, Appearance, Media, Orders and Reports.
- Record current static storefront dependencies and migration boundaries.
- Define compatibility and rollback rules.
- Define one publishing lifecycle for all public-facing domains.

**Acceptance criteria**
- [ ] Every major domain has exactly one source of truth.
- [ ] No new feature requires a duplicate category/storefront authority.
- [ ] Current Production behaviour is documented before schema changes.
- [ ] Rollback path is defined for every later phase.
- [ ] Architecture diagram + data ownership matrix committed.

---

## CARD 01 — Storefront Structure data model
**Status:** BLOCKED  
**Depends on:** CARD 00

**Goal:** create a real hierarchical website structure instead of overloading flat categories.

**Scope**
- Hierarchical storefront nodes: parent/child, name, slug, sort order, active, show-in-navigation, optional image/description.
- Product-version placements: one Primary location + multiple “Also show in” locations.
- Keep Brand / Range and product classification separate from website placement.
- Safe migration from current product types/categories.

**Acceptance criteria**
- [ ] Product can have one primary and multiple secondary storefront placements.
- [ ] Placements are part of the product draft/publish lifecycle.
- [ ] Archiving a node does not destroy history.
- [ ] Existing live catalogue remains functional through migration.
- [ ] Migration has a tested rollback path.

---

## CARD 02 — Catalogue Structure Admin redesign
**Status:** BLOCKED  
**Depends on:** CARD 01

**Goal:** replace the current long category manager with a simple Store Structure workspace.

**Owner UX**
- Collapsible cards for main sections.
- Nested sub-sections.
- Add section / Add sub-section.
- Rename, reorder, hide/show, archive/restore.
- “Show in main menu” toggle.
- Optional section image and short description.
- Separate simple areas for **Website structure** and **Brands & ranges**.
- Do not expose enums such as `PRODUCT_CATEGORY` or `COLLECTION_THEME`.

**Acceptance criteria**
- [ ] Owner can create a new main website section without GitHub.
- [ ] Owner can create/reorder sub-sections.
- [ ] Owner can choose whether a section appears in the main menu.
- [ ] iPad portrait UX is clean and usable.
- [ ] Existing structure is migrated without duplicate destinations.
- [ ] Destructive actions are guarded and audited.

---

## CARD 03 — Product Editor: placement + multi-location + live verification
**Status:** BLOCKED  
**Depends on:** CARD 01, CARD 02

**Goal:** make product editing answer “Where should this product appear?”

**Product placement card**
- Primary section dropdown.
- Primary sub-section dropdown.
- “Also show in” multi-location picker.
- Selected locations shown as chips/cards.
- Brand / Range separate from storefront placement.
- Product classification separate from storefront placement.

**Publish UX**
- Save draft.
- Preview.
- Publish.
- Verify through public catalogue endpoint.
- Show **Published & live on storefront ✓** only after verification.
- Provide **View on website**.

**Acceptance criteria**
- [ ] One product appears in multiple destinations without duplication.
- [ ] Primary placement is explicit.
- [ ] Brand/Range is not confused with website location.
- [ ] Publish never falsely reports “live”.
- [ ] Add/Edit remains simple for a non-technical owner.
- [ ] Existing version/audit behaviour is preserved.

---

## CARD 04 — Dynamic collections & navigation engine
**Status:** BLOCKED  
**Depends on:** CARD 01, CARD 02, CARD 03

**Goal:** allow Admin-created sections to become real website destinations/menu items without manual HTML edits.

**Scope**
- Collection pages generated from published storefront nodes.
- Main navigation reads published structure/navigation data.
- Non-product navigation remains supported: Full Range, Our Story, Find Us.
- Navigation ordering and hide/show controlled from Admin.
- Existing URLs preserved during migration.

**Acceptance criteria**
- [ ] New enabled main section can appear in website menu.
- [ ] New section automatically has a browsable collection destination.
- [ ] Product placements drive collection membership.
- [ ] Menu order is Admin-controlled.
- [ ] Existing links remain valid.
- [ ] Desktop/mobile navigation regression passes.

---

## CARD 05 — Stocktake 2.0: scoped, persistent, keyboard-fast
**Status:** BLOCKED  
**Depends on:** CARD 01

**Goal:** make physical stock counting match how the shop is actually organised.

**Start stocktake**
Owner may choose:
- Entire shop.
- Website section.
- Brand / Range.
- Collection.
- Custom products.

Show scope + number of products before starting.

**Persistent session**
- Add `stocktake_sessions`.
- Add `stocktake_session_items`.
- Continuously preserve progress.
- Support **Continue unfinished stocktake**.

**Counting UX**
- Keep the current simple one-product-at-a-time card.
- Scope + “x of y” progress.
- Image, name, SKU/barcode, System, Available.
- Previous / Skip / Save & next.
- Reuse the same quantity input instead of rebuilding the whole sheet.
- Keep numeric keyboard/focus on iPad after Save & next.
- Enter/Next key can advance.

**Acceptance criteria**
- [ ] Romney's-only stocktake can be started directly.
- [ ] Highland Cows-only stocktake can be started directly.
- [ ] Refresh/accidental close does not lose saved progress.
- [ ] iPad keyboard remains focused through repeated Save & next.
- [ ] Concurrency conflicts go to review instead of overwriting stock.
- [ ] Final review/result summary remains.

---

## CARD 06 — Homepage Merchandising model & Admin
**Status:** BLOCKED  
**Depends on:** CARD 01, CARD 00 publishing conventions

**Goal:** let the owner control which products are promoted on the homepage.

**Product rail modes**
- **New arrivals** — newest published products automatically.
- **Featured products / Popular picks** — manual owner selection.
- **Selected collection** — products from one storefront collection.

**Controls**
- Enable/disable.
- Choose mode.
- Number of products.
- Search/add Featured products.
- Drag/reorder Featured products.
- Select collection.
- Draft/Preview/Publish.

**Acceptance criteria**
- [ ] Owner can switch between all three modes.
- [ ] Manual products can be reordered.
- [ ] No GitHub edit is required.
- [ ] Homepage config is stored separately from product data.
- [ ] Draft homepage changes are not live before publish.

---

## CARD 07 — Homepage dynamic modules & premium product rail
**Status:** BLOCKED  
**Depends on:** CARD 04, CARD 06

**Goal:** move homepage composition away from hard-coded sections while avoiding a fragile free-form page builder.

**Initial safe modules**
- Hero.
- Gift/section collections.
- Product rail.
- Local favourites.
- Visit/shop section.

**Product rail**
- Premium horizontal cards.
- Desktop arrows.
- Touch/swipe on iPad/mobile.
- No aggressive marquee.
- Optional subtle auto-motion only if accessible and stoppable.
- Uses live price/availability.

**Admin**
- Show/hide module.
- Reorder modules.
- Edit only approved fields.

**Acceptance criteria**
- [ ] Product rail renders all merchandising modes.
- [ ] Module order is data-driven.
- [ ] Mobile/iPad overflow passes.
- [ ] Price/availability remain live-commerce authoritative.
- [ ] Static fallback/SEO behaviour is defined.

---

## CARD 08 — Website Appearance foundation
**Status:** BLOCKED  
**Depends on:** CARD 00

**Goal:** introduce a safe non-technical Appearance system before seasonal presets are fully designed.

**Admin: Website → Appearance**
Four cards only:
1. Theme.
2. Homepage hero.
3. Colours.
4. Section images.

**Architecture**
- Appearance profiles/versions in D1.
- Design tokens rather than arbitrary CSS.
- Approved tokens: background, surface, text, muted text, accent, button, border, header.
- Draft/live versions.
- Future scheduling fields supported without scheduling UI yet.

**Acceptance criteria**
- [ ] No arbitrary CSS input.
- [ ] Owner changes approved visual settings without GitHub.
- [ ] Preview exists before publish.
- [ ] Previous appearance can be restored.
- [ ] Current default appearance can be represented with no visual regression.

---

## CARD 09 — Seasonal theme presets, Hero editor & section imagery
**Status:** BLOCKED  
**Depends on:** CARD 08; CARD 11 for full shared-media reuse

**Goal:** deliver simple seasonal control.

**Preset architecture**
Future preset library can include:
- Default.
- Winter.
- Christmas.
- Summer.
- Ice Cream.
- Later presets without schema redesign.

**Owner controls**
- Pick preset.
- Adjust small approved colour set.
- Reset to preset defaults.
- Change homepage hero image.
- Change hero heading/text/button/destination.
- Change section images.
- Preview then publish.
- Restore prior appearance.

**Future-ready**
Start/end activation dates supported in data model; scheduling UI deferred.

**Acceptance criteria**
- [ ] Preset can be applied without code.
- [ ] Hero and section imagery editable from Admin.
- [ ] Mobile hero behaviour is defined.
- [ ] Reset-to-default works.
- [ ] Theme cannot break contrast/layout constraints.

---

## CARD 10 — Unified Preview → Publish → Verify engine
**Status:** BLOCKED  
**Depends on:** CARD 03, CARD 04, CARD 06, CARD 08

**Goal:** use one publishing contract across Product, Structure, Homepage and Appearance.

**Lifecycle**
`Edit → Draft → Preview → Publish → Verify live`

**Scope**
- Draft revisions.
- Preview context.
- Publish version.
- Public endpoint/live verification.
- Visible Admin state.
- Audit event.
- Restore/rollback where appropriate.

**Owner-facing states**
- Draft saved.
- Preview.
- Publishing…
- Live ✓.
- Verification failed / Retry.

**Acceptance criteria**
- [ ] Products use the unified model.
- [ ] Structure uses it.
- [ ] Homepage uses it.
- [ ] Appearance uses it.
- [ ] Failed verification cannot display live success.
- [ ] Audit records actor/time/version.

---

## CARD 11 — Shared Media Library on R2
**Status:** BLOCKED  
**Depends on:** CARD 00

**Goal:** one reusable image/media system for Products, Homepage, Sections and Themes.

**Scope**
- R2-backed assets + D1 metadata.
- Asset context/type.
- Alt text.
- Upload, replace, archive.
- Reuse existing asset instead of duplicate uploads.
- References from products, structure, homepage and appearance.
- Safe orphan-cleanup policy.

**Admin**
Website → Media:
- Products.
- Homepage.
- Sections.
- Themes.

**Acceptance criteria**
- [ ] One asset can be reused by several surfaces.
- [ ] Replacing a reference does not corrupt published history.
- [ ] Alt text is editable.
- [ ] Archive/delete cannot silently break a live page.
- [ ] R2 cleanup is auditable.

---

## CARD 12 — Clean dynamic URLs & SEO migration
**Status:** BLOCKED  
**Depends on:** CARD 04, CARD 10

**Goal:** progress from static/query-string fallbacks to durable data-driven URLs without sacrificing existing Google equity.

**Target examples**
- `/collections/highland-cows`
- `/collections/christmas`
- `/products/highland-cow-family`

**Scope**
- Dynamic collection routing.
- Dynamic product routing where appropriate.
- Preserve current canonical static product URLs until proven migration.
- 301 strategy.
- Canonicals.
- Sitemap generated from published structure/products.
- Structured data.
- Search Readiness regression coverage.

**Acceptance criteria**
- [ ] Existing indexed URLs remain valid or correctly redirect.
- [ ] Admin-created section receives a clean URL automatically.
- [ ] Canonicals are correct.
- [ ] Sitemap contains published data only.
- [ ] No duplicate-content regression.

---

## CARD 13 — Admin information architecture & owner-simplicity pass
**Status:** BLOCKED  
**Depends on:** may start after CARD 02; final pass after CARD 11

**Goal:** organise Admin around owner tasks rather than implementation terminology.

**Target navigation**
- Dashboard
- Orders
- Products
- Catalogue
  - Structure
  - Brands & ranges
- Stock
  - Inventory
  - Stocktake
  - Stock value
- Website
  - Homepage
  - Appearance
  - Navigation
  - Media
- Reports
- Settings

**UX principles**
- Non-technical labels.
- Progressive disclosure.
- Cards/accordions rather than long dense forms.
- iPad-first sheet behaviour.
- Consistent Save / Preview / Publish.
- Clear error, status and recovery actions.

**Acceptance criteria**
- [ ] Every existing feature has one obvious home.
- [ ] No duplicate navigation concepts.
- [ ] Portrait iPad workflows are usable.
- [ ] Product, Stocktake and Website flows minimise unnecessary scrolling.
- [ ] Focus/touch/accessibility regression passes.

---

## CARD 14 — Deep Production QA, migration cleanup & handoff
**Status:** BLOCKED  
**Depends on:** all implementation cards

**Goal:** close the programme with verified Production state and no temporary architecture.

**QA matrix**
- Catalogue hierarchy + multi-placement.
- Add/Edit/Publish product.
- New Admin-created main menu section.
- Navigation ordering.
- Dynamic collections.
- Full-shop and scoped Stocktake.
- Persistent stocktake resume.
- iPad keyboard/focus.
- Homepage merchandising modes.
- Appearance preview/publish/restore.
- Media reuse.
- Orders/checkout regression.
- Mobile/tablet/desktop.
- SEO/Search Readiness.
- D1/R2 integrity.
- Audit history.

**Cleanup**
- Remove temporary one-shot workflows after evidence is recorded.
- Remove dead compatibility code only after cutover.
- Update authoritative checklist/handoff.
- Record Production IDs and deploy evidence.

**Acceptance criteria**
- [ ] Full automated suite green.
- [ ] Read-only Production smoke green.
- [ ] Owner workflows manually verified.
- [ ] No temporary diagnostic assets remain.
- [ ] Documentation matches Production reality.

---

# Dependency / execution order

```text
CARD 00
 ├─ CARD 01 ─ CARD 02 ─ CARD 03 ─ CARD 04 ────────────────┐
 │      │                    │                              │
 │      └──────── CARD 05    └─ CARD 06 ─ CARD 07          │
 │                                                           
 ├─ CARD 08 ─ CARD 09                                      │
 ├─ CARD 11 ────────────────┐                              │
 │                           └─ supports CARD 09 / CARD 13  │
 └──────────────── CARD 10 ─ CARD 12                       │
                         │                                  │
                         └──────── CARD 13 ─────────────────┤
                                                           
                                      CARD 14 ◀─────────────┘
```

## Recommended execution sequence

1. CARD 00 — architecture freeze.
2. CARD 01 — Storefront Structure schema.
3. CARD 02 — Structure Admin.
4. CARD 03 — Product placement editor.
5. CARD 04 — dynamic collections/navigation.
6. CARD 05 — Stocktake 2.0.
7. CARD 06 — Homepage merchandising.
8. CARD 07 — dynamic homepage/product rail.
9. CARD 08 — Appearance foundation.
10. CARD 11 — Media Library.
11. CARD 09 — theme presets/hero/section imagery.
12. CARD 10 — unify publishing across all new domains.
13. CARD 13 — final Admin IA/simplicity pass.
14. CARD 12 — clean URL/SEO migration after data-driven storefront stabilises.
15. CARD 14 — deep Production QA and cleanup.

## Immediate next action

Start **CARD 00** only: audit current `main`, freeze the domain boundaries/data ownership/migration strategy, and update this board before CARD 01 schema work begins.
