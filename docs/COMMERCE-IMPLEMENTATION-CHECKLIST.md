# Black Sheep Commerce V1 — Execution Checklist

Updated: 24 September 2026  
Repository: `Mo31D/Blacksheep`

This is the resumable execution file for the Commerce project. Update it after each completed milestone.

## Current implementation anchor

- Commerce work started from production `main` at `ff8d62bf19a0902b5ed8061cba7e975dc9ffd39c`.
- Phase 1 Worker skeleton was validated on `commerce-v1`, merged to `main`, and revalidated on `main`.
- Current Commerce foundation commit on `main`: `a9834b08f463a39eee5165468b325fc0e58dd1c2`.
- Commerce CI on `main`: PASS (TypeScript + 5 tests + Wrangler staging dry-run).
- Existing Search readiness on `main`: PASS.
- Cloudflare D1 staging + production databases are created and their IDs are recorded in Wrangler. Turnstile and later production secrets are still pending.
- Do not start Phase 2 or customer-facing Basket/Checkout work until the staging Worker is deployed and `/health` is verified remotely.

## Rules for every session

- [ ] Fetch/check newest GitHub `main` before relying on any SHA.
- [ ] Read `docs/NEXT-PHASE-BASELINE-2026-09-24.md`.
- [ ] Read `docs/COMMERCE-ARCHITECTURE-2026-09-24.md`.
- [ ] Read this checklist.
- [ ] Preserve every newer remote commit.
- [ ] Never force-push.
- [ ] Keep current canonical static product architecture.
- [ ] Do not trust browser-submitted prices.
- [ ] Do not expose secrets in frontend/code.
- [ ] Keep each implementation commit narrow and reversible.
- [ ] Run existing search-readiness after any storefront/catalogue change.
- [ ] Update this checklist before ending a long implementation session.

## Phase 0 — Architecture and preparation

Status: IN PROGRESS — waiting only on manual Cloudflare prerequisites / staging deployment.

- [x] Audit current site architecture.
- [x] Establish 146-product baseline.
- [x] Identify current My List image-pending bug.
- [x] Define Commerce V1 target architecture.
- [x] Decide on Cloudflare Worker + D1 backend.
- [x] Define future-ready cart/order/payment/shipping boundaries.
- [ ] Complete manual Cloudflare prerequisites in `docs/CLOUDFLARE-COMMERCE-SETUP.md` (D1 complete; Turnstile widget created; secret binding still pending).
- [x] Create `commerce-v1` branch from the newest `main`.
- [x] Confirm hostname strategy: staging on `workers.dev` first; production later on `api.theblacksheepshop.co.uk`.

**Exit condition:** required Cloudflare identifiers/secrets exist and the Commerce branch starts from the current production main.

## Phase 1 — Commerce project skeleton

Status: COMPLETE — staging Worker deployed, build verified, and `/health` confirmed remotely.

Goal: backend deploys before changing customer UX.

- [x] Add `commerce/package.json`.
- [x] Add TypeScript configuration.
- [x] Add `commerce/wrangler.jsonc`.
- [x] Add Worker entry point.
- [x] Add `GET /health`.
- [x] Configure staging and production environments.
- [x] Add CORS allowlist for the production/staging storefront.
- [x] Add structured response/error helpers.
- [x] Add unit-test runner.
- [x] Add `.github/workflows/commerce-ci.yml`.
- [x] Add `.github/workflows/commerce-deploy.yml`.
- [x] Confirm Commerce CI passes on `commerce-v1` (5 tests + TypeScript + Wrangler staging dry-run passed).
- [x] Deploy staging Worker at `https://black-sheep-commerce-api-staging.ky6vfb55p9.workers.dev`.
- [x] Verify `/health` response remotely from a browser/session: `{"service":"black-sheep-commerce-api","status":"ok","environment":"staging"}`.

**Validation:**
- existing Search readiness PASS
- Commerce tests PASS
- TypeScript PASS
- Worker dry-run PASS
- Worker deployment PASS
- no production secrets in repository

**Commit boundary:** `commerce: add worker skeleton and CI`

## Phase 2 — D1 order model

Cloudflare D1 resources:
- [x] `black-sheep-commerce-staging` — `d442b45d-93b6-4535-b76a-4b72e62dc271`
- [x] `black-sheep-commerce-prod` — `c1afdb87-47a8-4f6b-bf4b-0ce9b5b41e52`

Status: COMPLETE — remote staging migration applied and verified.

Goal: real persistent orders exist before checkout is connected.

- [x] Add initial D1 migration.
- [x] Create `orders` table.
- [x] Create `order_items` table.
- [x] Create `order_events` table.
- [x] Add unique public reference.
- [x] Add unique idempotency key.
- [x] Add status constraints/validation.
- [x] Add indexes needed for owner queue and reference lookup.
- [x] Bind staging D1 in Wrangler config.
- [x] Apply migration to remote staging D1 and verify `orders`, `order_items`, `order_events`, plus `d1_migrations`.
- [x] Add repository/data-access layer.
- [x] Add transaction-safe order creation using D1 batch.
- [x] Add tests for persistence and duplicate idempotency lookup.

**Validation:** local D1 migration PASS (8 SQL commands), remote staging migration PASS, staging tables verified in Cloudflare Console, 8 automated tests PASS, TypeScript PASS, Wrangler staging dry-run PASS.

**Commit:** `commerce: add D1 order persistence`

## Phase 3 — Server-authoritative catalogue snapshot

Status: COMPLETE.

Goal: the API never trusts frontend price data.

- [x] Add `scripts/build-commerce-catalog.mjs`.
- [x] Generate minimal backend catalogue from `assets/catalog.js`.
- [x] Include product ID/SKU/slug/name/price/status/options only.
- [x] Define purchasability rules.
- [x] Reject arriving-soon products.
- [x] Reject out-of-stock products.
- [x] Reject products without confirmed numeric price.
- [x] Make generated snapshot deterministic.
- [x] Add `--check` drift mode.
- [x] Include the check in CI.
- [x] Unit-test authoritative subtotal calculation.

Current snapshot:
- 146 catalogue products
- 116 purchasable
- prices represented in GBP minor units
- backend rejects unavailable/unpriced products and invalid/duplicate cart lines

Validation: Commerce CI PASS; Search readiness PASS.

**Commits:** `commerce: add authoritative catalogue snapshot`, `commerce: add authoritative cart pricing`

## Phase 4 — Secure order creation API

Status: CODE + CI COMPLETE — staging Turnstile secret configured; live token/order verification deferred until checkout widget is wired.

Goal: `POST /v1/orders` creates a valid real order.

- [x] Define request/response schema.
- [x] Validate customer fields.
- [x] Validate fulfilment method.
- [x] Validate UK address fields when delivery is selected.
- [x] Validate product IDs and quantities.
- [x] Recalculate price/subtotal server-side.
- [x] Generate non-guessable internal ID.
- [x] Generate readable public reference.
- [x] Enforce idempotency.
- [x] Integrate mandatory Turnstile server verification in code.
- [x] Add request-size and quantity limits.
- [x] Add Worker rate-limit binding and abuse controls.
- [x] Persist order + items + initial event atomically.
- [x] Return public reference and safe summary.
- [x] Test forged price attempt.
- [x] Test stale/deleted product.
- [x] Test arriving-soon/out-of-stock/unpriced products.
- [x] Test duplicate submission.
- [x] Test invalid/expired/replayed Turnstile token.
- [x] Add `TURNSTILE_SECRET_KEY` to the staging Worker secret store.
- [ ] Verify a real staging Turnstile token against `POST /v1/orders`.
- [ ] Confirm a test order is written to staging D1 and an idempotent retry does not create a duplicate.

Validation: Commerce CI PASS; 32 automated tests PASS; catalogue drift check PASS; local D1 migration PASS; Wrangler staging dry-run PASS.

**Commits:** `commerce: add secure order creation API`, follow-up test coverage.

## Phase 5 — Cart engine refactor

Status: COMPLETE.

Goal: replace My List internals without losing current users.

- [x] Create cart domain model.
- [x] Create storage adapter interface.
- [x] Implement localStorage-backed cart store.
- [x] Implement old My List one-time migration.
- [x] Preserve valid saved quantities.
- [x] Drop stale/nonexistent catalogue rows safely.
- [x] Fix missing-image handling with a safe placeholder.
- [x] Refresh current price/status from the live catalogue on every cart read.
- [x] Add quantity bounds (1–99).
- [x] Prevent newly unavailable/unpriced products entering the cart and block checkout when migrated rows are unavailable.
- [x] Add automated cart-core tests.
- [x] Keep cart UI independent from storage implementation.

Storage:
- new key: `black-sheep-cart-v1`
- legacy key: `black-sheep-previsit-list-v1`
- successful legacy migration writes the new versioned envelope and removes the old key.

Validation:
- Commerce CI PASS
- cart-core migration/quantity/availability/current-price tests PASS
- existing Commerce API tests PASS
- Wrangler staging dry-run PASS

**Commits:** `commerce: replace previsit storage with cart core`, storage-adapter/test follow-ups.

## Phase 6 — Mini basket

Status: COMPLETE ON `commerce-v1` — intentionally not merged to live site until the customer flow is complete.

- [x] Replace header My List treatment with Basket.
- [x] Item count.
- [x] Item image/placeholder.
- [x] Product name.
- [x] Unit price.
- [x] Quantity controls.
- [x] Remove.
- [x] Subtotal.
- [x] Clear basket with confirmation.
- [x] View Basket CTA.
- [x] Proper empty state.
- [x] Keyboard/focus trap.
- [x] Mobile behaviour.
- [x] No broken image state.
- [x] Disable normal basket addition for arriving-soon/out-of-stock/unpriced products.

Validation: Commerce CI PASS.

**Commit boundary:** `commerce: upgrade My List UI to mini basket`

## Phase 7 — `basket.html`

Status: CODE COMPLETE ON `commerce-v1` — checkout CTA remains gated until Phase 8 exists.

- [x] Full responsive basket page.
- [x] Product rows.
- [x] Quantity updates.
- [x] Line totals.
- [x] Subtotal.
- [x] Delivery/collection next-step explanation.
- [x] Continue CTA present and safely gated until checkout is ready.
- [x] Stale price/status revalidation from the current catalogue.
- [x] Empty basket route/state.
- [x] Accessible live region for basket changes.
- [x] Sticky summary on desktop.
- [x] Mobile layout/action treatment.
- [x] `noindex,follow` metadata.
- [x] Automated page-contract checks.

Validation: Commerce CI PASS.

**Commit boundary:** `commerce: add basket page`

## Phase 8 — Checkout

Status: COMPLETE ON `commerce-v1` — intentionally not live yet.

- [x] Create `checkout.html`.
- [x] Fulfilment choice: delivery / collection.
- [x] Customer name/email/phone.
- [x] Delivery address fields when required.
- [x] Optional order note.
- [x] Client-side validation for UX only.
- [x] Persist only non-sensitive checkout draft state locally (fulfilment choice; personal fields are not persisted).
- [x] Review step.
- [x] Explain no payment is taken yet.
- [x] Inline checkout privacy notice.
- [x] Turnstile widget/action integration.
- [x] Loading state.
- [x] Block duplicate click.
- [x] Recover cleanly from API/network failure.
- [x] Keep basket safe when submission fails.
- [x] Checkout page is `noindex,follow`.

Validation: Commerce CI PASS; checkout page contract checks PASS; static JS parse PASS.

**Commit boundary:** `commerce: add checkout and review flow`

## Phase 9 — Order submitted experience

Status: CODE COMPLETE ON `commerce-v1` — one real staging Turnstile/order test remains before customer UI can be merged.

- [x] Send request to Commerce API.
- [x] Send product IDs + quantities only; backend remains authoritative for prices.
- [x] Use a session idempotency UUID and preserve it across network retries.
- [x] Clear cart only after confirmed successful creation.
- [x] Show public order/request reference.
- [x] Show submitted item summary.
- [x] Explain next step.
- [x] Explain delivery/payment confirmation process.
- [x] Handle idempotent retry.
- [x] Reset Turnstile after recoverable failures.
- [x] No false “paid” or “confirmed order” wording.
- [x] Add `order-requested.html` with `noindex,follow`.
- [ ] Perform one real staging submission from the production hostname with Turnstile.
- [ ] Confirm exactly one order + item/event snapshot in staging D1.
- [ ] Repeat the same request/idempotency key and confirm no duplicate order.

Validation so far: Commerce CI PASS; order confirmation page contract checks PASS.

**Commit boundary:** `commerce: connect checkout to order API`

## Phase 10 — Owner notifications

Status: CODE COMPLETE ON `commerce-v1` — Cloudflare Email Service domain/binding configuration is still required before emails are enabled.

Email remains a notification channel, not storage.

- [x] Define `OrderNotifier` interface.
- [x] Add Cloudflare Email Service notifier adapter.
- [x] Compose owner notification for new SUBMITTED orders.
- [x] Compose customer acknowledgment with explicit “no payment taken” wording.
- [x] Include reference and order summary without relying on email as storage.
- [x] Record notification success/failure in `order_events`.
- [x] Avoid customer PII in notification failure metadata/logging.
- [x] Retry transient send failures once without failing order creation.
- [ ] Onboard `theblacksheepshop.co.uk` to Cloudflare Email Service.
- [ ] Configure the Worker `EMAIL` send binding.
- [ ] Configure `ORDER_EMAIL_FROM` and `ORDER_OWNER_EMAIL`.
- [ ] Send one owner + customer staging email and verify delivery.

Provider: Cloudflare Email Service behind the `OrderNotifier` abstraction, so it can be replaced later without changing checkout/order business logic.

**Commit:** `commerce: add order notification architecture`

## Phase 11 — Private owner admin

Status: CODE COMPLETE ON `commerce-v1` — Cloudflare Access application/hostname values are required before deployment.

- [x] Add private admin UI served by the Commerce Worker.
- [x] Add authenticated order list/filter.
- [x] Add order detail with customer, fulfilment, items and event timeline.
- [x] Add delivery charge and server-calculated final total.
- [x] Add QUOTED / AWAITING_PAYMENT workflow.
- [x] Record secure payment-request URL/reference.
- [x] Mark payment confirmed.
- [x] Mark PREPARING.
- [x] Add tracking and mark SHIPPED for delivery.
- [x] Mark READY_FOR_COLLECTION for collection.
- [x] Complete/cancel permitted orders.
- [x] Validate allowed state transitions server-side.
- [x] Record every admin mutation in `order_events`.
- [x] Validate Cloudflare Access JWT cryptographically using account JWKS + application AUD.
- [x] Optional admin email allowlist after JWT verification.
- [x] Fail closed unless the exact configured admin hostname is used.
- [ ] Enable/configure Cloudflare Zero Trust Access.
- [ ] Create the protected admin hostname/application.
- [ ] Configure `ADMIN_HOSTNAME`, `ADMIN_TEAM_DOMAIN`, `ADMIN_ACCESS_AUD`, and `ADMIN_ALLOWED_EMAILS`.
- [ ] Verify login and one complete staging admin workflow.

**Commit:** `commerce: add Access-protected owner admin`

## Phase 12 — Payment V1

Status: CODE COMPLETE ON `commerce-v1` — payment remains owner-confirmed/manual until a future integrated gateway is added.

- [x] Owner can confirm the final total in the private admin.
- [x] Owner can associate a secure payment-request URL/reference with the order.
- [x] Customer payment-request email uses the order-specific final total and stored secure URL.
- [x] Payment-request email outcome is recorded in `order_events`.
- [x] Owner can verify receipt and mark the order PAID.
- [x] Customer receives payment-recorded acknowledgment when email sending is configured.
- [x] No reusable payment URL is exposed in the public storefront.
- [x] No payment-card data is stored.
- [x] No order can become PAID from client-side/customer input.
- [x] Payment logic is isolated from the future gateway/webhook architecture.

Manual/live verification still required:
- [ ] Configure Cloudflare Email Service and sender.
- [ ] Send one staging payment request from admin and verify the amount/link.
- [ ] Mark it paid and verify the acknowledgment/event trail.

Future gateway integration will replace the manual payment-request step with provider sessions + verified server-side webhooks without changing basket/checkout/order identity.

**Commit:** `commerce: complete manual payment workflow`

## Phase 13 — Legal/privacy/customer information

Before public launch of order collection:

- [ ] privacy notice for collected checkout data
- [ ] delivery information
- [ ] returns/cancellation information
- [ ] business/contact information
- [ ] wording reviewed for distance-sale flow
- [ ] data-retention policy for abandoned/cancelled/completed orders
- [ ] cookie/storage disclosure for necessary cart storage where applicable

## Phase 14 — Production cutover

- [ ] Apply production D1 migrations.
- [ ] Configure production Worker bindings/secrets.
- [ ] Configure production Turnstile hostnames.
- [ ] Attach `api.theblacksheepshop.co.uk`.
- [ ] Protect admin hostname/path with Cloudflare Access.
- [ ] Test order lifecycle using a real low-value test product/process.
- [ ] Verify owner notification.
- [ ] Verify customer acknowledgment.
- [ ] Verify mobile checkout.
- [ ] Verify duplicate protection.
- [ ] Verify API errors do not lose the cart.
- [ ] Search readiness PASS.
- [ ] Commerce CI PASS.
- [ ] GitHub Pages deployment PASS.
- [ ] Commerce Worker deployment PASS.
- [ ] Update handoff with final production SHA and Cloudflare resource names.

## Phase 15 — Future full ecommerce

Not required for Commerce V1, but architecture must not block:

- [ ] automatic stock/inventory
- [ ] Stripe/other payment gateway
- [ ] Apple Pay / Google Pay through supported gateway
- [ ] payment webhooks
- [ ] automatic shipping rates
- [ ] labels and tracking
- [ ] customer accounts
- [ ] saved addresses
- [ ] order-history portal
- [ ] refunds
- [ ] discounts/promotions
- [ ] tax/VAT automation if required
- [ ] product/admin CMS
- [ ] analytics
- [ ] abandoned-cart workflow
- [ ] inventory reservations

## Current exact next action

1. Keep customer-facing Commerce work on `commerce-v1`; do not merge it to the live storefront yet.
2. Deploy/serve the checkout flow on an allowed Turnstile hostname for one controlled staging order.
3. Confirm exactly one row in `orders`, the expected `order_items`, and the initial `order_events` entry in staging D1.
4. Retry the same submission/idempotency key and confirm no duplicate order is created.
5. Only after that verification, move to Phase 10 notifications and prepare the production cutover path.
