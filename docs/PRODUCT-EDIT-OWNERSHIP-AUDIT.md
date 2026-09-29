# Product editing ownership

## One Product home, distinct responsibilities

Products is the Admin home for full content editing and commerce quick edits. All use product-editor.ts and its shared money, text, boolean, version and SKU/barcode validation.

| Operation | Canonical owner | Concurrency contract |
| --- | --- | --- |
| Quick edit: price, SKU, barcode | product_variants | Expected Product and variant versions |
| Quick edit: selling/online controls | products | Same Product transaction |
| Variant cost, VAT, supplier and low-stock threshold | product_variants | Expected variant version plus current Product version |
| Full draft: title, maker, description, classification, placement | product_versions and version associations | Expected Product version |
| Publication | products publication pointers | Separate explicit publish action |

Full editing stages content; commerce quick editing is live. These are intentional responsibilities, not competing copies. Maker is independent of Brand/Range classification (BRAND-OWNERSHIP-AUDIT.md); navigation placement is independent of classification and selling controls. Stock quantities remain owned by inventory services, not variant metadata editing.

## Reproduced defect and correction

The draft, quick and variant writers previously allowed a stale first UPDATE to affect zero rows. Dependent writes and verification used expected version + 1 and updated_at to identify success. Two requests in the same millisecond can share that timestamp, allowing the loser to borrow the winner's state and report success or change its data.

The first Product UPDATE now evaluates expected versions atomically and assigns NULL to the existing required version column on conflict. D1 rolls back the batch; commitProductEditBatch translates that specific constraint error into the existing product_version_conflict contract. Dependent writes cannot run after a lost first mutation. No migration, new state copy or timestamp-format change is required.

Validation: product-edit-concurrency.test.ts executes actual migrations and writers using SQLite transactions. All nine winner/loser combinations failed before the fix and now reject with complete state equal to the winner, with time fixed to the same millisecond. Two shared invalid-price cases also pass. TypeScript and all 71 files / 537 tests PASS. Existing route/UI tests retain conflict feedback and request contracts.

## Boundary / follow-up

This proof covers draft, quick and variant edits. Publication, archive and Product media mutations have similar first-update/timestamp predicates and require a bounded fixed-clock regression next; this document does not claim those paths are proven safe. No deployment or live data mutation performed.
