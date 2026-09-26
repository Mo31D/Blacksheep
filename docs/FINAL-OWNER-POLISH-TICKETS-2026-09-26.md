# Black Sheep Admin — Final Owner Polish Tickets

Date: 26 September 2026  
Repository: `Mo31D/Blacksheep`  
Branch: `main`

> GitHub Issues are currently disabled for this repository. This file is the issue-ready backlog, ordered by priority. Each section can be pasted into GitHub Issues unchanged if Issues are enabled later.

---

# P0 — Must fix before owner-ready sign-off

## [P0] Isolate test/E2E orders from business data and add a safe staging reset

### Summary
Separate synthetic QA/E2E orders from real business orders so Dashboard, Reports and normal Admin workflows are not polluted by test activity. Add a guarded staging-only reset flow for test orders.

### Acceptance criteria
- [ ] Orders have an explicit internal classification such as `BUSINESS`, `TEST`, `E2E` or equivalent.
- [ ] Newly-created automated QA/E2E orders are classified explicitly.
- [ ] Existing identifiable QA/E2E orders are classified or migrated safely.
- [ ] Default Dashboard and Reports exclude test/E2E orders.
- [ ] Normal Orders list excludes test/E2E orders unless a test-data filter is selected.
- [ ] Staging exposes a guarded reset action requiring an explicit confirmation phrase.
- [ ] Reset removes only test-order data and dependent test-only records.
- [ ] Reset cannot delete real business orders, Products, Product Media or unrelated inventory history.
- [ ] Production does not expose an unsafe reset control.
- [ ] Automated tests cover classification, reporting exclusion and reset safety.
- [ ] Commerce CI and targeted Admin staging regression pass.

---

## [P0] Remove phase/staging implementation language from owner-facing Admin copy

### Summary
Replace development-phase terminology in the Admin UI with stable owner-facing language.

### Acceptance criteria
- [ ] No owner-facing page uses internal Phase numbering as normal UI language.
- [ ] Products intro describes catalogue management, not staging/cutover implementation.
- [ ] Stock intro describes stock operations rather than ledger implementation details.
- [ ] Add Product copy no longer refers to a dedicated Media phase.
- [ ] Labels such as `Staging Product Core`, `Phase 2 · Editing`, `Phase 4 · Staging` and `before storefront cutover` are removed from normal owner workflows.
- [ ] Staging remains identifiable through a small environment indicator, not core page copy.
- [ ] Automated UI assertions protect the revised copy from regression.

---

## [P0] Rework Stocktake conflict handling into owner-friendly review and retry UX

### Summary
Turn current Stocktake technical conflicts into a recoverable owner workflow without weakening Inventory Core concurrency guarantees.

### Acceptance criteria
- [ ] Results distinguish `Updated`, `No change` and `Needs review`.
- [ ] `Inventory Already Tracked` is not presented as a generic technical failure.
- [ ] Concurrency conflicts explain that stock changed while counting.
- [ ] A `Review N items` path shows only affected rows.
- [ ] Owner can recount/retry affected products without repeating the entire Stocktake.
- [ ] No conflict path silently overwrites a newer balance.
- [ ] Sticky result actions do not cover rows on iPhone/iPad.
- [ ] Inventory ledger immutability and concurrency tests remain green.
- [ ] Targeted staging Stocktake browser regression passes on mobile.

---

# P1 — Owner workflow and mobile polish

## [P1] Compact the Dashboard mobile layout and restore 2×2 KPI hierarchy

### Summary
Polish the Today/Dashboard mobile layout so primary metrics are compact and balanced.

### Acceptance criteria
- [ ] Revenue, Orders, Awaiting payment and Ready for collection render as a 2×2 grid on iPhone widths.
- [ ] No orphan KPI card appears alone on a row.
- [ ] Vertical whitespace before the Revenue chart is reduced.
- [ ] Revenue chart remains fully readable.
- [ ] No horizontal overflow is introduced.
- [ ] iPad portrait and desktop remain coherent.

---

## [P1] Replace Admin bottom-nav symbols with a consistent SVG icon system

### Summary
Replace generic geometric/Unicode symbols with a consistent local SVG icon set.

### Acceptance criteria
- [ ] Today, Orders, Products, Stock and Reports use SVG icons from one visual system.
- [ ] Icon sizing and optical weight are consistent.
- [ ] Active state is clear without relying on icon shape alone.
- [ ] Labels remain visible and accessible.
- [ ] No external icon CDN/runtime dependency is introduced.
- [ ] Mobile safe-area behaviour remains correct.

---

## [P1] Polish Orders mobile hierarchy, filters and compact header

### Summary
Reduce the vertical cost of the Orders page and improve scanability on mobile.

### Acceptance criteria
- [ ] Refresh is compact and no longer consumes a large standalone row.
- [ ] Orders KPIs use a balanced 2×2 mobile grid.
- [ ] Status pills scroll horizontally without appearing accidentally clipped.
- [ ] Right-edge padding/fade or equivalent cue makes more filters discoverable.
- [ ] Order reference, customer, time/fulfilment, status and total have clear visual hierarchy.
- [ ] Prices do not visually compete with interactive order links.
- [ ] No horizontal overflow on iPhone/iPad portrait.
- [ ] Existing order actions and master/detail behaviour remain intact.

---

## [P1] Polish Products list hierarchy and reduce repetitive Untracked noise

### Summary
Keep the existing Products architecture while improving scanability.

### Acceptance criteria
- [ ] Product title remains the primary interactive element.
- [ ] Price uses a non-link visual treatment.
- [ ] Repeated `Untracked` state does not dominate every row.
- [ ] Out of stock / Arriving / actionable states remain clearly visible.
- [ ] Search, sort and filters retain existing functionality.
- [ ] Rows remain legible on narrow iPhone widths.
- [ ] Desktop split-view remains functionally unchanged.

---

## [P1] Redesign Add Product for fast mobile draft creation

### Summary
Shorten the initial Add Product workflow and move non-essential editing to the full editor after draft creation.

### Initial draft fields
- Product name
- Price
- Product type
- Category
- SKU
- Barcode
- Optional short description

### Acceptance criteria
- [ ] Product name is clearly required.
- [ ] Product type is selected from controlled values rather than arbitrary free text.
- [ ] Essential fields are grouped separately from optional details.
- [ ] Owner can create a valid private Draft quickly on iPhone.
- [ ] After creation, full editor opens for images, content, availability, inventory and publication.
- [ ] Existing UUID/slug generation and uniqueness protections remain unchanged.
- [ ] Product stays private until explicitly published.
- [ ] Validation errors are owner-friendly and field-specific.

---

## [P1] Replace flat Add Product category cards with compact searchable multi-select

### Summary
Make category selection efficient on mobile without unnecessarily changing Product Core relationships.

### Acceptance criteria
- [ ] Category picker is searchable.
- [ ] Multiple categories can be selected/deselected efficiently.
- [ ] Category rows no longer consume near-full-screen height each.
- [ ] Existing category IDs and relationships remain compatible.
- [ ] Visual grouping can distinguish Brand/Range, Product category and Collection/Theme without silently changing persisted semantics.
- [ ] Selected categories remain obvious while scrolling.
- [ ] Keyboard and touch interaction work on iPhone/iPad.

---

## [P1] Fix sticky Product editor footer overlap and mobile safe-area spacing

### Summary
Ensure sticky Add/Edit Product actions never cover the final fields.

### Acceptance criteria
- [ ] Scroll container includes sufficient bottom padding for footer + safe area.
- [ ] Final field/category can be fully scrolled above the action footer.
- [ ] Footer remains sticky and usable.
- [ ] iPhone Safari browser chrome does not make fields unreachable.
- [ ] iPad portrait behaves correctly.
- [ ] Desktop drawer/editor behaviour is not regressed.

---

## [P1] Simplify Stock overview terminology and prioritize actionable inventory KPIs

### Summary
Make the Stock workspace easier for the owner to understand.

### Acceptance criteria
- [ ] Untracked products use owner-facing wording such as `Stock tracking not started`.
- [ ] A clear `Start stock tracking` action exists in the relevant flow.
- [ ] Primary KPIs emphasize Tracked, Low stock, Out of stock and Incoming.
- [ ] Total products / needing initial count can be shown as a compact summary instead of oversized duplicate cards.
- [ ] `Available —` does not look like broken data.
- [ ] Stock search/location/filter controls remain intact.
- [ ] Inventory semantics and ledger guarantees are unchanged.

---

## [P1] Clarify Reports semantics and make operational exceptions actionable

### Summary
Keep the existing Reports design while clarifying metric meaning and improving actionability.

### Acceptance criteria
- [ ] `Payment funnel` is renamed or recalculated so its meaning is unambiguous.
- [ ] Current-state charts and historical-stage metrics are not presented as the same concept.
- [ ] Email delivery exception rows can open the related order.
- [ ] Resolved versus active failures can be distinguished.
- [ ] `What to act on` links each item directly to the relevant workflow.
- [ ] Top products, customers, cancellation rate, busiest hour and ageing queue exclude test/E2E data by default.
- [ ] Reports remain readable on iPhone without horizontal overflow.

---

# P2 — Final consistency and release gate

## [P2] Final Admin visual consistency pass: spacing, typography and microcopy

### Summary
Apply one final cross-screen visual consistency pass after functional polish is complete.

### Acceptance criteria
- [ ] Shared spacing and typography rules are consistent across all five Admin sections.
- [ ] Buttons with the same role use consistent dimensions.
- [ ] Status terminology is consistent across Orders, Products, Stock and Reports.
- [ ] Empty states are clear and non-technical.
- [ ] No internal implementation jargon remains in normal owner workflows.
- [ ] No new horizontal overflow or clipped content is introduced.
- [ ] Visual changes do not alter backend behaviour.

---

## [P2] Final Owner Polish regression, mobile QA and production sign-off

### Summary
Run the final release gate before the polished Admin is considered owner-ready.

### Acceptance criteria
- [ ] Full Commerce CI passes.
- [ ] Search Readiness passes.
- [ ] Targeted Admin browser QA passes.
- [ ] Inventory/Stocktake regression passes.
- [ ] Order/Reservation regression passes.
- [ ] Reports business/test isolation regression passes.
- [ ] iPhone Safari smoke covers Today, Orders, Products, Add Product, Stock, Stocktake and Reports.
- [ ] iPad portrait smoke covers login, master/detail, sheets/modals and Stocktake.
- [ ] No horizontal overflow exists in supported mobile layouts.
- [ ] Sticky footers do not obscure fields or result rows.
- [ ] Owner-facing pages contain no Phase/cutover/developer language.
- [ ] Staging test reset is verified safe.
- [ ] Production owner smoke remains explicit: Products/Stock check, one ordinary live order, Admin visibility, customer + owner email delivery, and no unexpected stock movement for an untracked baseline product.
- [ ] Final checklist and session handoff are updated with exact evidence/run IDs.
