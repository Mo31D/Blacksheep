# Black Sheep Commerce V1 — Execution Checklist

Updated: 24 September 2026  
Repository: `Mo31D/Blacksheep`

This is the resumable execution file for the Commerce project. Update it after each completed milestone.

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

Status: IN PROGRESS

- [x] Audit current site architecture.
- [x] Establish 146-product baseline.
- [x] Identify current My List image-pending bug.
- [x] Define Commerce V1 target architecture.
- [x] Decide on Cloudflare Worker + D1 backend.
- [x] Define future-ready cart/order/payment/shipping boundaries.
- [ ] Complete manual Cloudflare prerequisites in `docs/CLOUDFLARE-COMMERCE-SETUP.md`.
- [ ] Create `commerce-v1` branch from the newest `main`.
- [ ] Confirm staging/production hostname strategy.

**Exit condition:** required Cloudflare identifiers/secrets exist and the Commerce branch starts from the current production main.

## Phase 1 — Commerce project skeleton

Goal: backend deploys before changing customer UX.

- [ ] Add `commerce/package.json`.
- [ ] Add TypeScript configuration.
- [ ] Add `commerce/wrangler.jsonc`.
- [ ] Add Worker entry point.
- [ ] Add `GET /health`.
- [ ] Configure staging and production environments.
- [ ] Add CORS allowlist for the production/staging storefront.
- [ ] Add structured response/error helpers.
- [ ] Add unit-test runner.
- [ ] Add `.github/workflows/commerce-ci.yml`.
- [ ] Add `.github/workflows/commerce-deploy.yml`.
- [ ] Deploy staging Worker.
- [ ] Verify health endpoint remotely.

**Validation:**
- existing Search readiness PASS
- Commerce tests PASS
- TypeScript PASS
- Worker deployment PASS
- no production secrets in repository

**Suggested commit boundary:** `commerce: add worker skeleton and CI`

## Phase 2 — D1 order model

Goal: real persistent orders exist before checkout is connected.

- [ ] Add initial D1 migration.
- [ ] Create `orders` table.
- [ ] Create `order_items` table.
- [ ] Create `order_events` table.
- [ ] Add unique public reference.
- [ ] Add unique idempotency key.
- [ ] Add status constraints/validation.
- [ ] Add indexes needed for owner queue and reference lookup.
- [ ] Bind staging D1.
- [ ] Apply staging migration.
- [ ] Add repository/data-access layer.
- [ ] Add transaction-safe order creation.
- [ ] Add tests for persistence and duplicate idempotency.

**Suggested commit:** `commerce: add D1 order persistence`

## Phase 3 — Server-authoritative catalogue snapshot

Goal: the API never trusts frontend price data.

- [ ] Add `scripts/build-commerce-catalog.mjs`.
- [ ] Generate minimal backend catalogue from `assets/catalog.js`.
- [ ] Include product ID/SKU/slug/name/price/status/options only.
- [ ] Define purchasability rules.
- [ ] Reject arriving-soon products.
- [ ] Reject out-of-stock products.
- [ ] Reject products without confirmed numeric price.
- [ ] Make generated snapshot deterministic.
- [ ] Add `--check` drift mode.
- [ ] Include the check in CI.
- [ ] Unit-test subtotal calculation.

**Suggested commit:** `commerce: add authoritative catalogue snapshot`

## Phase 4 — Secure order creation API

Goal: `POST /v1/orders` creates a valid real order.

- [ ] Define request/response schema.
- [ ] Validate customer fields.
- [ ] Validate fulfilment method.
- [ ] Validate UK address fields when delivery is selected.
- [ ] Validate product IDs and quantities.
- [ ] Recalculate price/subtotal server-side.
- [ ] Generate non-guessable internal ID.
- [ ] Generate readable public reference.
- [ ] Enforce idempotency.
- [ ] Integrate Turnstile server verification.
- [ ] Add request-size and quantity limits.
- [ ] Add rate/abuse controls.
- [ ] Persist order + items + initial event atomically.
- [ ] Return public reference and safe summary.
- [ ] Test forged price attempt.
- [ ] Test stale/deleted product.
- [ ] Test arriving-soon/out-of-stock/unpriced product.
- [ ] Test duplicate submission.
- [ ] Test invalid/expired/replayed Turnstile token.

**Suggested commit:** `commerce: create secure order-request endpoint`

## Phase 5 — Cart engine refactor

Goal: replace My List internals without losing current users.

- [ ] Create cart domain model.
- [ ] Create storage adapter interface.
- [ ] Implement `LocalCartStore`.
- [ ] Implement old My List one-time migration.
- [ ] Preserve valid saved quantities.
- [ ] Drop stale/nonexistent catalogue rows safely.
- [ ] Fix missing-image handling.
- [ ] Add price/status refresh from current catalogue.
- [ ] Add quantity bounds.
- [ ] Prevent non-purchasable products entering checkout.
- [ ] Add automated cart tests.
- [ ] Keep UI independent from storage implementation.

**Suggested commit:** `commerce: replace previsit list with cart core`

## Phase 6 — Mini basket

- [ ] Replace header My List treatment with Basket.
- [ ] Item count.
- [ ] Item image/placeholder.
- [ ] Product name.
- [ ] Unit price.
- [ ] Quantity controls.
- [ ] Remove.
- [ ] Subtotal.
- [ ] Clear basket with confirmation.
- [ ] View Basket CTA.
- [ ] Proper empty state.
- [ ] Keyboard/focus trap.
- [ ] Mobile behaviour.
- [ ] No broken image state.

**Suggested commit:** `commerce: add mini basket`

## Phase 7 — `basket.html`

- [ ] Full responsive basket page.
- [ ] Product rows.
- [ ] Quantity updates.
- [ ] Line totals.
- [ ] Subtotal.
- [ ] Delivery/collection explanation.
- [ ] Continue CTA.
- [ ] Stale price/status revalidation.
- [ ] Empty basket route/state.
- [ ] Accessible announcements for cart changes.
- [ ] Sticky summary on desktop.
- [ ] mobile action treatment.

**Suggested commit:** `commerce: add basket page`

## Phase 8 — Checkout

- [ ] Create `checkout.html`.
- [ ] Fulfilment choice: delivery / collection.
- [ ] Customer name/email/phone.
- [ ] Delivery address fields when required.
- [ ] Optional order note.
- [ ] Client-side validation for UX only.
- [ ] Persist non-sensitive checkout draft locally.
- [ ] Review step.
- [ ] Explain no payment is taken yet.
- [ ] Privacy notice/link.
- [ ] Turnstile.
- [ ] Loading state.
- [ ] Block duplicate click.
- [ ] Recover cleanly from API/network failure.

**Suggested commit:** `commerce: add checkout and review flow`

## Phase 9 — Order submitted experience

- [ ] Send request to Commerce API.
- [ ] Clear cart only after confirmed successful creation.
- [ ] Show public order/request reference.
- [ ] Show submitted item summary.
- [ ] Explain next step.
- [ ] Explain delivery/payment confirmation process.
- [ ] Handle idempotent retry.
- [ ] No false “paid” or “confirmed order” wording.

**Suggested commit:** `commerce: connect checkout to order API`

## Phase 10 — Owner notifications

Email is a notification channel, not storage.

- [ ] Define `OrderNotifier` interface.
- [ ] Notify owner for new SUBMITTED order.
- [ ] Include reference and admin link.
- [ ] Add customer acknowledgment.
- [ ] Record notification outcome/event.
- [ ] Avoid customer PII in unnecessary logs.
- [ ] Retry transient failures safely.

Provider decision:
- [ ] Cloudflare Email Service, or
- [ ] alternate transactional provider through the same adapter.

**Suggested commit:** `commerce: add order notifications`

## Phase 11 — Private owner admin

- [ ] Admin UI.
- [ ] Protect with Cloudflare Access.
- [ ] List/filter active orders.
- [ ] Order details.
- [ ] Order timeline.
- [ ] Set delivery charge.
- [ ] Recalculate final total on server.
- [ ] Move to QUOTED/AWAITING_PAYMENT.
- [ ] Record secure payment-request link/reference.
- [ ] Mark payment confirmed.
- [ ] Mark PREPARING.
- [ ] Add tracking.
- [ ] Mark SHIPPED/READY_FOR_COLLECTION.
- [ ] Complete/cancel.
- [ ] Validate allowed state transitions.
- [ ] Never expose admin endpoints without Access/server authorization.

**Suggested commits:** split admin list/detail and admin mutations into separate milestones.

## Phase 12 — Payment V1

Current manual payment model:

- [ ] Owner confirms final total.
- [ ] Owner creates a secure payment request.
- [ ] Payment request is associated with the order.
- [ ] Customer receives payment instructions/link.
- [ ] Owner verifies receipt.
- [ ] Owner marks PAID.

Rules:

- [ ] no reusable payment link in public storefront
- [ ] no payment-card data stored
- [ ] no order may become PAID from client-side input alone

Future provider integration must implement the same payment interface and update orders from verified server-side webhooks.

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

1. Owner completes only the manual Cloudflare prerequisites listed in `docs/CLOUDFLARE-COMMERCE-SETUP.md`.
2. Create `commerce-v1` from the newest `main`.
3. Execute Phase 1 only.
4. Do not start cart/checkout UI before Worker staging health + CI are stable.
