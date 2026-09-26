# Black Sheep Admin — Final Owner Polish Tickets

Date: 26 September 2026  
Repository: `Mo31D/Blacksheep`  
Branch: `main`

> GitHub Issues are currently disabled for this repository. This file is the authoritative Final Owner Polish execution backlog. All automated/code acceptance criteria below were completed on 26 September 2026; the only remaining acceptance is the owner's real-device/live-order Production smoke.

---

## Execution status — 26 September 2026

- Production migration: `0013_order_data_class.sql` applied successfully.
- Pre-existing Production test orders preserved as hidden TEST history: **6**.
- Normal Production Business Orders after clean start: **0**.
- Active/committed Production reservations at clean start: **0**.
- Production Worker version: `4b600893-2a71-40e0-8fea-9d7f4cad34dd`.
- Production guarded deploy workflow: `36245568191` — SUCCESS.
- Final staging deploy: `36245227443` — SUCCESS; Worker `30cac36f-516f-4902-b733-60c4eb7b6ec5`.
- Final expanded Admin browser QA: `36245380428` — SUCCESS.
- Final code-level Commerce CI for the owner-polish code: `36245167048` — SUCCESS.
- Search Readiness on the cleaned final tree: `36245693923` — SUCCESS.

# P0 — Must fix before owner-ready sign-off

## [P0] Isolate test/E2E orders from business data and add a safe staging reset

### Summary
Separate synthetic QA/E2E orders from real business orders so Dashboard, Reports and normal Admin workflows are not polluted by test activity. Add a guarded staging-only reset flow for test orders.

### Acceptance criteria
- [x] Orders have an explicit internal classification such as `BUSINESS`, `TEST`, `E2E` or equivalent.
- [x] Newly-created automated QA/E2E orders are classified explicitly.
- [x] Existing identifiable QA/E2E orders are classified or migrated safely.
- [x] Default Dashboard and Reports exclude test/E2E orders.
- [x] Normal Orders list excludes test/E2E orders unless a test-data filter is selected.
- [x] Staging exposes a guarded reset action requiring an explicit confirmation phrase.
- [x] Reset clears only TEST/E2E orders from normal owner-facing Admin state while preserving their audit history.
- [x] Reset cannot delete real business orders, Products, Product Media or unrelated inventory history.
- [x] Production does not expose an unsafe reset control.
- [x] Automated tests cover classification, reporting exclusion and reset safety.
- [x] Commerce CI and targeted Admin staging regression pass.

---

## [P0] Remove phase/staging implementation language from owner-facing Admin copy

### Summary
Replace development-phase terminology in the Admin UI with stable owner-facing language.

### Acceptance criteria
- [x] No owner-facing page uses internal Phase numbering as normal UI language.
- [x] Products intro describes catalogue management, not staging/cutover implementation.
- [x] Stock intro describes stock operations rather than ledger implementation details.
- [x] Add Product copy no longer refers to a dedicated Media phase.
- [x] Labels such as `Staging Product Core`, `Phase 2 · Editing`, `Phase 4 · Staging` and `before storefront cutover` are removed from normal owner workflows.
- [x] Staging remains identifiable through a small environment indicator, not core page copy.
- [x] Automated UI assertions protect the revised copy from regression.

---

## [P0] Rework Stocktake conflict handling into owner-friendly review and retry UX

### Summary
Turn current Stocktake technical conflicts into a recoverable owner workflow without weakening Inventory Core concurrency guarantees.

### Acceptance criteria
- [x] Results distinguish `Updated`, `No change` and `Needs review`.
- [x] `Inventory Already Tracked` is not presented as a generic technical failure.
- [x] Concurrency conflicts explain that stock changed while counting.
- [x] A `Review N items` path shows only affected rows.
- [x] Owner can recount/retry affected products without repeating the entire Stocktake.
- [x] No conflict path silently overwrites a newer balance.
- [x] Sticky result actions do not cover rows on iPhone/iPad.
- [x] Inventory ledger immutability and concurrency tests remain green.
- [x] Targeted staging Stocktake browser regression passes on mobile.

---

# P1 — Owner workflow and mobile polish

## [P1] Compact the Dashboard mobile layout and restore 2×2 KPI hierarchy

### Summary
Polish the Today/Dashboard mobile layout so primary metrics are compact and balanced.

### Acceptance criteria
- [x] Revenue, Orders, Awaiting payment and Ready for collection render as a 2×2 grid on iPhone widths.
- [x] No orphan KPI card appears alone on a row.
- [x] Vertical whitespace before the Revenue chart is reduced.
- [x] Revenue chart remains fully readable.
- [x] No horizontal overflow is introduced.
- [x] iPad portrait and desktop remain coherent.

---

## [P1] Replace Admin bottom-nav symbols with a consistent SVG icon system

### Summary
Replace generic geometric/Unicode symbols with a consistent local SVG icon set.

### Acceptance criteria
- [x] Today, Orders, Products, Stock and Reports use SVG icons from one visual system.
- [x] Icon sizing and optical weight are consistent.
- [x] Active state is clear without relying on icon shape alone.
- [x] Labels remain visible and accessible.
- [x] No external icon CDN/runtime dependency is introduced.
- [x] Mobile safe-area behaviour remains correct.

---

## [P1] Polish Orders mobile hierarchy, filters and compact header

### Summary
Reduce the vertical cost of the Orders page and improve scanability on mobile.

### Acceptance criteria
- [x] Refresh is compact and no longer consumes a large standalone row.
- [x] Orders KPIs use a balanced 2×2 mobile grid.
- [x] Status pills scroll horizontally without appearing accidentally clipped.
- [x] Right-edge padding/fade or equivalent cue makes more filters discoverable.
- [x] Order reference, customer, time/fulfilment, status and total have clear visual hierarchy.
- [x] Prices do not visually compete with interactive order links.
- [x] No horizontal overflow on iPhone/iPad portrait.
- [x] Existing order actions and master/detail behaviour remain intact.

---

## [P1] Polish Products list hierarchy and reduce repetitive Untracked noise

### Summary
Keep the existing Products architecture while improving scanability.

### Acceptance criteria
- [x] Product title remains the primary interactive element.
- [x] Price uses a non-link visual treatment.
- [x] Repeated `Untracked` state does not dominate every row.
- [x] Out of stock / Arriving / actionable states remain clearly visible.
- [x] Search, sort and filters retain existing functionality.
- [x] Rows remain legible on narrow iPhone widths.
- [x] Desktop split-view remains functionally unchanged.

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
- [x] Product name is clearly required.
- [x] Product type is selected from controlled values rather than arbitrary free text.
- [x] Essential fields are grouped separately from optional details.
- [x] Owner can create a valid private Draft quickly on iPhone.
- [x] After creation, full editor opens for images, content, availability, inventory and publication.
- [x] Existing UUID/slug generation and uniqueness protections remain unchanged.
- [x] Product stays private until explicitly published.
- [x] Validation errors are owner-friendly and field-specific.

---

## [P1] Replace flat Add Product category cards with compact searchable multi-select

### Summary
Make category selection efficient on mobile without unnecessarily changing Product Core relationships.

### Acceptance criteria
- [x] Category picker is searchable.
- [x] Multiple categories can be selected/deselected efficiently.
- [x] Category rows no longer consume near-full-screen height each.
- [x] Existing category IDs and relationships remain compatible.
- [x] Visual grouping can distinguish Brand/Range, Product category and Collection/Theme without silently changing persisted semantics.
- [x] Selected categories remain obvious while scrolling.
- [x] Keyboard and touch interaction work on iPhone/iPad.

---

## [P1] Fix sticky Product editor footer overlap and mobile safe-area spacing

### Summary
Ensure sticky Add/Edit Product actions never cover the final fields.

### Acceptance criteria
- [x] Scroll container includes sufficient bottom padding for footer + safe area.
- [x] Final field/category can be fully scrolled above the action footer.
- [x] Footer remains sticky and usable.
- [x] iPhone Safari browser chrome does not make fields unreachable.
- [x] iPad portrait behaves correctly.
- [x] Desktop drawer/editor behaviour is not regressed.

---

## [P1] Simplify Stock overview terminology and prioritize actionable inventory KPIs

### Summary
Make the Stock workspace easier for the owner to understand.

### Acceptance criteria
- [x] Untracked products use owner-facing wording such as `Stock tracking not started`.
- [x] A clear `Start stock tracking` action exists in the relevant flow.
- [x] Primary KPIs emphasize Tracked, Low stock, Out of stock and Incoming.
- [x] Total products / needing initial count can be shown as a compact summary instead of oversized duplicate cards.
- [x] `Available —` does not look like broken data.
- [x] Stock search/location/filter controls remain intact.
- [x] Inventory semantics and ledger guarantees are unchanged.

---

## [P1] Clarify Reports semantics and make operational exceptions actionable

### Summary
Keep the existing Reports design while clarifying metric meaning and improving actionability.

### Acceptance criteria
- [x] `Payment funnel` is renamed or recalculated so its meaning is unambiguous.
- [x] Current-state charts and historical-stage metrics are not presented as the same concept.
- [x] Email delivery exception rows can open the related order.
- [x] Resolved versus active failures can be distinguished.
- [x] `What to act on` links each item directly to the relevant workflow.
- [x] Top products, customers, cancellation rate, busiest hour and ageing queue exclude test/E2E data by default.
- [x] Reports remain readable on iPhone without horizontal overflow.

---

# P2 — Final consistency and release gate

## [P2] Final Admin visual consistency pass: spacing, typography and microcopy

### Summary
Apply one final cross-screen visual consistency pass after functional polish is complete.

### Acceptance criteria
- [x] Shared spacing and typography rules are consistent across all five Admin sections.
- [x] Buttons with the same role use consistent dimensions.
- [x] Status terminology is consistent across Orders, Products, Stock and Reports.
- [x] Empty states are clear and non-technical.
- [x] No internal implementation jargon remains in normal owner workflows.
- [x] No new horizontal overflow or clipped content is introduced.
- [x] Visual changes do not alter backend behaviour.

---

## [P2] Final Owner Polish regression, mobile QA and production sign-off

### Summary
Run the final release gate before the polished Admin is considered owner-ready.

### Acceptance criteria
- [x] Full Commerce CI passes.
- [x] Search Readiness passes.
- [x] Targeted Admin browser QA passes.
- [x] Inventory/Stocktake regression passes.
- [x] Order/Reservation regression passes.
- [x] Reports business/test isolation regression passes.
- [x] iPhone Safari smoke covers Today, Orders, Products, Add Product, Stock, Stocktake and Reports.
- [x] iPad portrait smoke covers login, master/detail, sheets/modals and Stocktake.
- [x] No horizontal overflow exists in supported mobile layouts.
- [x] Sticky footers do not obscure fields or result rows.
- [x] Owner-facing pages contain no Phase/cutover/developer language.
- [x] Staging test reset is verified safe.
- [ ] Production owner smoke remains explicit: Products/Stock check, one ordinary live order, Admin visibility, customer + owner email delivery, and no unexpected stock movement for an untracked baseline product.
- [x] Final checklist and session handoff are updated with exact evidence/run IDs.
