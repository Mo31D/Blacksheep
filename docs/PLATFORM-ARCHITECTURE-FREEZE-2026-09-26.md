# Black Sheep Platform — Architecture Freeze

Date: 26 September 2026  
Repository: `Mo31D/Blacksheep` · branch `main`  
Programme: `docs/PLATFORM-IMPLEMENTATION-CARDS-2026-09-26.md`  
Card: **CARD 00 — Architecture freeze & source-of-truth map**

## Decision status

**FROZEN FOR THE NEXT PLATFORM PROGRAMME.**

This document defines the boundaries that later cards must preserve. A later card may refine an internal schema, but must not silently change these ownership rules or create competing sources of truth.

---

# 1. Current Production baseline

Read-only Production snapshot: GitHub Actions run **36266787042**, source commit `3e25eb423aec71b0c9df41486f0083ede3f2874d`.

## Runtime health

Production `/health` reported:
- environment: `production`
- D1: bound
- order reservations: enabled
- public catalogue: enabled
- commerce authority: `d1-published-v1`
- Resend provider/from/owner/webhook: configured

## D1 migration state

Production has migrations `0000` through **`0016_admin_password_auth.sql`** applied.

## Product / catalogue state

- Product rows: **152 total**
- `ACTIVE`: **140**
- `ARCHIVED`: **12**
- Public catalogue: **140** products, no next cursor at 200 limit
- Public product types currently emitted: `gifts`, `hawkshead`, `icecream`, `romneys`
- Public products without a primary image: **14**
- Product versions: **153**
- Product-version/category links: **324**

## Current category reality

Active categories:
- `BRAND_RANGE`: **3**
- `COLLECTION_THEME`: **4**
- `PRODUCT_CATEGORY`: **15**

Total active categories: **22**.

Although the original `categories` schema contains `parent_id`, **0 of the current categories use a parent**. The current Category Manager is therefore a flat classification manager, not a real website hierarchy.

## Media reality

Active product media:
- total: **139**
- R2-backed: **3**
- legacy repository-backed: **136**

The current `product_media` table is product-owned (`product_id` required), so it is not suitable as the final generic Homepage/Theme/Section media library without a deliberate migration.

## Inventory reality

- active variants: **152**
- tracked variants: **148**
- inventory balances: **148**
- on-hand units: **1,491**
- reserved units at snapshot: **0**

## Order reality

Production contained **6 TEST orders** and no visible BUSINESS-order count in this snapshot.

---

# 2. Platform principle

The Black Sheep project is now treated as a **small commerce/CMS platform**, not as a static website with Admin patches.

```text
                         BLACK SHEEP PLATFORM

        ┌────────────┬─────────────┬──────────────┐
        │            │             │              │
     PRODUCT      INVENTORY      ORDERS        MEDIA
        │            │             │              │
        └──────┬─────┴──────┬──────┴───────┬──────┘
               │            │              │
        STOREFRONT      HOMEPAGE       APPEARANCE
         STRUCTURE    MERCHANDISING       THEMES
               │            │              │
               └────────────┼──────────────┘
                            │
                         WEBSITE
                            │
                    NAVIGATION + SEO
```

The domains share IDs and published data, but **do not own each other's concepts**.

---

# 3. Source-of-truth matrix

| Domain | Authoritative state | Current compatibility layer | Rule |
|---|---|---|---|
| Product identity/content | Production D1: `products`, `product_versions`, slugs, attributes | `assets/catalog.js`, static product HTML | D1 remains operational authority |
| Price/selling state | D1 `product_variants` + product selling flags | storefront live overlay | Never reintroduce generated/static pricing as authority |
| Product classification | D1 `categories` + `product_version_categories` | static category arrays in generated storefront | Categories remain classification, not website structure |
| Storefront placement | **New D1 Storefront Structure domain** | current `product_type` + category/page mapping | New domain becomes authority after controlled cutover |
| Inventory | D1 Inventory Core | none | Placement/navigation must never duplicate stock |
| Stocktake | D1 Inventory Core; future persistent stocktake session tables | current browser `stocktakeState` | Browser state becomes UI cache only |
| Orders/revisions/refunds | D1 order domain | none | Must not depend on current webpage/category after order capture |
| Navigation | Future D1 Navigation/Structure publication | hard-coded HTML + `simplifyGiftNavigation()` | Navigation becomes data-driven after CARD 04 |
| Homepage merchandising | Future D1 homepage configuration | `index.html` + static JS | Separate from Product and Appearance |
| Appearance/themes | Future D1 appearance profile/version state | `assets/style.css` + static images/text | D1 stores approved settings; CSS implementation remains code |
| Media library | Future generic D1 asset registry + R2 | product-specific `product_media` + repository images | Generic media is separate; migrate references safely |
| Reports | Derived from authoritative D1 operational domains | Admin rendering | Reports never become a write authority |
| SEO/canonical pages | GitHub/static publication until CARD 12 | live D1 overlay for operational state | Do not remove static canonical layer early |
| Application code | GitHub `main` | Cloudflare Pages/Worker deployments | Never edit production code outside version control |

---

# 4. Frozen domain decisions

## 4.1 Products

Keep the current Product Core:
- `products` owns lifecycle and operational selling flags.
- `product_versions` owns versioned customer-facing content.
- `product_variants` owns SKU/barcode/price/cost/inventory settings.
- Product public content continues to use Draft → Publish semantics.
- Price/stock operational changes may remain immediate where intentionally designed; do not fake them as content drafts.

No later card may create a second product table to support Website, Homepage or Themes.

## 4.2 Categories are classification, not site structure

The current `categories` table remains for classification concepts such as:
- Brand / Range
- Product Category
- Collection / Theme

Its existing `parent_id` does **not** make it the future site-navigation hierarchy.

Reason:
1. Current categories mix different semantic types.
2. Current public catalogue and Product Editor already rely on them.
3. Repurposing them would couple classification, menu routing and stocktake scope.
4. An owner may want a Brand/Range without a website page, or a website section that is not a product classification.

Therefore **CARD 01 must create a distinct Storefront Structure domain**.

## 4.3 Storefront Structure is a new domain

The future structure owns:
- website sections
- sub-sections
- ordering
- active/hidden state
- optional section imagery/description
- stable public slug/path identity
- whether a structure node is eligible for navigation

Products are connected to structure by **versioned placement relationships**:
- exactly one Primary placement when required for a published product
- zero or more additional placements
- no product duplication
- no inventory duplication
- no price duplication

Indicative names such as `storefront_nodes` and `product_version_storefront_placements` are acceptable for CARD 01, but exact schema is owned by that card.

## 4.4 Navigation is related to Structure but not identical to it

Navigation must be able to reference:
- a Storefront section
- a fixed/content page such as Our Story
- Full Range
- Visit
- future external/special links if explicitly supported

A checkbox such as **Show in main menu** may create/manage a default navigation item, but navigation remains its own projection so site structure is not constrained by menu design.

## 4.5 Inventory is independent from placement

Inventory is keyed to Product Variant + Location.

If one product appears in:
- Gifts → Highland Cows
- Christmas → Decorations
- Home & Gifts

it still has **one variant inventory balance**.

Stocktake scoping selects existing variants by Storefront/Brand/Collection criteria; it never creates section-specific stock.

## 4.6 Stocktake becomes persistent

The current in-browser stocktake state is transitional.

CARD 05 will add server-persisted sessions/items so:
- progress survives refresh/device interruption
- a scope is recorded
- counted values remain reviewable
- Inventory Core continues to own final stock movements/balances

A stocktake session is workflow state, not a new inventory authority.

## 4.7 Homepage is merchandising, not structure

Homepage configuration may reference:
- products
- Storefront nodes
- media
- approved content blocks

It does not own product classification or menu structure.

“New arrivals” is derived from published Product data.
“Featured products” is explicit merchandising data.
“Selected collection” references Storefront Structure.

## 4.8 Appearance is configuration, not arbitrary code

Appearance owns:
- approved design-token overrides
- selected theme preset
- Hero content/image reference
- approved section-image overrides
- version/publish history

It must not permit arbitrary CSS/HTML/JavaScript.

The actual component/CSS implementation stays in GitHub code. D1 only selects approved tokens/assets/content.

## 4.9 Media requires a generic asset layer

Current `product_media` is intentionally product-specific and includes legacy repository assets.

CARD 11 must introduce or evolve toward a generic asset registry suitable for:
- Product
- Homepage
- Storefront section
- Theme

Rules:
- R2 is the long-term binary store for owner-uploaded reusable media.
- Existing repository images are not bulk-deleted during the migration.
- Historical product-version references cannot be broken by replacement/deletion.
- Asset cleanup happens only after reference checks.

## 4.10 Reports are read models

Reports derive from Products, Inventory and Orders.
They never become a business-data authority.
Storefront-placement reporting may be added later by joining the Storefront Structure domain.

---

# 5. Publishing contract

All **public-facing CMS state** introduced by this programme follows:

```text
EDIT
  ↓
DRAFT
  ↓
PREVIEW
  ↓
PUBLISH
  ↓
VERIFY PUBLIC READ MODEL
  ↓
LIVE ✓
```

The Admin must distinguish:
- saved internally
- published
- publicly verified

A successful database mutation alone is not sufficient to show **Live ✓**.

Operational state such as physical stock/price may have a separate immediate-write path when intentional; those actions still require audit/concurrency protection.

---

# 6. Storefront migration boundary

## Current state

The website is hybrid:
- static HTML and static canonical product pages
- `assets/catalog.js` published snapshot
- `assets/commerce-live.js` overlays authoritative D1 operational/public state
- `assets/site.js` contains hard-coded page/type/category routing for dynamic cards
- D1-only products can use the dynamic `product.html` fallback

## Frozen migration rule

Do **not** remove the static/canonical layer during CARD 01–11.

The sequence is:

1. Add new D1 structure/schema without changing customer routing.
2. Backfill structure from existing published catalogue.
3. Compare old and new placement outputs.
4. Allow Admin to manage new structure while old storefront remains compatibility path.
5. Switch collections/navigation only after staging/browser parity.
6. Keep existing indexed product URLs/canonicals.
7. Perform clean URL/SEO migration only in CARD 12.

This prevents the structure project from becoming an accidental SEO migration.

---

# 7. Migration strategy

All platform migrations follow **expand → backfill → verify → switch → contract**.

## Expand
Add new tables/columns/indexes only.
Do not drop current fields/tables.

## Backfill
Create deterministic mapping from current:
- `product_type`
- current categories
- current collection pages/navigation

to the new domain.

## Verify
Run:
- schema tests
- backfill idempotency tests
- old-vs-new product placement parity
- staging browser tests
- no-order/no-inventory mutation checks where applicable

## Switch
Enable the new read path behind an explicit feature flag or controlled release boundary.

## Contract
Delete/retire old compatibility logic only after Production verification and a documented rollback window.

### D1 rollback reality

D1 migrations are forward-only in this programme.

Rollback means:
- revert application read/write path to the prior compatible code
- leave additive tables harmlessly present
- disable new feature flag/publication
- never rely on destructive down-migrations in Production

---

# 8. Release safety constraints

## Production and staging

Production:
- D1: `black-sheep-commerce-prod`
- configured database id: `c1afdb87-47a8-4f6b-bf4b-0ce9b5b41e52`
- R2: `black-sheep-product-media-prod`

Staging:
- D1: `black-sheep-commerce-staging`
- database id: `d442b45d-93b6-4535-b76a-4b72e62dc271`
- R2: `black-sheep-product-media-staging`

**Mandatory before the next staging Worker deployment:** prevent the `env.staging` Wrangler environment from inheriting Production custom-domain routes. Current Wrangler warning states that inherited routes could reassign `api.theblacksheepshop.co.uk` and `admin.theblacksheepshop.co.uk`. CARD 01 release preparation must add an explicit safe staging route policy (for example `routes: []`) before deploying that environment.

## Secrets/config

- Keep `keep_vars: true` unless a deliberate secrets/config migration is performed.
- Do not move secret values into repository config.
- Production owner/auth/email configuration must survive Worker deployments.

---

# 9. Security and concurrency invariants

All new Admin mutations must preserve current standards:
- authenticated Admin access
- same-origin protection where applicable
- server-side validation
- optimistic concurrency/version guards
- idempotency for replay-prone operations
- immutable/auditable operational history where appropriate
- no customer-controlled arbitrary HTML/CSS
- no destructive cascade that removes historical Product/Order/Inventory evidence

Structure/Homepage/Appearance publish actions require audit events including actor, timestamp and version.

---

# 10. SEO invariants until CARD 12

Until CARD 12 explicitly changes them:
- current indexed static product URLs stay valid
- current canonical static product pages remain authoritative SEO surfaces
- `sitemap.xml` and Search Readiness continue to pass
- no new query-string URL becomes the canonical replacement for an existing static product
- no mass redirect/removal of product pages is bundled into Storefront Structure work
- early dynamic collection/preview routes must not create duplicate indexable content

---

# 11. Admin UX invariants

New Admin surfaces must be designed for a non-technical shop owner:
- owner language, not database enum names
- cards/accordions/progressive disclosure
- iPad portrait as a first-class target
- clear “where will this appear?” language
- clear Draft vs Live status
- safe defaults
- reversible actions
- minimal required fields
- no dependence on GitHub/Cloudflare knowledge

Internal terms such as `PRODUCT_CATEGORY`, table names and migration numbers stay out of normal owner UX.

---

# 12. Target logical module boundaries

The code does not need a risky big-bang file move, but new work should respect these logical boundaries:

```text
commerce/src/
  product/          Product content, variants, classification
  inventory/        Balances, movements, stocktake
  orders/           Orders, revisions, reservations, refunds
  storefront/       Structure, placements, navigation publication
  merchandising/    Homepage modules / featured selection
  appearance/       Theme profiles / design tokens
  media/            Generic asset registry / R2
  publishing/       Preview/publish/verify contracts
  admin/            Owner UI composition, not domain authority
```

Existing files may be migrated incrementally. Do not perform a broad rename solely to match this diagram.

---

# 13. Dependency contract for the next cards

## CARD 01 may now start

CARD 01 must design the Storefront Structure schema under these rules:
- distinct from `categories`
- version-aware product placements
- additive migration
- deterministic backfill
- no storefront switch in the schema-only milestone
- no change to canonical SEO URLs
- inventory/order independence

## Later cards

- CARD 02 consumes Storefront Structure for Admin hierarchy.
- CARD 03 consumes placements for Product Editor.
- CARD 04 consumes published structure for collections/navigation.
- CARD 05 consumes structure only as a Stocktake selection scope.
- CARD 06/07 reference structure for Homepage merchandising.
- CARD 08/09 remain Appearance-owned.
- CARD 10 unifies public publishing semantics after the domains exist.
- CARD 11 builds generic media without destroying product history.
- CARD 12 owns URL/SEO cutover.
- CARD 13 reorganises Admin after domain boundaries are stable.

---

# 14. CARD 00 acceptance result

- [x] Every major domain has one defined source of truth.
- [x] No new feature requires a duplicate category/storefront authority.
- [x] Current Production behaviour/schema baseline was captured read-only.
- [x] Rollback strategy is defined as forward-compatible application rollback, not destructive D1 down-migration.
- [x] Architecture diagram and data-ownership matrix are committed.
- [x] Storefront Structure vs Product Classification semantic boundary is frozen.
- [x] SEO migration is explicitly deferred to CARD 12.
- [x] Staging custom-domain inheritance risk is recorded as a mandatory pre-deploy fix.

**CARD 00 exit state: COMPLETE. CARD 01 is unblocked.**
