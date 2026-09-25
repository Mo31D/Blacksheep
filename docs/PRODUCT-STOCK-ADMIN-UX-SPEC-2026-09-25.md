# Black Sheep — Premium Product & Stock Admin UX Specification

**Date:** 25 September 2026  
**Status:** ARCHITECTURE LOCKED  
**Goal:** Build an owner-first retail operating board with lower cognitive load than a generic ecommerce back office.

---

## 1. UX principle

The Admin is not a website CMS with inventory added later.

It is the operational cockpit for:
- orders,
- products,
- stock,
- incoming goods,
- customer communication,
- business exceptions.

The interface should answer:
1. What needs my attention?
2. What changed?
3. What can I do safely in one or two actions?
4. Is this change already live?

---

## 2. Main navigation

Recommended desktop navigation:

1. Today
2. Orders
3. Products
4. Stock
5. Incoming
6. Reports

Secondary:
- Settings
- Log out

Do not create separate top-level areas for every technical concept.

Suppliers initially live inside Incoming and Product supplier context until workflow volume justifies a dedicated top-level area.

### Mobile navigation

Recommended compact navigation:
- Today
- Orders
- Products
- Stock
- More

More contains:
- Incoming
- Reports
- Settings
- Log out

---

## 3. Global search / command bar

The current order-only search becomes universal.

One search field covers:
- product title,
- SKU,
- barcode,
- legacy product code,
- order reference,
- customer name/email,
- supplier product code.

Desktop shortcut:
- / or Cmd/Ctrl + K.

Results group by entity:
- Products
- Orders
- Customers/orders
- Suppliers later

Each result shows only the context needed to identify it.

---

## 4. Today board

The default landing view should become operations-first rather than analytics-first.

Priority modules:
- Orders to review
- Awaiting payment
- Ready for collection
- Delivery waiting to dispatch
- Out of stock
- Low stock
- Incoming overdue
- Draft products
- Missing price
- Missing image
- Email delivery problems

Rules:
- hide empty modules,
- sort urgent work first,
- every module opens a filtered working list,
- revenue/performance remains available lower on the page.

The owner should see operational work before vanity metrics.

---

## 5. Products workspace — desktop

Use split-view.

Left/centre:
- search,
- filters,
- scrollable product list.

Right:
- selected product summary,
- quick actions,
- full editor when needed.

Each list row shows:
- 48–56px thumbnail,
- product title,
- SKU or legacy ID fallback,
- price,
- Available quantity or Untracked,
- one selling/publication badge,
- at most one warning indicator.

Avoid wide Shopify-style data tables that force horizontal scanning.

---

## 6. Product filters

Persistent one-tap filters:
- All
- Active
- Draft
- In stock
- Low stock
- Out of stock
- Arriving
- Untracked
- Missing image
- Missing price
- Data warning
- Recently changed

Advanced filter sheet:
- category
- brand
- supplier
- online ordering
- update date

Active filters appear as removable chips.

---

## 7. Quick Edit

Common operations must not require the full editor.

Quick Edit supports:
- price,
- selling status,
- online ordering on/off,
- stock count/adjustment if tracked,
- low-stock threshold,
- incoming stock.

Every action clearly says whether it is:
- Live immediately
- Draft only

Example:

**Price**
£9.50 → £10.00

This changes checkout immediately.

[Cancel] [Update price]

---

## 8. Full product editor

Avoid one long form.

Header:
- thumbnail,
- title,
- selling/publication status,
- Live / Draft indicator,
- Save state,
- Publish changes,
- More menu.

Sections:

### Overview
- title
- short description
- category
- brand
- product type
- public status

### Media
- gallery
- upload
- reorder
- primary image
- alt text

### Selling
- price
- variants
- SKU/barcode
- online ordering
- selling status

### Inventory
- tracking state
- per-location balance
- low-stock threshold
- incoming
- movement/history shortcut

### Details
Category-aware facts:
- dimensions
- material
- pack
- ingredients
- allergens
- care
- storage
- etc.

### Storefront
- publication state
- collection placement
- featured
- public note
- preview

### SEO
- slug
- SEO title
- meta description
- canonical preview
- old slug redirect history

### History
- actor
- time
- before/after
- linked stock history where relevant

Mobile uses focused sections/accordions rather than a desktop form scaled down.

---

## 9. Draft vs Live clarity

Always show one clear state:
- Live
- Draft changes
- Not published
- Archived

Autosave may save draft content, but it must never imply publication.

Example header:

**Live · Draft changes saved 14:32**

[Preview draft] [Publish 4 changes]

Publish confirmation shows a concise diff:
- Title changed
- Category changed
- Primary image changed
- Description changed

Price and stock operations say **Live immediately**.

---

## 10. Add product — fast path

Target: a simple single-variant product can be added from iPhone in roughly one minute.

Fast flow:
1. photo,
2. product name,
3. price,
4. category,
5. stock quantity or Count later,
6. optional SKU/barcode,
7. Save draft or Review & publish.

After save, optional enrichment:
- description,
- extra media,
- supplier,
- product facts,
- SEO.

Do not block a useful draft because optional metadata is absent.

---

## 11. Product completeness

Show one compact quality state:
- Complete
- 2 things to finish

Warnings can include:
- Missing image
- Missing price
- No category
- Duplicate SKU
- Source warning
- Missing alt text
- Draft not published

Each warning links directly to the relevant control.

---

## 12. Stock workspace

Stock is a dedicated quantity-operations workspace, not a copy of Products.

Header:
- search/scan,
- location,
- filters,
- Count mode.

Each row/card shows:
- image,
- product title,
- SKU,
- On hand,
- Reserved,
- Available,
- Incoming,
- low-stock state.

Primary action:
- Adjust

Secondary:
- Count
- History
- Incoming

---

## 13. Adjust stock sheet

Ask for intent, not ledger math.

Choices:
- Count stock
- Received stock
- Damaged
- Lost
- Correction
- Return to stock
- Safety stock

Example:

**Damaged stock**  
Current on hand: 8  
How many were damaged? 1  
Resulting on hand: 7

[Record damage]

The system computes the correct movement internally.

---

## 14. Count mode

Designed for walking around the physical shop with an iPhone.

Features:
- large image/title,
- current system count,
- numeric physical count,
- Save & next,
- category filter,
- progress,
- barcode scan later,
- conflict warning if quantity changes during the count.

Each saved count creates a correction movement; history is never overwritten.

---

## 15. Incoming workspace

Purpose:
**What have I ordered, what is arriving, and what arrived today?**

Cards show:
- supplier/source,
- product,
- expected quantity,
- received quantity,
- expected date,
- status.

Actions:
- Receive all
- Receive partial
- Change expected date
- Cancel incoming
- Open product

After receiving an ARRIVING_SOON product:
- show new on-hand/available,
- ask whether to make it available for online ordering.

---

## 16. Order integration

Current order review line gains stock context:

**Requested 3 · Available 2 · Incoming 6**

If insufficient:
- inline warning,
- Reduce quantity,
- Substitute,
- Mark unavailable,
- View stock.

Substitute picker ranks:
- available products first,
- arriving/out-of-stock clearly unavailable.

After reviewed version is sent:
- show Reserved quantity,
- show reservation expiry.

---

## 17. Product ↔ order context

Product detail can show:
- current reserved quantity,
- active orders holding stock,
- recent sales,
- incoming quantity.

Customer PII remains inside order context rather than appearing broadly in product/stock lists.

---

## 18. Visual direction

The Admin remains recognisably Black Sheep but behaves like a modern application.

### Palette
- warm ivory app background,
- near-black navigation,
- white/cream working surfaces,
- restrained brass/gold accent,
- fine neutral borders.

### Typography
- serif only for selective page/product titles,
- high-legibility sans for data and controls,
- tabular numerals for price/quantity where supported.

### Density
- compact but calm,
- no marketing-sized empty space,
- 44px+ important touch targets,
- enough rows visible to scan real stock quickly.

### Status colour
- green: healthy/live/available
- amber: action/incoming/low
- red: blocked/out/error
- neutral: draft/untracked

Never rely on colour alone.

---

## 19. Interaction standards

- skeletons for loading,
- local retry for local failures,
- toast for short success only,
- persistent inline error for unresolved failure,
- sticky Save/Publish on mobile,
- no nested modal stacks,
- Escape closes sheets on desktop,
- focus returns to trigger,
- destructive actions name the product,
- draft edits survive navigation where practical.

---

## 20. Accessibility

Minimum quality bar:
- WCAG AA contrast target,
- semantic controls,
- visible focus,
- keyboard product-list navigation,
- accessible icon labels,
- 44px important mobile touch targets,
- no horizontal overflow at iPhone widths,
- status never conveyed by colour only,
- dialogs/sheets trap focus correctly.

---

## 21. Performance

At current scale the Admin should feel immediate.

Rules:
- list endpoints paginated/cursor-based,
- detail fetched only when selected,
- thumbnails appropriately sized,
- full descriptions/media excluded from list payload,
- mutations update the affected row/card instead of reloading the whole app,
- filter/search state preserved.

---

## 22. Task benchmark

The target is not universal feature superiority over Shopify.

The benchmark is fewer decisions and fewer screens for Black Sheep's actual work.

| Task | Black Sheep target |
|---|---|
| Mark product out of stock | 1 quick action + confirmation |
| Change price | Quick Edit, no full page |
| Physical count | Stock Count mode |
| Add simple product | One focused flow |
| See why stock changed | One History action |
| See order holding stock | Product/Stock context |
| Reply to order | Owner email or Admin order |
| Receive stock | Incoming → Receive |
| Find product/order | One universal search |
| Know if edit is public | Always-visible Live/Draft state |

This task-based standard is the UX acceptance benchmark.

---

## 23. Responsive model

### Desktop
- persistent navigation rail,
- top command bar,
- split list/detail view,
- drawers for quick operations.

### Tablet
- compact rail,
- split view where practical,
- full-height sheets.

### iPhone
- compact/bottom navigation,
- one primary task per screen,
- sticky action area,
- bottom sheets for Quick Edit,
- no miniaturized desktop tables.

---

## 24. Phase 1 read-only release

Phase 1 should already look like the final premium application.

It includes:
- Products navigation,
- universal product search,
- filters,
- real thumbnails,
- price/status,
- Untracked stock state,
- read-only product detail,
- completeness warnings.

But it has:
- no product mutation,
- no Add Product write path,
- no stock adjustment.

This validates both data parity and UX before owner write risk is introduced.
