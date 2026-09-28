# Product maker and classification ownership
Audited 28 September 2026 against main 202f24d.

## Evidence and scope
Read-only SELECT aggregates ran against production and staging D1. Both reported changes=0, rows_written=0 and changed_db=false. No customer, order, authentication or secret data was queried.

Effective versions use COALESCE(current_draft_version_id, current_published_version_id); published versions use current_published_version_id. For each view, group product_versions.brand and the sorted categories reached through product_version_categories where category_type='BRAND_RANGE', grouped by publication_status. Production active effective and published groups matched:

| Maker text | Shop Brand/Range | Active products |
| --- | --- | ---: |
| Romney’s of Kendal | Romney's | 51 |
| The Leonardo Collection | none | 35 |
| Peter Rabbit / Beatrix Potter | Peter Rabbit | 23 |
| Hawkshead Relish Company | Hawkshead Relish | 15 |
| Lakes Ice Cream | none | 12 |
| empty | Lake District Souvenirs | 5 |
| empty | none | 2 |
| Walker's Nonsuch | Romney's | 1 |

Production has 144 active products; 47 have meaningful maker text without a Brand/Range category. Staging has 146 active products, with the same meaningful distinction. These are audit snapshots, not fixtures to synchronize.

## Ownership and defect
product_versions.brand owns descriptive maker text, imported from catalogue item.brand and exposed by public-catalog. product_version_categories owns independent shop labels. product-editor.ts create accepts explicit maker; save preserves it when omitted (explicit null clears); duplicate copies it. Quick edit does not write maker/categories.

ui.ts formerly derived brand from the first selected BRAND_RANGE category on every create/full save. Thus an unrelated description edit could clear Leonardo/Lakes makers or replace Walker's with Romney's. The fix removes that projection and uses one shared labelled maker field in create/full edit, preloaded from the current product.

## Validation and migration
Three generated-JavaScript tests failed before the fix and pass afterwards. Two real-schema SQLite tests verify category edits preserve maker, duplication retains it, and explicit maker update/clear does not alter classification. TypeScript and all 424 tests pass. Isolated local editor layout inspected with a Leonardo fixture; no live save performed.

No schema or data migration. Do not infer maker from shop ranges in later refactors. Existing historical values remain intact; correcting pre-existing content requires separate evidence.
