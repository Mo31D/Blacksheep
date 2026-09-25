# Black Sheep — Product & Inventory Admin API Contracts

**Date:** 25 September 2026  
**Status:** ARCHITECTURE LOCKED  
**Base:** existing authenticated /admin/api/* Worker routes.

---

## 1. API rules

All Admin mutations must:
- require the existing owner Admin session,
- pass same-origin protection,
- accept JSON only,
- enforce request-size limits,
- validate allowed fields strictly,
- use optimistic concurrency,
- write audit or inventory-ledger records,
- return no secrets,
- use idempotency keys where retries could duplicate effects.

Standard errors use the existing shape:

    {
      "error": {
        "code": "product_version_conflict",
        "message": "This product changed while you were editing it."
      }
    }

Recommended statuses:
- 400 invalid request
- 401/403 auth or origin
- 404 not found
- 409 version, inventory or idempotency conflict
- 413 payload too large
- 422 valid request shape but impossible domain operation
- 503 dependency unavailable

---

## 2. Product list

### GET /admin/api/products

Query parameters:
- q
- publication
- sellStatus
- stock = all | in-stock | low | out | incoming | untracked
- category
- quality = missing-image | missing-price | source-warning | draft
- sort
- cursor
- limit, maximum 100

Summary response fields:
- id
- legacyId
- slug
- title
- thumbnailUrl
- sku
- barcode
- priceMinor
- currency
- publicationStatus
- sellStatus
- onlineOrderingEnabled
- inventory summary
- qualityFlags
- version
- updatedAt
- nextCursor

The list endpoint stays lightweight and does not return full descriptions, media galleries or provenance payloads.

---

## 3. Create product

### POST /admin/api/products

Creates a private DRAFT product and default variant.

Required:
- title

Optional:
- priceMinor
- categoryIds
- sku
- barcode

Rules:
- no automatic publication,
- price may be null,
- SKU/barcode optional but unique when supplied.

Response:
- product ID
- publication status
- draft version ID
- product version number

---

## 4. Product detail

### GET /admin/api/products/:productId

Returns:
- immutable identity,
- published content,
- draft content if present,
- all variants,
- categories,
- media,
- attributes,
- provenance warnings,
- inventory per location,
- recent audit summary,
- completeness checks.

The response explicitly separates Published and Draft so Admin always knows what is live.

---

## 5. Draft content edit

### PATCH /admin/api/products/:productId/draft

Request includes:
- expectedVersion
- changes

Allowed draft content:
- title
- shortDescription
- longDescription
- categoryIds
- primaryCategoryId
- brand
- productType
- publicNote
- seoTitle
- seoDescription
- attributes
- draft media associations

Behaviour:
- create a draft version if one does not exist,
- otherwise update the draft safely,
- do not alter currently published content.

Response returns:
- updated draft
- new version
- compact diff summary.

---

## 6. Publish

### POST /admin/api/products/:productId/publish

Request:
- expectedVersion

Server:
1. validates publish readiness,
2. promotes the draft version,
3. records PRODUCT_PUBLISHED,
4. creates a catalog_publications record,
5. queues or performs the static publication workflow,
6. returns publication state.

Operational price and stock are already authoritative in D1 and do not wait for static publication.

---

## 7. Immediate product operations

### PATCH /admin/api/products/:productId/operations

Allowed:
- onlineOrderingEnabled
- sellStatus
- featured

Request must include expectedVersion.

These changes:
- take effect immediately,
- write product audit history,
- do not require Draft → Publish.

---

## 8. Variant updates

### PATCH /admin/api/variants/:variantId

Allowed:
- priceMinor
- compareAtPriceMinor
- costMinor
- sku
- barcode
- active
- lowStockThreshold

Request includes expectedVersion.

Rules:
- price is integer minor units,
- non-null SKU unique,
- non-null barcode unique,
- before/after audit required,
- current checkout truth changes immediately.

---

## 9. Initial inventory count

### POST /admin/api/inventory/initial-count

Request:
- variantId
- locationId
- quantity
- reason
- idempotencyKey

Atomic effects:
- enable track_inventory,
- create/update balance,
- append INITIAL_COUNT movement,
- return new balance/version.

This route cannot be used as an uncontrolled overwrite after tracking is enabled.

---

## 10. Inventory adjustment

### POST /admin/api/inventory/adjustments

Request:
- variantId
- locationId
- delta
- reasonCode
- optional note
- expectedBalanceVersion
- idempotencyKey

Response:
- onHand
- reserved
- available
- incoming
- new balance version
- movementId

Admin never PATCHes an arbitrary Available value.

---

## 11. Physical count

### POST /admin/api/inventory/count

Owner submits counted physical quantity, not a delta.

Request:
- variantId
- locationId
- countedOnHand
- reason
- expectedBalanceVersion
- idempotencyKey

Server:
- computes correction,
- appends count/correction movement,
- returns the resulting balance.

This is the preferred stocktaking UX.

---

## 12. Incoming stock

### POST /admin/api/inventory/incoming
Create expected incoming stock.

### PATCH /admin/api/inventory/incoming/:id
Change expected quantity/date/note while open.

### POST /admin/api/inventory/incoming/:id/receive

Request:
- quantityReceived
- expectedBalanceVersion
- idempotencyKey

Atomically:
- update received quantity and status,
- append SUPPLIER_RECEIPT movement,
- increase on-hand,
- return new incoming and balance state.

Partial receipt is supported.

---

## 13. Inventory board

### GET /admin/api/inventory

Filters:
- q
- category
- state = low | out | incoming | untracked | discrepancies
- location
- cursor
- limit

Each summary includes:
- variantId
- productId
- title
- sku
- thumbnailUrl
- tracked
- onHand
- reserved
- available
- incoming
- lowStockThreshold
- balanceVersion

---

## 14. Inventory history

### GET /admin/api/variants/:variantId/inventory/history

Returns paginated immutable movements.

There is no edit or delete route for ledger rows.

Corrections are new movements.

---

## 15. Product history

### GET /admin/api/products/:productId/history

Returns product audit events and related inventory summary.

Filters:
- eventType
- actor
- date range

---

## 16. Media upload

Recommended two-step R2 flow.

### POST /admin/api/products/:productId/media/uploads

Request:
- fileName
- contentType
- fileSize

Server:
- validates type/size,
- creates upload intent,
- returns short-lived upload target or token.

### POST /admin/api/products/:productId/media/complete

Registers completed asset metadata after upload.

The asset can then be attached to the draft version.

Before implementation, exact MIME, bytes, pixel and gallery-count limits must be defined in code constants and tests.

---

## 17. Media reorder

### PATCH /admin/api/products/:productId/draft/media

Request:
- expectedVersion
- ordered media array containing mediaId, position, primary and altText.

Published media stays unchanged until Publish.

---

## 18. Categories

Endpoints:
- GET /admin/api/categories
- POST /admin/api/categories
- PATCH /admin/api/categories/:id

A referenced category is deactivated/archived rather than destructively deleted.

---

## 19. Bulk product operations

### POST /admin/api/products/bulk

Initial safe operations:
- sell status
- category assignment
- online-ordering flag
- low-stock threshold

Bulk price editing should be introduced only with a preview/diff confirmation step.

---

## 20. Bulk stock count

### POST /admin/api/inventory/bulk-count

Creates one batch identity and individual ledger movements.

Response must separate:
- success
- conflicts
- unchanged

No silent partial success.

---

## 21. Universal Admin search

### GET /admin/api/search?q=

Searches:
- product title
- SKU
- barcode
- legacy product ID
- category
- supplier product code
- order reference
- customer identity under existing Admin permissions

Results are grouped by entity type.

This becomes the source for the global Admin command/search bar.

---

## 22. Public catalogue reads

### GET /v1/catalog/public

Lightweight published catalogue plus live orderability projection.

### GET /v1/catalog/products/:slug

Published product content plus current price/orderability.

Never expose:
- supplier cost
- internal notes
- provenance warnings
- exact on-hand count unless a future business decision explicitly permits it.

Checkout never trusts browser-supplied price or stock values.

---

## 23. Reservation domain operations

Internal service operations:

- reserveReviewedOrder(revisionId)
- commitReservation(orderId)
- releaseReservation(orderId, reason)
- consumeReservation(orderId)
- expireReservations(now)

Current Admin order routes call these within the same domain transaction boundaries as revision/status changes.

---

## 24. Idempotency

Required for:
- initial count
- stock adjustment
- incoming receipt
- bulk count
- reservation create/release/consume
- publication request where retry can duplicate work

Keys are scoped to logical entity + operation.

---

## 25. Concurrency

Every mutable product, variant and balance operation supplies expected version.

On conflict:
- return HTTP 409,
- return safe current state where useful,
- Admin refreshes only the affected card/sheet rather than the whole application.

Inventory must never use last-write-wins semantics.

---

## 26. Compatibility endpoint

The current /admin/api/catalog route remains available during migration for order revision/substitution flows.

Phase 1 introduces the new read-only Product API beside it.

Only after D1 parity is proven should existing order-product lookup be switched to the new Product Core.
