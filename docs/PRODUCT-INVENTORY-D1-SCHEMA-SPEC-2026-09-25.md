# Black Sheep — Product & Inventory D1 Schema Specification

**Date:** 25 September 2026  
**Status:** ARCHITECTURE LOCKED — specification only  
**Important:** No production migration is created or applied by this document.

---

## 1. Locked decisions

1. D1 becomes the operational source of truth for products, prices, inventory and product-management history.
2. GitHub remains source control for code/migrations/builders, not daily product editing.
3. New entities use immutable UUID text primary keys.
4. Existing catalogue IDs remain unique legacy_catalog_id values.
5. Money uses integer minor units, never floating-point.
6. Timestamps use UTC ISO-8601 strings.
7. Mutable operational rows use integer version fields for optimistic concurrency.
8. Products are archived rather than hard-deleted once referenced.
9. Descriptive storefront content is versioned separately from immediate operational fields.
10. Price, sell-status and stock operations can take effect immediately and are audited.
11. Descriptive content follows Draft → Publish.
12. Historical slugs are preserved.
13. Flexible product facts are structured attributes; inventory never hides inside JSON.
14. No current stock quantity is inferred during migration.

Proposed first migration name when Phase 1 begins:
- 0009_product_inventory_foundation.sql

It is intentionally not created yet.

---

## 2. Product identity

### products

Purpose: immutable identity plus operational publication/selling controls.

Fields:

- id TEXT PRIMARY KEY
- legacy_catalog_id TEXT UNIQUE
- current_slug TEXT NOT NULL UNIQUE
- publication_status TEXT NOT NULL: DRAFT | ACTIVE | ARCHIVED
- sell_status TEXT NOT NULL DEFAULT AUTO: AUTO | OUT_OF_STOCK | ARRIVING_SOON | NOT_FOR_SALE
- online_ordering_enabled INTEGER NOT NULL DEFAULT 1
- featured INTEGER NOT NULL DEFAULT 0
- current_published_version_id TEXT
- current_draft_version_id TEXT
- version INTEGER NOT NULL DEFAULT 1
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL
- archived_at TEXT

Rules:
- ACTIVE means eligible to appear publicly.
- sell_status=AUTO means orderability is derived from price, variant state and inventory where tracked.
- explicit OUT_OF_STOCK, ARRIVING_SOON or NOT_FOR_SALE blocks online ordering.
- online_ordering_enabled=false permits public/in-store-only products without checkout.
- archived products remain addressable internally and in historical order context.

Indexes:
- current_slug unique
- legacy_catalog_id unique where non-null
- publication_status
- sell_status
- updated_at DESC

### product_slugs

Purpose: preserve old URLs and future slug changes.

Fields:
- id INTEGER PRIMARY KEY AUTOINCREMENT
- product_id TEXT NOT NULL
- slug TEXT NOT NULL UNIQUE
- is_primary INTEGER NOT NULL
- created_at TEXT NOT NULL
- retired_at TEXT

A slug change preserves the old alias and the publication layer generates redirect behaviour.

---

## 3. Versioned storefront content

### product_versions

Purpose: draft/published snapshots of descriptive content.

Fields:
- id TEXT PRIMARY KEY
- product_id TEXT NOT NULL
- version_number INTEGER NOT NULL
- title TEXT NOT NULL
- short_description TEXT NOT NULL
- long_description TEXT
- brand TEXT
- collection_label TEXT
- product_type TEXT NOT NULL
- public_note TEXT
- seo_title TEXT
- seo_description TEXT
- created_by TEXT NOT NULL
- created_at TEXT NOT NULL
- published_at TEXT
- superseded_at TEXT
- UNIQUE(product_id, version_number)

This table does not own current price, SKU/barcode, physical stock or reservations.

### categories

Fields:
- id TEXT PRIMARY KEY
- slug TEXT NOT NULL UNIQUE
- name TEXT NOT NULL
- parent_id TEXT
- active INTEGER NOT NULL DEFAULT 1
- sort_order INTEGER NOT NULL DEFAULT 0
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

### product_version_categories

Fields:
- product_version_id TEXT NOT NULL
- category_id TEXT NOT NULL
- is_primary INTEGER NOT NULL DEFAULT 0
- position INTEGER NOT NULL DEFAULT 0
- PRIMARY KEY(product_version_id, category_id)

This allows category edits in a draft without altering the currently published product.

---

## 4. Product facts and provenance

### product_attributes

Purpose: category-specific facts without adding a database column for every supplier field.

Fields:
- id INTEGER PRIMARY KEY AUTOINCREMENT
- product_version_id TEXT NOT NULL
- attribute_key TEXT NOT NULL
- label TEXT NOT NULL
- value_text TEXT
- value_json TEXT
- visibility TEXT NOT NULL DEFAULT PUBLIC: PUBLIC | ADMIN
- position INTEGER NOT NULL DEFAULT 0
- source_record_id TEXT
- UNIQUE(product_version_id, attribute_key)

Examples:
- dimensions
- material
- packaging
- suitability
- care
- range
- lighting
- battery
- ingredients
- allergens
- may_contain
- dietary
- nutrition
- nutrition_per_100ml
- storage
- pack
- awards
- manufacturer_formats

Operational fields such as price, stock and SKU are prohibited here.

### product_source_records

Purpose: preserve research/provenance separately from customer-facing facts.

Fields:
- id TEXT PRIMARY KEY
- product_id TEXT NOT NULL
- source_type TEXT NOT NULL: OWNER | OFFICIAL | SUPPLIER | LEGACY | OTHER
- source_name TEXT
- source_url TEXT
- supplier_url TEXT
- external_product_code TEXT
- confidence TEXT
- source_status TEXT
- notes TEXT
- verified_at TEXT
- source_payload_json TEXT
- created_at TEXT NOT NULL
- created_by TEXT NOT NULL

This receives current confidence, source, priceSource, sourceStatus, sourceNotes, availabilitySource and official URLs/verification data.

Supplier retail price is never automatically promoted to Black Sheep selling price.

---

## 5. Variants and pricing

### product_variants

Every product has at least one default variant.

Fields:
- id TEXT PRIMARY KEY
- product_id TEXT NOT NULL
- title TEXT NOT NULL DEFAULT Default
- sku TEXT
- barcode TEXT
- price_minor INTEGER
- compare_at_price_minor INTEGER
- cost_minor INTEGER
- currency TEXT NOT NULL DEFAULT GBP
- track_inventory INTEGER NOT NULL DEFAULT 0
- low_stock_threshold INTEGER
- active INTEGER NOT NULL DEFAULT 1
- is_default INTEGER NOT NULL DEFAULT 0
- version INTEGER NOT NULL DEFAULT 1
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

Constraints:
- unique non-null SKU
- unique non-null barcode
- exactly one active default variant per product
- monetary fields cannot be negative
- low-stock threshold cannot be negative

Immediate operational fields:
- price
- compare-at price
- SKU
- barcode
- inventory tracking
- low-stock threshold
- variant active state

Every mutation writes an audit event.

---

## 6. Media

### product_media

Fields:
- id TEXT PRIMARY KEY
- product_id TEXT NOT NULL
- variant_id TEXT
- storage_provider TEXT NOT NULL: LEGACY_REPO | R2
- storage_key TEXT NOT NULL
- public_url TEXT NOT NULL
- mime_type TEXT
- width INTEGER
- height INTEGER
- file_size INTEGER
- checksum_sha256 TEXT
- created_by TEXT NOT NULL
- created_at TEXT NOT NULL
- deleted_at TEXT

### product_version_media

Fields:
- product_version_id TEXT NOT NULL
- media_id TEXT NOT NULL
- position INTEGER NOT NULL
- is_primary INTEGER NOT NULL DEFAULT 0
- alt_text TEXT
- display_fit TEXT: CONTAIN | COVER
- PRIMARY KEY(product_version_id, media_id)

Rules:
- existing repository images import as LEGACY_REPO,
- new owner uploads use R2,
- deleting a draft association never destroys an asset still referenced by a published version,
- media garbage collection is reference-aware and deferred.

---

## 7. Suppliers

### suppliers

Fields:
- id TEXT PRIMARY KEY
- name TEXT NOT NULL UNIQUE
- contact_name TEXT
- email TEXT
- phone TEXT
- website_url TEXT
- active INTEGER NOT NULL DEFAULT 1
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

### product_suppliers

Fields:
- product_id TEXT NOT NULL
- supplier_id TEXT NOT NULL
- supplier_product_code TEXT
- supplier_url TEXT
- cost_minor INTEGER
- lead_time_days INTEGER
- is_preferred INTEGER NOT NULL DEFAULT 0
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL
- PRIMARY KEY(product_id, supplier_id)

---

## 8. Inventory

### inventory_locations

Initial record:
- Black Sheep Shop — Ambleside

Fields:
- id TEXT PRIMARY KEY
- code TEXT NOT NULL UNIQUE
- name TEXT NOT NULL
- active INTEGER NOT NULL DEFAULT 1
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

The schema is multi-location from day one even though initial production has one location.

### inventory_balances

Fields:
- variant_id TEXT NOT NULL
- location_id TEXT NOT NULL
- on_hand INTEGER NOT NULL DEFAULT 0
- reserved INTEGER NOT NULL DEFAULT 0
- safety_stock INTEGER NOT NULL DEFAULT 0
- version INTEGER NOT NULL DEFAULT 1
- updated_at TEXT NOT NULL
- PRIMARY KEY(variant_id, location_id)

Derived:
available = max(0, on_hand - reserved - safety_stock)

Incoming is derived from open incoming records instead of being stored here.

### inventory_movements

Immutable ledger.

Fields:
- id TEXT PRIMARY KEY
- variant_id TEXT NOT NULL
- location_id TEXT NOT NULL
- movement_type TEXT NOT NULL
- on_hand_delta INTEGER NOT NULL DEFAULT 0
- reserved_delta INTEGER NOT NULL DEFAULT 0
- safety_stock_delta INTEGER NOT NULL DEFAULT 0
- reason_code TEXT NOT NULL
- note TEXT
- order_id TEXT
- order_revision_id TEXT
- reservation_id TEXT
- incoming_id TEXT
- batch_id TEXT
- idempotency_key TEXT
- actor_type TEXT NOT NULL
- actor_id TEXT
- created_at TEXT NOT NULL
- balance_on_hand_after INTEGER NOT NULL
- balance_reserved_after INTEGER NOT NULL
- balance_safety_after INTEGER NOT NULL

Initial movement types:
- INITIAL_COUNT
- MANUAL_ADJUSTMENT
- ORDER_RESERVATION
- RESERVATION_RELEASE
- SALE
- RETURN
- DAMAGE
- LOSS
- SUPPLIER_RECEIPT
- SAFETY_STOCK_CHANGE
- CORRECTION

The ledger is append-only.

### inventory_incoming

Fields:
- id TEXT PRIMARY KEY
- variant_id TEXT NOT NULL
- location_id TEXT NOT NULL
- source_type TEXT NOT NULL: MANUAL | PURCHASE_ORDER | TRANSFER
- source_id TEXT
- expected_quantity INTEGER NOT NULL
- received_quantity INTEGER NOT NULL DEFAULT 0
- expected_at TEXT
- status TEXT NOT NULL: OPEN | PARTIAL | RECEIVED | CANCELLED
- note TEXT
- created_by TEXT NOT NULL
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL
- version INTEGER NOT NULL DEFAULT 1

Derived:
incoming = sum(expected_quantity - received_quantity) for OPEN/PARTIAL records.

Receiving stock updates the incoming record and appends SUPPLIER_RECEIPT to on-hand atomically.

---

## 9. Reservations

### inventory_reservations

One group per reviewed order version.

Fields:
- id TEXT PRIMARY KEY
- order_id TEXT NOT NULL
- order_revision_id TEXT NOT NULL
- state TEXT NOT NULL: ACTIVE | COMMITTED | RELEASED | CONSUMED | EXPIRED
- expires_at TEXT NOT NULL
- created_by TEXT NOT NULL
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL
- released_at TEXT
- committed_at TEXT
- consumed_at TEXT
- version INTEGER NOT NULL DEFAULT 1
- UNIQUE(order_revision_id)

### inventory_reservation_items

Fields:
- reservation_id TEXT NOT NULL
- variant_id TEXT NOT NULL
- location_id TEXT NOT NULL
- quantity INTEGER NOT NULL
- PRIMARY KEY(reservation_id, variant_id, location_id)

Reservation creation and matching reserved deltas must be atomic.

---

## 10. Product audit

### product_audit_events

Fields:
- id TEXT PRIMARY KEY
- product_id TEXT NOT NULL
- variant_id TEXT
- event_type TEXT NOT NULL
- actor_type TEXT NOT NULL
- actor_id TEXT
- request_id TEXT
- idempotency_key TEXT
- before_json TEXT
- after_json TEXT
- reason TEXT
- created_at TEXT NOT NULL

Examples:
- PRODUCT_CREATED
- CONTENT_DRAFT_UPDATED
- PRODUCT_PUBLISHED
- PRICE_CHANGED
- SKU_CHANGED
- BARCODE_CHANGED
- SELL_STATUS_CHANGED
- ONLINE_ORDERING_CHANGED
- VARIANT_CREATED
- VARIANT_ARCHIVED
- MEDIA_ADDED
- MEDIA_REMOVED

Inventory quantity changes stay in the inventory ledger instead of duplicating stock truth here.

---

## 11. Publication tracking

### catalog_publications

Fields:
- id TEXT PRIMARY KEY
- source_version TEXT NOT NULL
- status TEXT NOT NULL: QUEUED | BUILDING | PUBLISHED | FAILED
- product_count INTEGER NOT NULL
- triggered_by TEXT NOT NULL
- started_at TEXT
- completed_at TEXT
- error_code TEXT
- artifact_reference TEXT
- created_at TEXT NOT NULL

Purpose:
- show whether content is Draft or Live,
- make publication state visible to Admin,
- avoid hidden deploy state.

Operational price/stock changes do not depend on static publication success.

---

## 12. Effective orderability

A variant is orderable only when all are true:

1. publication_status = ACTIVE
2. online_ordering_enabled = true
3. sell_status = AUTO
4. variant active = true
5. price_minor is non-null
6. if track_inventory=false, inventory does not block
7. if track_inventory=true, available > 0

Therefore:
- OUT_OF_STOCK blocks even if physical quantity exists.
- ARRIVING_SOON blocks until deliberately released to AUTO.
- NOT_FOR_SALE blocks intentionally public/in-store-only products.
- missing price blocks checkout.
- tracked zero availability blocks automatically.

This rule becomes one shared domain function used by storefront availability, basket validation, checkout and Admin revision search.

---

## 13. Draft vs immediate changes

### Draft → Publish
Versioned:
- title
- descriptions
- brand presentation
- product type
- category placement
- product facts
- media ordering/primary image
- SEO
- public note

### Immediate audited operations
- price
- SKU/barcode
- online ordering enabled
- sell-status override
- inventory tracking
- low-stock threshold
- stock adjustments
- reservations
- incoming receipts

Admin must visually distinguish the two modes.

---

## 14. Initial import

For each of the 146 current products:
- create product UUID,
- retain current ID as legacy_catalog_id,
- create one default variant,
- copy price exactly to integer minor units,
- copy SKU/barcode if present,
- create first published product version,
- create categories,
- map legacy main/gallery media,
- import facts as attributes,
- import provenance separately,
- import sell-status override.

Inventory:
- track_inventory=false,
- no balance invented,
- no INITIAL_COUNT until owner performs or accepts a count.

Special:
- all 12 Ice Cream flavour records use online_ordering_enabled=false initially,
- HC-049 and HR-007 retain null price,
- current explicit out-of-stock/arriving states remain unchanged.

---

## 15. Compatibility with current orders

Existing order tables remain untouched.

Historical order items continue to be immutable snapshots of:
- product identity
- SKU
- slug
- name
- price
- quantity

Future orders may store the new product/variant UUIDs where appropriate, but must keep the snapshot fields so old orders do not change when products are edited later.

---

## 16. Forward-only migration policy

D1 migrations are forward-only.

Rollout:
1. create new tables additively,
2. import staging data,
3. verify parity,
4. enable read paths,
5. enable write paths only after verification,
6. switch checkout authority only after dual-read parity,
7. retire legacy catalogue authority last.

Rollback during early phases means disabling new read/write paths, not destructive table reversal.

---

## 17. Phase 1 scope

The first actual migration should provide enough foundation for a read-only Product workspace:

- products
- product_slugs
- product_versions
- categories
- product_version_categories
- product_attributes
- product_source_records
- product_variants
- product_media
- product_version_media
- product_audit_events
- inventory_locations

Inventory balance/movement/reservation tables may be included in the same foundation migration if it reduces migration churn, but no inventory mutation path is enabled until its own phase.
