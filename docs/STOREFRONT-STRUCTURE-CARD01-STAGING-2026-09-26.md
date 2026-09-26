# Black Sheep Platform — CARD 01 Storefront Structure

Date: 26 September 2026  
Repository: `Mo31D/Blacksheep` · branch `main`  
Card: **CARD 01 — Storefront Structure data model**  
Release state: **COMPLETE / STAGING VERIFIED**  
Production promotion: **intentionally not performed in this card**

## Outcome

A distinct Storefront Structure domain now exists alongside Product classification.

This is the structural backbone for the next Admin work:
- Website sections and sub-sections.
- one Primary Product placement.
- multiple additional Product placements.
- future dynamic collections/navigation.
- structure-scoped Stocktake.
- Homepage collection merchandising.

The existing `categories` table remains Product classification and is not reused as the website/menu hierarchy.

## Implementation

### Migration

Added:

`commerce/migrations/0017_storefront_structure.sql`

New tables:
- `storefront_nodes`
- `storefront_node_versions`
- `product_version_storefront_placements`

The migration is additive. It does not remove or rewrite:
- Products.
- Product versions.
- Categories.
- Inventory.
- Orders.
- Static product pages.
- Canonical URLs.

### Seeded compatibility hierarchy

Four current root sections:
1. Gifts & Souvenirs
2. Ice Cream
3. Romney's
4. Hawkshead Relish

Current child destinations are seeded beneath the relevant roots, including:
- Peter Rabbit
- Highland Cows
- Mugs & Tableware
- Soft Toys
- Cards & Stationery
- Christmas / Seasonal
- Keyrings & Badges
- Home Gifts & Art
- Toys & Games
- Mint Cake
- Fudge
- Biscuits
- Sweets
- Gift Boxes
- Chutneys & Pickles
- Jams & Preserves
- Honey
- Mustard
- Savoury Sauces

Total seeded Storefront nodes: **23**.

### Version-aware Product placement

`product_version_storefront_placements` references `product_versions`, not the mutable Product row.

That means future drafts can have different placement from the currently published version without changing the live Product until publication.

The model supports:
- exactly one Primary placement per Product version that has placements.
- multiple additional placements.
- stable Storefront node identity across node revisions.
- non-destructive archive semantics.

### Compatibility write-through

Until CARD 03 replaces the Product Editor placement UX, current Product operations keep the new domain synchronized automatically.

Updated:
- Add Product.
- Save/Edit draft.
- Publish validation.
- Duplicate Product.
- Product Core importer.

Legacy `product_type` / category choices are mapped deterministically into Storefront placements so there is no migration gap between CARD 01 and CARD 03.

### Read contract

Added:

`commerce/src/data/storefront-structure.ts`

It provides:
- compatibility mapping.
- category-ID → category-slug resolution.
- guarded placement write statements.
- published Storefront node reads.
- Product-version placement reads.

### Staging custom-domain safety

`commerce/wrangler.jsonc` now explicitly sets:

`env.staging.routes = []`

This prevents the staging Worker environment from inheriting Production custom domains.

The staging deploy workflow also permanently rejects a deployment log that references:
- `api.theblacksheepshop.co.uk`
- `admin.theblacksheepshop.co.uk`

## Automated verification

### Commerce CI

Run: **36268779500 — SUCCESS**

- **37 test files passed**
- **218 tests passed**
- typecheck PASS
- clean local migration install through 0017 PASS
- upgrade 0000–0016 → 0017 PASS
- Inventory regression PASS
- Reservation regression PASS
- Worker staging dry-run PASS

### Frozen catalogue compatibility

The deterministic compatibility test covered:

- **146 frozen catalogue Products**
- **313 Storefront placements**

Every frozen Product received:
- a Storefront placement.
- exactly one Primary placement.
- a Primary root matching its legacy Product type.
- no duplicate Storefront node relationship.

### Migration/backfill test

The dedicated migration test verifies:
- 0017 installs after the previous migration set.
- primary and additional placements backfill deterministically.
- repeated compatibility inserts are idempotent.
- archiving a Storefront node preserves Product-version placement history.
- destructive deletion of a referenced Storefront node is restricted by FK protection.

### Search / SEO regression

Search Readiness:
- run **36268779540 — SUCCESS**
- final cleaned-tree run **36268975950 — SUCCESS**

No canonical URL / sitemap / static storefront migration was performed.

## Staging release proof

Primary CARD 01 staging verification run:

**36268539305 — SUCCESS**

The workflow applied pending staging migrations:
- `0016_admin_password_auth.sql`
- `0017_storefront_structure.sql`

Post-apply migration check:
- **No migrations to apply**

### Operational data parity

Before vs after 0017 remained identical:

| Metric | Before | After |
|---|---:|---:|
| Products | 158 | 158 |
| Product versions | 150 | 150 |
| Product variants | 158 | 158 |
| Inventory balances | 148 | 148 |
| On hand | 1,477 | 1,477 |
| Reserved | 0 | 0 |
| Orders | 32 | 32 |

These are Staging QA-state figures, not Production business metrics.

### Structure parity

After backfill on Staging:

| Check | Result |
|---|---:|
| Storefront nodes | 23 |
| Root sections | 4 |
| navigation-enabled roots | 4 |
| Product versions with placements | 150 |
| Product versions with invalid Primary count | **0** |
| known Product versions missing placements | **0** |
| multi-placement Product versions | 135 |

### Public catalogue parity

Staging public catalogue:
- before migration/deploy: **146**
- after migration/deploy: **146**
- pagination cursor unchanged: `null`

This proves CARD 01 did not switch the public storefront read path.

## Final clean Staging deploy

After removing the temporary CARD 01 verification gates from the reusable staging workflow:

Run: **36268976000 — SUCCESS**

- no migrations pending.
- custom-domain isolation PASS.
- health PASS.
- Production Worker / Production D1 not modified.
- Staging Worker version:
  `a63ec645-9ab9-4dce-be7f-ea751b83b2e6`
- Staging deployment ID:
  `240eb9b1-13c9-478a-99a0-067ff71f6a01`

## Production state

**Production was deliberately not changed by CARD 01.**

Production D1 remains on its prior operational migration state through `0016_admin_password_auth.sql`.

The 0017 migration will be promoted only as part of a guarded dependent release when the new owner-facing structure functionality requires it.

## Rollback position

Before Production cutover the rollback position is straightforward:
- current Production has no 0017 migration.
- live storefront still reads its existing compatibility architecture.
- Staging 0017 is additive.
- no static/canonical routes were replaced.
- no Product, Inventory or Order data was mutated by the migration.

After eventual Production promotion, application rollback remains possible because 0017 is additive and the old read path is retained until later cards explicitly switch it.

## CARD 01 acceptance

- [x] Product can have one Primary and multiple secondary Storefront placements.
- [x] Placements are version-aware through `product_versions`.
- [x] Archiving a Storefront node preserves Product history.
- [x] Existing public catalogue remains unchanged during migration.
- [x] Migration/backfill is deterministic and idempotent.
- [x] Existing Product write paths keep compatibility placements synchronized.
- [x] Inventory and Orders remain independent and unchanged.
- [x] Staging custom-domain inheritance risk is resolved.
- [x] Production cutover was not performed prematurely.

## Next

**CARD 02 — Catalogue Structure Admin redesign**

The next phase can now build the owner-facing hierarchical Structure workspace on this data model without reusing or overloading the existing Category Manager.
