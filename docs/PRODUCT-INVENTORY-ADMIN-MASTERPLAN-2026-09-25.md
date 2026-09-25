# Black Sheep — Product, Inventory & Admin Platform Masterplan

**Date:** 25 September 2026  
**Repository:** `Mo31D/Blacksheep`  
**Status:** PHASE 2 PRODUCT EDITOR DEPLOYED TO STAGING — owner mutation smoke-test pending  
**Purpose:** Define the next major platform phase before changing production product/inventory architecture.

---

## Architecture lock — 25 September 2026

Phase 0 is complete. The detailed locked specifications are:

- [Current catalogue field audit](./PRODUCT-CATALOG-FIELD-AUDIT-2026-09-25.md)
- [D1 schema specification](./PRODUCT-INVENTORY-D1-SCHEMA-SPEC-2026-09-25.md)
- [Inventory & reservation lifecycle](./INVENTORY-RESERVATION-LIFECYCLE-SPEC-2026-09-25.md)
- [Admin API contracts](./PRODUCT-ADMIN-API-CONTRACTS-2026-09-25.md)
- [Premium Product & Stock Admin UX](./PRODUCT-STOCK-ADMIN-UX-SPEC-2026-09-25.md)
- [Architecture lock summary](./PRODUCT-INVENTORY-ARCHITECTURE-LOCK-2026-09-25.md)

Key lock:
- D1 will become the operational source of truth.
- current static SEO URLs remain preserved during migration.
- all 146 products migrate deterministically.
- current products initially remain inventory-untracked until a real physical count.
- Product content is Draft → Publish.
- price/status/inventory are immediate audited operations.
- reviewed-order reservations are created when the reviewed version is sent.
- no Product/Inventory production migration has been created or applied.

## Phase 1 staging implementation — 25 September 2026

The Product Core / Read Only implementation is now live on **staging** and has passed deterministic parity.

Verified:
- `0009_product_inventory_foundation.sql` applied to staging only.
- 146 products / 146 default variants imported.
- 22 categories.
- 136 mapped media records.
- 499 structured product attributes.
- 146 legacy provenance records + 86 official provenance records.
- 4 explicit Out of stock + 14 Arriving soon preserved.
- 14 missing prices + 14 missing images preserved rather than invented.
- inventory tracked count = 0.
- parity result = **PASS / 0 mismatches**.
- staging Product Admin read-only list/detail/search/filter deployed.
- no Product write route exists.
- Production D1 remains `0000–0008` with 3 existing orders.

Evidence: [Product Core staging parity report](./PRODUCT-CORE-STAGING-PARITY-2026-09-25.md).

Remaining Phase 1 gate: manual visual inspection of the authenticated staging Products workspace on iPhone + desktop before Phase 2 write access.

## Phase 2 staging implementation — 25 September 2026

The premium Product Editor is now deployed on staging.

Implemented:
- Add Product → private Draft,
- atomic Quick Edit for price / SKU / barcode / selling status / online ordering,
- descriptive Draft editor for name / brand / type / description / categories,
- explicit Publish,
- Product and Variant optimistic concurrency,
- audit before/after history,
- Phase 1 iPhone polish and corrected actionable data-quality metrics.

Release evidence: [Phase 2 staging report](./PRODUCT-EDITOR-PHASE2-STAGING-2026-09-25.md).

Production remains intentionally isolated from Product Core.

## 1. Product vision

The Black Sheep Admin should become the single operational cockpit for the shop.

The target is not a generic ecommerce back office. It is a premium, owner-first operating system for one real retail business that happens to power a website.

The owner should be able to:

- see what needs attention immediately,
- add a product without touching GitHub,
- edit an existing product in seconds,
- change price or stock safely from an iPhone,
- upload/reorder product images,
- publish or unpublish a product,
- see current stock, incoming stock and reserved stock,
- understand why stock changed,
- find any product, order or customer from one search,
- move directly from an order to the relevant product,
- receive stock and supplier deliveries,
- see low-stock and missing-data warnings,
- know what changed, when, and by whom,
- keep the storefront, checkout and Admin consistent.

The system must remain simple at 150 products and still be structurally sound at several thousand.

---

## 2. Non-negotiable design principles

### 2.1 One source of operational truth

GitHub must remain source control for application code, but it must stop being the day-to-day product/inventory database.

Target operational truth:

- **D1:** products, variants, price, publishing state, inventory, suppliers, stock movements, audit history.
- **R2 / managed media layer:** owner-uploaded product media.
- **GitHub:** application code, migrations, builders, tests, deployment configuration.
- **Static/public storefront output:** a published projection of product data, not a manually maintained second database.

### 2.2 Inventory safety over visual convenience

A public page may be temporarily behind a product-content publication, but checkout must never use stale stock or stale price.

The Commerce API must ultimately validate price and orderability against D1 at request time.

### 2.3 No big-bang rewrite

The current 146-product catalogue, static product URLs, SEO work, basket, order flow and Admin V2 remain live throughout migration.

New product-management capability will be introduced behind the existing Admin and promoted in phases.

### 2.4 Premium simplicity

Do not expose database terminology, technical field names or generic ecommerce complexity to the owner.

Prefer:
- “In stock” over internal enum names.
- “Incoming” over transfer-state jargon.
- “Product details” over “metafields”.
- “Publish changes” over deployment language.
- “Why did stock change?” over raw event tables.

Advanced controls remain available but are progressively disclosed.

---

## 3. Target platform architecture

```text
                           BLACK SHEEP ADMIN
                                  |
          +-----------------------+-----------------------+
          |                       |                       |
       Orders                  Products                 Stock
          |                       |                       |
          +-----------------------+-----------------------+
                                  |
                         Commerce Worker API
                                  |
              +-------------------+-------------------+
              |                   |                   |
          D1 Orders          D1 Product Core      D1 Inventory
              |                   |                   |
              +-------------------+-------------------+
                                  |
                         Publication service
                            / public API
                                  |
              +-------------------+-------------------+
              |                                       |
      Public storefront                         Checkout/order API
      static SEO + live                         authoritative price/
      availability overlay                      availability validation
              |
          Product media
              |
          R2 / CDN layer
```

### Architecture rule

**D1 becomes authoritative for operational commerce.**

A product publication layer then feeds:
1. public cards/product pages,
2. search/filter data,
3. structured data,
4. the checkout catalogue,
5. Admin search,
6. reporting.

No product should need to be edited independently in several files.

---

## 4. Recommended product model

### 4.1 `products`

Core product identity/content.

Suggested fields:

- `id` — immutable UUID
- `legacy_id` — existing PR-/HC-/ROM-/HR- code when present
- `slug` — unique public URL slug
- `title`
- `subtitle` / range
- `brand`
- `description_short`
- `description_long`
- `product_type`
- `supplier_id`
- `publishing_status`
  - DRAFT
  - ACTIVE
  - ARCHIVED
- `sales_status`
  - AVAILABLE
  - OUT_OF_STOCK
  - ARRIVING_SOON
  - NOT_FOR_SALE
- `track_inventory`
- `featured`
- `seo_title`
- `seo_description`
- `created_at`
- `updated_at`
- `published_at`
- optimistic `version`

### 4.2 `product_variants`

Variants are supported from day one even where most current products have only one.

Fields:
- `id`
- `product_id`
- `sku`
- `barcode`
- `title`
- `price_minor`
- `compare_at_price_minor`
- `cost_minor`
- `weight_grams`
- `taxable`
- `requires_shipping`
- `is_default`
- `active`
- `version`

A single non-variant product gets one default variant internally.

This avoids a later destructive migration when sizes/colours/options are introduced.

### 4.3 `product_media`

- `id`
- `product_id`
- optional `variant_id`
- `storage_key`
- `public_url`
- `alt_text`
- `position`
- `width`
- `height`
- `mime_type`
- `file_size`
- `created_at`

### 4.4 Categories

Use normalized category records rather than free-text category drift:

- `categories`
- `product_categories`

Support:
- Peter Rabbit
- Highland Cows
- Ice Cream
- Romney's
- Hawkshead Relish
- Mugs & Tableware
- Soft Toys
- Seasonal / Christmas
- future categories

---

## 5. Inventory model

### 5.1 Inventory quantities

Per variant + location:

- **On hand** — physically counted stock.
- **Reserved** — stock set aside for an active reviewed order.
- **Available** — on hand minus active reservations.
- **Incoming** — confirmed stock expected from supplier/transfer.
- **Safety stock** — optional quantity intentionally hidden from sale.

Do not store “available” as an independent manually editable truth if it can be derived.

### 5.2 Location model

Create multi-location structure now even though initial production has one retail location:

`Black Sheep Shop — Ambleside`

This prevents a schema rewrite if storage/back-room/second shop is added.

Tables:
- `inventory_locations`
- `inventory_balances`

### 5.3 Immutable stock ledger

Every stock change creates an `inventory_movements` record.

Movement types:

- INITIAL_COUNT
- MANUAL_COUNT
- SALE
- ORDER_RESERVATION
- RESERVATION_RELEASE
- RETURN
- DAMAGE
- LOSS
- SUPPLIER_RECEIPT
- CORRECTION
- TRANSFER_IN
- TRANSFER_OUT

Each movement records:
- product/variant
- location
- signed quantity
- reason
- related order / PO / transfer if applicable
- owner identity
- timestamp
- resulting balance snapshot

This is critical. Quantity should never silently change with no explanation.

---

## 6. Order ↔ inventory integration

The current Black Sheep workflow is not a conventional instant-payment checkout, so stock logic must match the real process.

Recommended lifecycle:

### Customer submits request
- Check current orderability.
- Do **not** permanently deduct stock.
- Record demand.

### Owner reviews order
- Owner can confirm, reduce, remove or substitute items.
- Admin shows live available stock beside each line.

### Reviewed quote finalized
- Create stock reservation for the confirmed reviewed quantities.
- Reservation has clear expiry/release rules.
- Available stock drops immediately.

### Customer pays
- Reservation becomes committed to the paid order.

### Order completed / shipped / collected
- Convert reservation into final SALE stock movement.

### Order cancelled / review declined / reservation expired
- Release reservation back to Available.

### Refund
A refund is financial, not automatically a stock return.

If physical goods return:
- owner explicitly records “Returned to stock”,
- then a RETURN stock movement is created.

This prevents financial events from silently corrupting physical inventory.

---

## 7. Media architecture

### Current problem

Product images currently live mainly inside the repository. That is acceptable for curated developer-managed content but unsuitable for owner product management.

### Target

Owner uploads should use a managed media layer:
- Cloudflare R2 as durable object storage,
- CDN/public delivery URL,
- image metadata in D1.

Admin should support:
- drag/drop,
- iPhone photo upload,
- multi-image upload,
- reordering,
- primary image selection,
- alt text,
- remove/replace,
- duplicate detection later,
- image size/quality warning,
- automatic WebP/AVIF delivery where the delivery layer supports it.

Existing repository images do not need immediate migration. Old and new media can coexist during transition.

---

## 8. Storefront publication model

This is the most important integration decision.

### Operational state

Price, orderability and inventory must be read from D1 by Commerce.

### SEO/public product content

The current static canonical product architecture should be preserved during transition.

Use two layers:

1. **Published static snapshot**
   - title
   - description
   - images
   - category
   - schema/SEO
   - canonical product page

2. **Live commerce overlay**
   - price
   - stock state
   - orderability
   - low-level availability

This means an owner stock change can be effective immediately without waiting for a site rebuild.

### Later publication improvement

Once the Product Admin is stable, move the storefront build/deployment pipeline to a publication process that can rebuild static catalogue pages from D1 automatically.

GitHub continues to version application code, not individual daily product edits.

---

## 9. Premium Admin information architecture

Keep the main navigation intentionally small.

### 9.1 Today

The owner lands here.

Show only actionable information:

- Orders needing review
- Awaiting payment
- Ready for collection
- Delivery waiting to dispatch
- Out of stock
- Low stock
- Incoming today / overdue
- Draft products
- Products missing price/image
- Recent important activity

No vanity analytics above operational work.

### 9.2 Orders

Keep the current Admin V2 workflow and progressively integrate live stock.

### 9.3 Products

Primary catalogue workspace.

Desktop:
- left/centre searchable product list,
- persistent filters,
- optional table/grid toggle,
- right-side editor drawer or split view.

Mobile:
- searchable product cards,
- one-tap Quick Edit,
- full editor as a focused sheet/page,
- sticky Save/Publish controls.

### 9.4 Stock

Dedicated inventory workspace:
- search / scan,
- current on-hand,
- reserved,
- available,
- incoming,
- low-stock indicator,
- quick + / − adjustment,
- adjustment reason required,
- bulk count mode,
- movement history.

### 9.5 Suppliers / Incoming

Later phase:
- suppliers,
- purchase orders,
- expected deliveries,
- partial receiving,
- discrepancies,
- cost updates.

### 9.6 Reports

Existing operational reports remain and later gain:
- stock value,
- sell-through,
- days of stock,
- stock-outs,
- dead stock,
- margin,
- supplier performance,
- inventory adjustment variance.

---

## 10. Product list UX — designed for speed

Each product row/card should show only:

- thumbnail
- product name
- SKU
- price
- Available quantity
- status badge
- one attention indicator if needed

Do not force the owner into the full editor for common changes.

### Quick actions

From each row:
- Change stock
- Change price
- Mark out of stock
- Mark arriving soon
- Duplicate
- Archive
- Open full editor

### Smart filters

One tap:
- All
- In stock
- Low stock
- Out of stock
- Incoming
- Draft
- Missing image
- Missing price
- Recently changed

### Universal search

One search should find:
- product title
- SKU
- barcode
- brand
- supplier
- product code
- order reference

---

## 11. Product editor UX

A full product should not appear as one extremely long form.

Use sections:

### Essentials
- title
- short description
- category
- brand
- status

### Media
- visual gallery
- drag reorder
- choose primary
- upload

### Selling
- price
- variant prices
- sale/compare price later

### Inventory
- SKU/barcode
- tracked/untracked
- current stock
- low-stock threshold
- incoming

### Details
- dimensions
- material
- packaging
- suitability
- care
- weight
- supplier code

### Storefront
- visibility
- collection placement
- featured flag
- preview

### SEO
- slug
- SEO title
- meta description
- search preview

### History
- who changed what
- when
- previous value
- restore where safe

---

## 12. Save and publish model

Avoid Shopify-style uncertainty about what changed across a large form.

### Draft editing

Edits autosave as a private draft where appropriate.

Admin always shows:
- **Saved**
- **Unsaved**
- **Draft changes**
- **Live**

### Publish

Content changes use an explicit **Publish changes** action.

Before publish, show a compact diff:
- Title changed
- Price £X → £Y
- Image replaced
- Stock status changed

### Immediate operational actions

Some actions should not wait for content publication:
- stock adjustment
- mark out of stock
- reservation release

They take effect immediately, with confirmation + audit history.

---

## 13. Bulk editing

Bulk editing must be fast but safer than a generic spreadsheet.

Modes:
- Price
- Stock count
- Status
- Category
- Supplier
- Low-stock threshold

Safety:
- explicit selected-product count
- preview changes
- conflict/version check
- reason required for stock movements
- undo batch where mathematically safe
- audit batch ID

For stock, bulk entry should create ledger movements rather than silently overwrite quantity.

---

## 14. Add-product workflow

The owner should be able to add a real product from an iPhone in roughly one minute.

### Fast path

1. Tap **Add product**.
2. Add photo(s).
3. Product name.
4. Price.
5. Stock quantity.
6. Category.
7. Optional SKU/barcode.
8. Save draft or Publish.

Everything else is optional and can be completed later.

### Quality guard

Before publish, Admin warns rather than blocks unnecessarily:
- no image
- no price
- duplicate SKU
- duplicate barcode
- duplicate/near-duplicate title
- missing category
- inventory tracking inconsistent

---

## 15. Barcode / mobile operations

Design for later barcode support from the start.

Use cases:
- find product
- stock count
- receive supplier delivery
- add product by barcode
- pick order

Do not make barcode support a prerequisite for the first Product Admin release.

---

## 16. Audit and permissions

Every product/inventory mutation should record:
- actor
- timestamp
- entity
- before
- after
- reason when required
- request/idempotency key where relevant

Initially there may be only one owner login, but data design should support future roles:

- Owner
- Manager
- Staff
- Read only

Permission boundaries later:
- change price
- adjust stock
- publish product
- refund
- manage users/settings

---

## 17. Visual system — premium from day one

The Admin should remain recognisably Black Sheep but not imitate the public storefront literally.

### Tone
- warm ivory workspace
- deep near-black navigation
- restrained brass/gold accent
- white content surfaces
- strong typography hierarchy
- status colours used only when meaningful

### Layout
- desktop application shell
- 240–260px navigation rail or compact adaptive rail
- command/search bar
- large usable content canvas
- split-view details where appropriate
- drawers/sheets for quick edits
- bottom navigation on small mobile if it improves reachability

### Interaction
- 44px+ touch targets
- keyboard navigation on desktop
- visible focus
- optimistic but reversible UI where safe
- skeleton loading rather than layout jumping
- short, precise confirmations
- avoid modal-on-modal workflows
- no horizontal overflow on iPhone

### Premium does not mean decorative

The highest-value premium traits are:
- speed,
- calm information density,
- predictable placement,
- excellent spacing,
- almost no unnecessary navigation,
- clear system state,
- strong undo/audit behaviour.

---

## 18. Where this can be simpler than a generic platform

The objective is not to copy Shopify and recolour it.

A general platform must expose many capabilities for many business models. Black Sheep can be much more direct because the real workflow is known.

Examples of deliberate simplification:

- one prominent stock action rather than multiple inventory menus,
- one product workspace instead of separate product/custom-data concepts for routine fields,
- customer/order context visible beside product stock,
- direct “Open order” from owner email,
- product completeness warnings relevant to this shop,
- supplier receipt workflow matched to the shop's actual ordering process,
- no irrelevant app/channel controls in everyday product editing.

The benchmark is lower cognitive load and fewer steps for the owner's real tasks.

---

## 19. Migration of the current 146 products

### Do not manually re-enter them.

Build a deterministic importer from the current catalogue into D1.

Migration sequence:

1. freeze a source snapshot,
2. validate all 146 identities/slugs,
3. create D1 product + default variant records,
4. import categories/brands/SKUs/prices/statuses,
5. map existing images as legacy media URLs,
6. verify counts and uniqueness,
7. compare generated D1 export to current catalogue,
8. enable Admin read-only view,
9. only then enable editing.

No public behaviour changes during the initial import.

---

## 20. Proposed database objects

Initial foundation:

- `products`
- `product_variants`
- `categories`
- `product_categories`
- `product_media`
- `suppliers`
- `inventory_locations`
- `inventory_balances`
- `inventory_movements`
- `inventory_reservations`
- `product_audit_events`
- `catalog_publications`

Later:
- `purchase_orders`
- `purchase_order_lines`
- `inventory_transfers`
- `inventory_transfer_lines`
- `stock_counts`
- `stock_count_lines`

---

## 21. API surface direction

Admin:
- `GET /admin/api/products`
- `POST /admin/api/products`
- `GET /admin/api/products/:id`
- `PATCH /admin/api/products/:id`
- `POST /admin/api/products/:id/publish`
- `POST /admin/api/products/:id/media`
- `DELETE /admin/api/products/:id/media/:mediaId`
- `GET /admin/api/inventory`
- `POST /admin/api/inventory/adjustments`
- `GET /admin/api/products/:id/history`

Public/commerce:
- `GET /v1/catalog/public`
- `GET /v1/catalog/products/:slug`
- order validation reads the same D1 product/variant truth.

All mutation routes:
- authenticated,
- same-origin protected,
- schema validated,
- idempotent where replay is plausible,
- optimistic concurrency controlled,
- audited.

---

## 22. Implementation phases

### Phase 0 — Architecture lock
No production behaviour change.

- finalize schema,
- finalize product status semantics,
- finalize inventory/reservation lifecycle,
- finalize media strategy,
- inventory current catalogue mapping,
- write migrations and fixtures only after review.

### Phase 1 — Product Core + read-only Admin
- D1 product tables,
- import current 146 products,
- product list/search in Admin,
- product detail read-only,
- compare D1 vs legacy catalogue,
- no write path yet.

### Phase 2 — Product editing
- create product,
- edit product,
- price,
- category,
- description,
- status,
- SKU/barcode,
- audit trail,
- draft/publish workflow.

### Phase 3 — Media
- R2 upload,
- reorder,
- primary image,
- alt text,
- delete/replace,
- mobile image UX.

### Phase 4 — Inventory Core
- on-hand/available/reserved/incoming,
- stock adjustments,
- movement ledger,
- low-stock thresholds,
- out-of-stock automation rules,
- stock history.

### Phase 5 — Order reservations
- reviewed quote reservations,
- release rules,
- paid/fulfilled stock movements,
- cancellation/release,
- returns-to-stock explicit action.

### Phase 6 — Storefront integration
- D1 authoritative checkout pricing/orderability,
- live price/availability overlay,
- static product publication from canonical product core,
- eliminate manual catalogue duplication.

### Phase 7 — Supplier / receiving
- suppliers,
- incoming deliveries,
- purchase orders,
- partial receiving,
- cost capture,
- discrepancies.

### Phase 8 — Advanced operations
- stock value,
- sell-through,
- reorder suggestions,
- barcode workflows,
- roles/permissions,
- richer exports/imports.

---

## 23. First implementation slice

When implementation begins, do **not** start with a visual mockup alone.

First slice should produce:

1. migration/spec for core product tables,
2. deterministic importer for all current products,
3. read-only Product Admin screen using real D1 data,
4. parity report proving no catalogue loss,
5. premium shell/navigation update only after the data path is correct.

That establishes the foundation without risking current commerce.

---

## 24. Acceptance bar

The Product/Inventory phase is not considered successful because forms exist.

It is successful when the owner can:

- find a product in seconds,
- change its price safely,
- mark it out of stock instantly,
- add a new product without GitHub,
- upload an image from an iPhone,
- see that the storefront and checkout agree,
- explain every stock change from history,
- see stock implications while reviewing an order,
- recover from a mistaken edit,
- complete common tasks with fewer decisions and screens than a generic ecommerce admin.

---

## 25. Explicit anti-goals for the first release

Do not add yet:

- customer accounts,
- automatic payment refunds,
- multi-currency,
- marketplace/channel management,
- complex promotion engine,
- multi-warehouse optimization,
- accounting suite,
- AI-generated product copy as an automatic publishing mechanism.

Those can attach later without compromising the product/inventory foundation.

---

## 26. Decision summary

Recommended direction:

**D1 product/inventory source of truth + existing Worker/Admin + managed media + preserved static SEO publication layer.**

This is the lowest-risk path from the current architecture to a genuinely integrated retail platform.

The immediate next engineering milestone is **Phase 0 architecture lock**, followed by a **read-only D1-backed Product workspace** before any owner write access is enabled.
