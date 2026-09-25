# Black Sheep — Product Editor Phase 2 Staging Release

**Date:** 25 September 2026  
**Environment:** Staging only  
**Status:** CORE PRODUCT EDITING RELEASED  
**Production cutover:** NOT PERFORMED

---

## 1. Release evidence

- Release commit: `545df3d8f59f03d4a714693d991cef92344ace6d`
- Workflow: `Product Editor Staging Phase 2`
- Workflow run: `36172797078`
- Job: `108196158387`
- Result: **SUCCESS**
- Staging Worker deployment: `376e151f-0a0f-44b5-b91e-c0081cc8296b`
- Staging Worker version: `f79d2e06-858c-4e98-a579-2cc8a03f4d07`
- Staging Worker version number: `66`

All deployment gates passed:
- full Commerce validation,
- Product Core schema gate,
- imported baseline guard,
- inventory-tracking guard,
- staging Worker deployment,
- staging health,
- staging Admin sign-in shell.

---

## 2. Phase 1 polish completed from owner iPhone QA

The owner reviewed the staging Products workspace on iPhone and supplied screenshots covering:
- catalogue overview,
- product detail,
- filters,
- Out of stock,
- Arriving,
- Untracked,
- Missing price,
- Data warnings.

The following polish was implemented before enabling Phase 2:

### Mobile KPI layout
- Product metrics now use a compact 2×2 grid on mobile.
- Removes the previous unbalanced three-cards-plus-one layout.

### Corrected Needs data semantics
The old UI showed `Needs data = 28` by adding Missing image + Missing price.

Direct staging D1 review established:
- missing image = 14,
- null price = 14,
- 12 null-price records are Ice Cream flavours intentionally not directly priced online,
- actionable missing price = 2,
- one product overlaps Missing image + actionable Missing price.

New operational metric:
- **Needs data = 15 unique actionable products**
- **Actionable Missing price = 2**
- Ice Cream flavour pages are shown as in-store/pricing-model products rather than false data errors.

### Product detail scrolling
- the large hero/detail header is no longer sticky on iPhone,
- a compact mobile product header appears after the full header has scrolled away,
- back navigation remains accessible.

### Section navigation
- changing Today / Orders / Products / Reports now resets the page to the top,
- opening/closing a product detail does not unnecessarily destroy list context.

### Filters
- horizontal product filters retain touch scrolling,
- an edge fade gives a visual cue that more filters are available.

### Technical information
- Slug, internal Product ID and Variant ID moved into collapsible **Technical details**.
- Daily owner-facing information remains higher in the hierarchy.

---

## 3. Product Editor capabilities now available on staging

### Add Product

The Admin now includes **+ Add product**.

New products:
- are created as private `DRAFT`,
- receive an immutable Product UUID,
- receive an automatically generated unique slug,
- receive a default variant,
- can include title, description, type, price, SKU, barcode and categories,
- are written to Product audit history.

No GitHub editing is required.

### Quick Edit

A dedicated operational Quick Edit sheet supports:
- Price
- SKU
- Barcode
- Selling status:
  - Available / automatic
  - Out of stock
  - Arriving soon
  - Not for sale
- Online ordering enabled / disabled

Quick Edit is intentionally separate from descriptive editing because these are operational fields.

The final implementation updates pricing/codes/selling state in **one atomic Product Core operation**, rather than two UI requests.

### Product details editor

The premium editor supports draft changes to:
- Product name
- Brand
- Product type
- Short description
- Categories

These edits do not immediately replace published content.

They create/update a private content draft.

### Draft / Publish

The Product Core now clearly separates:

**Immediate operational changes**
- price,
- SKU,
- barcode,
- selling status,
- online-ordering flag.

**Draft → Publish content**
- name,
- brand,
- type,
- description,
- category placement.

Products with draft content display **Draft changes** in the catalogue list and detail page.

An explicit **Publish draft** action promotes the current draft inside staging Product Core.

Important:
- Product Core publication currently means published inside staging D1.
- The public storefront is deliberately **not yet cut over** to D1.
- Therefore Phase 2 editing cannot accidentally alter the live public product page.

---

## 4. Audit history

Each Product detail now includes human-readable audit history.

Recorded Product Core event types include:
- PRODUCT_CREATED
- PRODUCT_QUICK_EDITED
- PRODUCT_OPERATIONS_UPDATED
- VARIANT_UPDATED
- CONTENT_DRAFT_CREATED
- CONTENT_DRAFT_UPDATED
- PRODUCT_PUBLISHED

The UI can summarize changes such as:
- price before → after,
- SKU before → after,
- barcode before → after,
- selling status before → after,
- online-ordering state,
- title/brand/type changes,
- category changes,
- draft creation/publication.

Each event retains:
- actor identity,
- timestamp,
- reason,
- before JSON,
- after JSON.

---

## 5. Concurrency and data safety

Phase 2 uses optimistic concurrency.

Mutations carry:
- expected Product version,
- expected Variant version where applicable.

The final Quick Edit implementation was hardened so the Product and default Variant versions are checked as part of the same mutation gate.

If another edit wins first:
- stale mutation does not silently overwrite it,
- API returns a conflict,
- Admin shows an error and requires current state to be reloaded.

SKU and barcode uniqueness are validated before write and remain protected by D1 unique indexes.

All Admin writes remain protected by:
- owner authentication,
- same-origin mutation protection,
- JSON-only request handling,
- request-size limits,
- strict field validation.

---

## 6. Staging data state after release

Direct Cloudflare verification after deployment:

- Product rows: **146**
- Original PRODUCT_IMPORTED audit rows: **146**
- Inventory tracked variants: **0**
- Product Core migrations: `0000–0009`

No owner test product or stock quantity was injected as part of deployment.

Current data-quality metric:
- Out of stock: 4
- Arriving: 14
- Actionable missing price: 2
- Missing image: 14
- Needs data: 15 unique products

---

## 7. Production safety

Production remains unchanged by this release.

Verified after the staging deployment:
- Production D1 migration ledger remains `0000–0008`.
- Product Core migration `0009` is not applied to Production.
- Existing Production order count remains **3**.
- Production storefront catalogue remains on the existing authority.
- Production checkout is not reading Product Core.
- No Product write route was deployed to the Production Worker.
- Inventory tracking and reservation logic remain disabled.

---

## 8. Automated verification

The latest Product Editor source passed Commerce CI before the final staging deployment.

The Phase 2 staging release workflow also passed the full `npm run check` gate before deploy.

Coverage now includes:
- Product list/read contracts,
- Phase 2 editing UI contract,
- Add Product route,
- atomic Quick Edit route,
- draft update route,
- publish route,
- cross-origin write rejection,
- TypeScript,
- generated Admin JavaScript compilation,
- migrations through `0009`,
- migration upgrade testing,
- existing order/revision/refund/email regressions,
- staging Worker health.

---

## 9. Deliberately not included yet

These remain separate gated work:

### Phase 2 remaining polish
- Duplicate product.
- Archive product.
- final owner mutation smoke-test on real staging UI.

### Phase 3 — Media
- R2-backed owner image upload,
- iPhone photo upload,
- gallery reorder,
- primary image,
- alt text,
- replace/remove.

### Phase 4 — Inventory
- Initial Count,
- On hand,
- Reserved,
- Available,
- Incoming,
- low-stock threshold,
- immutable inventory movement ledger.

### Later
- order reservations,
- supplier receiving,
- storefront/checkout D1 cutover,
- integrated payments,
- customer accounts.

---

## 10. Current staging Admin

`https://black-sheep-commerce-api-staging.ky6vfb55p9.workers.dev/admin#products`

Recommended owner smoke test:
1. create a clearly named temporary draft product,
2. Quick Edit its price/SKU/status,
3. edit its descriptive details/categories,
4. confirm Draft changes appears,
5. inspect Audit history,
6. publish the draft inside staging Product Core.

Do not use real stock counts yet; Inventory is intentionally still untracked.
