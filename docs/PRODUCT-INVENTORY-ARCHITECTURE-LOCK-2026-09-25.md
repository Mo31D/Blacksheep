# Black Sheep — Product & Inventory Architecture Lock

**Locked:** 25 September 2026  
**Status:** PHASE 0 COMPLETE  
**Production migrations:** none created or applied.

---

## Locked decisions

1. D1 is the future operational product/inventory source of truth.
2. Existing GitHub catalogue remains authoritative until staged parity is proven and cutover is explicitly enabled.
3. Product descriptive content uses Draft → Publish.
4. Price, selling status and inventory are immediate audited operations.
5. Product identity uses immutable UUIDs; current catalogue IDs remain unique legacy aliases.
6. Current static canonical SEO architecture is preserved during migration.
7. Checkout ultimately validates price/orderability from D1, never browser-supplied values.
8. Inventory begins untracked; no quantity is inferred from current availability labels.
9. Tracking starts only with an owner-approved INITIAL_COUNT.
10. Inventory is ledger-based: on hand, reserved, available and incoming have explicit semantics.
11. Reviewed-order reservations are created when a reviewed version is sent, not on initial customer submission.
12. Reservation expiry aligns with the current secure review expiry: 168 hours by default.
13. Payment commits a reservation; fulfilment consumes it.
14. Refund does not imply return-to-stock.
15. New owner media uses managed object storage; existing repository media can coexist.
16. The current 146-product catalogue is imported deterministically; no manual re-entry.
17. Admin navigation is task-first: Today, Orders, Products, Stock, Incoming, Reports.
18. Universal search covers products, SKU, barcode, legacy IDs and orders.
19. Phase 1 is read-only Product Admin against staging D1 data.
20. No Product/Inventory production write path is enabled until parity, concurrency and audit tests pass.
21. Migration strategy is additive and forward-only with feature/read-path rollback.
22. Current order snapshots remain immutable and are never re-rendered from mutable live product data.

---

## Frozen migration baseline

- source commit: 66a5053ed2cf97502216b658f7e78c28873b7240
- catalogue blob: b382d8e161f165f7291da34b1cb23bef06c2742d
- products: 146
- unique IDs: 146
- unique slugs: 146
- populated unique SKUs: 83
- populated barcodes: 15
- explicit out-of-stock: 4
- arriving-soon: 14
- missing main images: 14
- missing numeric price: 14

---

## Locked Phase 0 specifications

- PRODUCT-CATALOG-FIELD-AUDIT-2026-09-25.md
- PRODUCT-INVENTORY-D1-SCHEMA-SPEC-2026-09-25.md
- INVENTORY-RESERVATION-LIFECYCLE-SPEC-2026-09-25.md
- PRODUCT-ADMIN-API-CONTRACTS-2026-09-25.md
- PRODUCT-STOCK-ADMIN-UX-SPEC-2026-09-25.md
- PRODUCT-INVENTORY-ADMIN-MASTERPLAN-2026-09-25.md
- PRODUCT-INVENTORY-ADMIN-CHECKLIST.md

---

## Phase 1 entry gate

Phase 1 may begin only with the following sequence:

1. create additive Product Core D1 migration,
2. build deterministic importer against the frozen catalogue,
3. import to staging only,
4. generate a parity report,
5. expose read-only Product APIs,
6. add the premium Products workspace to staging Admin,
7. perform desktop and iPhone QA,
8. keep public storefront and checkout on current authority until parity/cutover is explicitly approved.

No production migration should happen before the staging parity report is clean.

---

## Phase 1 success criteria

The read-only Product Core phase succeeds only when:

- all 146 current products exist in staging D1,
- no current price is lost or changed,
- all category memberships match,
- all current media references are preserved,
- all current explicit availability overrides match,
- provenance warnings remain accessible,
- Product Admin can search and inspect real D1 records,
- the public site and current checkout behave exactly as before,
- no owner write path is enabled yet.

---

## Explicitly not approved yet

Phase 0 does not approve:
- production Product/Inventory migrations,
- product editing in Production,
- owner image uploads,
- numerical stock tracking,
- reservation mutations,
- checkout cutover to D1 product authority,
- removal of assets/catalog.js.

Those belong to later gated phases.
