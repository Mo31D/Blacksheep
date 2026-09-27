# Black Sheep Commerce Platform

Cloudflare Worker backend and owner Admin for The Black Sheep Shop.

## Current architecture

The Commerce platform is live and production-backed. It includes:

- authenticated owner Admin on the Commerce Worker
- D1-backed Products, product drafts/publication, Orders, revisions, refunds and reporting
- inventory, reservations, stocktake sessions and stock valuation
- storefront structure, homepage merchandising and appearance drafts/publication
- shared R2 Media Library with reusable Product / Homepage / Section references
- Turnstile-protected order submission
- Resend owner/customer notifications
- staging and production environments
- dynamic public catalogue, collection and sitemap delivery
- regression, browser-script, migration and publication checks

The implementation programme and production evidence are tracked in
`../docs/PLATFORM-IMPLEMENTATION-CARDS-2026-09-26.md` and
`../docs/SESSION-HANDOFF.md`.

## Local validation

Use the lockfile and run the complete gate:

```sh
npm ci
npm run check
```

`npm run check` is the source-of-truth local validation command. It covers
TypeScript, generated Admin JavaScript, migrations, inventory/reservation
regressions, dynamic storefront contracts, Vitest and Wrangler dry-run checks.

## Local development

```sh
npm run dev
```

## Environments and release discipline

- **Staging** is the integration environment for migrations, Admin browser QA,
  checkout/review flows and publication checks.
- **Production** uses the top-level Wrangler environment and live D1/R2 bindings.
- Production schema or Worker changes must go through the guarded release path;
  do not bypass migration/preflight checks with an ad-hoc deploy.
- The public storefront remains available during API failure through the
  documented static-fallback behaviour.

See `wrangler.jsonc` and the workflows under `../.github/workflows/` for the
exact bindings and automated gates.

## Admin ownership rules

Each owner task has one primary home:

- **Orders** — fulfilment, revisions, customer communication and refunds
- **Products** — product content, live selling controls, media and product audit
- **Catalogue** — website structure and Brands & ranges
- **Website** — homepage merchandising, appearance and shared Media Library
- **Stock** — quantities, thresholds, stocktake and stock value
- **Reports** — business/operations reporting

Compatibility fields may remain in D1 for historical data, but they must not
create a second owner-facing source of truth. For example, the legacy Product
`brand` text is projected from the selected Brand/Range classification in the
current Admin.

## Secrets

Never commit:

- Cloudflare API tokens
- Admin authentication secrets
- Turnstile secret keys
- Resend/email-provider secrets
- payment-provider secrets

See `../docs/CLOUDFLARE-COMMERCE-SETUP.md` for environment setup.
