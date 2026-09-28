# Architecture map

Reviewed against `main` at `1d08f3b` on 27 September 2026. This describes source code, not a fresh assertion about deployed versions. Read this with the rehabilitation checklist; older dated reports are release evidence, not current task queues.

## Components and ownership

| Concept | Canonical owner | Consumers / boundaries |
| --- | --- | --- |
| Product identity, SKU/barcode, operational variant fields | D1 `products` / `product_variants`; `data/products.ts`, `data/product-editor.ts` | Admin Products and server pricing. Browser basket values are requests, never price authority. |
| Product content and publication | D1 version records and draft/published pointers; `product-editor.ts` | Public catalogue selects published state; drafts must not leak. Operational variant edits and content publishing have different effects. |
| Stock and reservations | D1 balances, movements and reservation records; `inventory.ts`, `order-reservations.ts` | Stock, Stocktake, order review/fulfilment, public availability and valuation use this ledger. Do not introduce another stock counter. |
| Categories / Brand & range | D1 category relationships; Products data/editor | Classification is distinct from navigational placement and product maker. product_versions.brand owns the descriptive maker; category relationships own shop labels. Full Product/create editing saves both explicitly; neither is derived from the other. See BRAND-OWNERSHIP-AUDIT.md. |
| Website hierarchy / product placement | D1 `storefront_nodes`, node versions and product-version placements; `storefront-structure.ts` | Catalogue editor, navigation, dynamic collections. Compatibility mappings still support imports/legacy product types. |
| Homepage / appearance | D1 versioned configuration; `homepage-merchandising.ts`, `website-appearance.ts` | Website drafts, previews, publication and restoration; browser consumes public configuration. |
| Images | R2 owns bytes; D1 shared assets/references and product media own identity/associations | `shared-media.ts`, `product-media.ts`; `/media/:id` resolves both identities. Repository images remain valid historical/static assets. |
| Orders / revisions / refunds | D1 orders and audit/history; dedicated `data/` modules | Admin Orders, customer review and reporting. BUSINESS/TEST/E2E classification separates operational reports. |
| Authentication | `security/admin-access.ts`, D1 login/session records, environment secrets | Password and email-code sign-in converge on server sessions; Admin route boundary authorizes operations. |
| Email | Notification services own message intent; provider adapter owns delivery | Resend sends messages and returns delivery events; D1 owns audit/delivery state. `EMAIL` binding adapter takes precedence if supplied; Wrangler currently configures Resend through secrets rather than this binding. |
| Code and static publication | GitHub `main` | Source, static snapshot, generated pages, CI and release workflows. D1 remains commerce authority. |

## Actual flows

- Storefront: static HTML + `assets/catalog.js` snapshot → `site.js` rendering/enhancement. `commerce-live.js` fetches D1 public catalogue, validates complete pagination and reconciles membership/price/availability, including Admin-created products. API failure retains static fallback. Clean collections and dynamic sitemap are Worker routes; clean Product routes are staging-enabled only. Existing `/products/*.html` URLs and `product.html` fallback remain relevant.
- Admin: Worker `index.ts` → `routes/admin.ts` authentication/HTTP adapter → domain/data functions → D1/R2 → refreshed Admin state. `admin/ui.ts` emits HTML/CSS/browser JavaScript; `admin/publication.ts` verifies published public-feed versions, not rendered-site correctness.
- Orders: browser basket → `POST /v1/orders` → request validation, rate limit, Turnstile, idempotency → D1 authoritative pricing and persistence → notification service → Resend. Customer review and Admin revisions/fulfilment coordinate reservations; cron expires due reservations and captures daily valuation. Payment instructions do not make initial submission a paid checkout.
- Inventory: Stock adjustments / Stocktake sessions / order transitions → inventory and reservation services → balances plus movement/audit history → Admin and public availability. Stock Value derives values and daily snapshots; it does not own counts. See INVENTORY-WRITE-AUDIT.md for callers and failure boundaries. Inventory replay validates the same target both before writing and during post-batch recovery. Bulk no-op counts still validate the expected balance version; an existing child movement proves a committed retry. Stocktake resumes a partially saved attempt from validated inventory movement receipts before checking stale baselines, then applies only remaining counts.
- Images: Admin upload → shared HTTP validation (`http/image-upload.ts`) → R2 → D1 asset/media association → public `/media/:id`. All new uploads, including the retained Product multipart upload/replace endpoints, use data/media-upload.ts to create library-owned assets. Product media rows own versioned associations to these keys/URLs; historical product-scoped objects and public URLs still resolve. Library usage/deletion queries include Product media rows directly, including history. shared-media-attachment.ts owns availability predicates used atomically by Product add/replace, Section create/update and Appearance draft saves. Only newly used URLs require active library assets; unchanged archived references remain readable/editable. Section creation gates the node, version and audit together. Deletion must preserve version/history references and use ownership/claim checks; a D1 error is not permission to delete R2 data.
- Failed-upload compensation: `data/media-upload-cleanup.ts` checks both Product media (including historical rows) and shared-library ownership before deleting a newly generated upload key. The shared persistence service uses it if asset creation fails; failed ownership reads retain the object. Once a library asset exists, a failed Product attachment leaves it reusable in the library. Existing-asset deletion remains in the separate reference/claim lifecycle.
- Publication: Admin saves draft → domain publish updates published pointer → public feed verification. Static publication is a separate export/render/verify process; publishing a D1 record does not itself rewrite tracked HTML.

## Static generation and overwrite boundaries

`commerce/scripts/phase6-publication-candidate.mjs` reads the selected remote D1 database and reconciles with `assets/catalog.js` specialist metadata → candidate catalogue + manifest → `phase6-publication-package.mjs` runs Product renderer, collection renderer and verifier. `--check` builds twice and compares output hashes. Outputs include catalogue JS, Product HTML, collection HTML and sitemap. Use an isolated output directory; the package script clears its output directory before rendering. Manual changes to generated content may be overwritten.

`product-core-lib.mjs` and `fixtures/product-core-baseline.catalog.js` support guarded baseline imports/parity, not routine operational editing. `scripts/sync-romneys-official-data.py` can rewrite the static catalogue; review its use before treating it as a safe everyday content tool. `build-romneys-source-map.mjs` generates provenance documentation. `verify-search-readiness.mjs` checks static links/assets/schema/sitemap. Historical `.b64`/restore assets and `loader.js` require a separate reference audit before removal; filenames alone are not proof of obsolescence.

## Admin information architecture

All these are views/sheets in the existing Worker Admin, not separate applications.

| Home | Purpose / data | Overlap and intended disposition |
| --- | --- | --- |
| Dashboard | Operational summary and navigation | Keep read-only summaries; link to owning workspace. |
| Orders | Order status, revisions, refunds, communication | Keep detail actions together; reports are projections only. |
| Products | Identity, content, selling controls, images, placements | Full editor is the home; quick controls must call the same data functions. Stock links may expose the same inventory service, not an independent count store. |
| Catalogue | Website hierarchy and Brands & ranges | Keep hierarchy separate from classification; category picker belongs in Product editing, definition management here. |
| Website | Homepage, appearance, Media Library | Keep related tabs; all ordinary image selection/upload should use library helpers. |
| Stock | Counts, thresholds, Stocktake, valuation | Stocktake is the existing single bulk-count workflow; valuation is a derived subsection. |
| Reports | Business/operational metrics | Keep independent read-only reporting with data-class isolation. |
| Login/session | Authentication | Keep outside business-object navigation. No dedicated Customer or general Settings subsystem was identified; do not invent one. |

## Environment boundary

`commerce/wrangler.jsonc` explicitly separates production `black-sheep-commerce-prod` / `black-sheep-product-media-prod` from staging equivalents. Production owns API/Admin custom domains and collection/sitemap routes; staging uses its workers.dev host and no custom routes. Clean Product routes: production false, staging true. Order rate limits: production 5/minute, staging 10/minute. Both use a 30-minute cron and enable D1 catalogue/reservations. Staging allows local browser origins in addition to storefront origins.

Admin URLs, allowed origins, Turnstile hostname/action and sender address are configured; recipient, password, provider and verification secrets are external. `keep_vars` and preview overrides mean deployed configuration must be checked separately. Do not infer staging recipient isolation from the environment name. Production promotion is guarded by `commerce-deploy.yml`; pushing code is not evidence of Worker deployment. No secrets belong in these documents.
