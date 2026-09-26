# Black Sheep — Category Management Rules

Date: 26 September 2026  
Repository: `Mo31D/Blacksheep`  
Branch: `main`

This document is the owner-facing operating rule set for Admin category management. It describes the persisted category model and the safety rules that the Admin must preserve.

## Category groups

Every category belongs to exactly one persisted group:

| Group | Use for | Examples |
| --- | --- | --- |
| Brand / Range | A supplier, brand or named product range | Romney's, Peter Rabbit, Hawkshead Relish |
| Product category | What the item physically is | Fudge, Biscuits, Mugs, Honey, Soft Toys |
| Collection / Theme | A broader merchandising theme or collection | Highland Cows, Seasonal, Gift Boxes, Home & Gifts |

A product may belong to more than one category at the same time. Example: a Christmas Highland Cow decoration may use `Highland Cows + Seasonal + Home & Gifts`.

## Owner rules

1. **Use Brand / Range only for a real brand or named range.**
   Do not create a brand category just because several products look similar.

2. **Use Product category for the product's actual type.**
   Keep names short and reusable, such as `Mugs` rather than `Peter Rabbit Mugs for Gifts`.

3. **Use Collection / Theme for cross-category merchandising.**
   It may contain different product types that share a theme, season or collection.

4. **Prefer one clear category over near-duplicates.**
   Search Category Manager before creating a new category. Rename an existing category when the meaning is the same.

5. **Products can have multiple categories.**
   Use only categories that materially help catalogue organisation, search, filtering or merchandising.

6. **Ordering is owner-controlled inside each group.**
   Moving a category changes Admin/display ordering only; it does not rewrite products.

7. **Archive is the safe removal action.**
   There is no destructive Delete action in the owner Admin.
   - Archiving hides the category from new-product choices.
   - Existing product-category relationships are preserved.
   - Published product history is not rewritten.
   - Existing products that already use the category can keep it while other fields are edited.
   - The owner may later remove the archived category from an individual product or restore the category.

8. **Archived categories cannot be newly attached to another product.**
   Restore the category first if it should be used again.

9. **Usage count is informational, not a deletion gate.**
   Category Manager shows how many active/non-archived products use a category. A used category can still be archived safely because archive does not delete relationships.

10. **Do not repurpose a category name into a different meaning.**
    If the meaning changes materially, archive the old category and create a new one instead of renaming it into an unrelated concept.

## Category Manager capabilities

From **Admin → Products → Manage categories**, the owner can:

- add a category;
- choose its persisted group;
- rename it;
- move it between groups;
- reorder it within a group;
- see product usage count;
- archive it safely;
- restore it.

The Add/Edit Product category picker is searchable, grouped and multi-select. Archived categories are hidden from new-product choices. If an existing product already uses an archived category, that category remains visible in its editor as `Archived` so saving unrelated changes does not silently remove the relationship.

## Data and API safety contract

- `categories.category_type` is the persisted source of truth; group inference from category names is no longer authoritative.
- Valid values are `BRAND_RANGE`, `PRODUCT_CATEGORY`, and `COLLECTION_THEME`.
- Category names are unique case-insensitively.
- Slugs are generated uniquely and are not rewritten merely because a display name changes.
- Product creation accepts active categories only.
- Product editing may preserve an already-linked archived category, but may not newly add an archived category.
- Archive changes `categories.active` to `0`; it does not delete rows from `product_version_categories`.
- Restore changes `categories.active` back to `1`.

## Verification

Source-level regression protection includes:

- Category Manager route tests for list/create/update/move/archive/restore.
- A direct regression test proving archive does not delete product-category relationships.
- Generated Admin JavaScript compilation tests.
- UI assertions for the non-destructive archive wording and archived-category editor behaviour.
- Migration upgrade validation for `0014_category_management.sql`.
- Staging browser QA for create, rename, group change, reorder, archive, restore and Add Product category selection.

Final evidence:

- Commerce CI `36249831392` — **SUCCESS**; full `npm run check`, 35 Vitest files / 206 tests.
- Migration upgrade proof — **PASS** from `0000–0013` to `0014`.
- Staging deploy `36249871178` — **SUCCESS**.
- Staging D1 — `0014_category_management.sql` applied; subsequent remote migration list reported no migrations pending.
- Staging Worker version — `7c251e43-4e2e-4b68-8453-a10e316cea7e`.
- Staging health — **PASS**.
- Post-deploy Admin browser QA `36250012439` — **SUCCESS**, including iPhone Category Manager create / rename / group change / move / archive / restore, category search and selected-category summary.
- Search Readiness on the post-deploy QA commit `36250012438` — **SUCCESS**.
- Synthetic Category Manager QA data was cleaned after success.

Production deployment remains a separate release decision. This task intentionally changed Staging only; the current documented Production migration remains `0013_order_data_class.sql`.
