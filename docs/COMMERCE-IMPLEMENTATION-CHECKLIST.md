# Black Sheep Commerce V1 — Execution Checklist

Updated: 25 September 2026
Repository: `Mo31D/Blacksheep`
Production source of truth: `main`

This is the resumable execution file. It distinguishes code-complete work from live account/deployment gates.

## Current implementation anchor

- Latest reconciled Commerce/storefront anchor before this documentation commit: `b24d5cc891fe3dae7558e5e564e6612789711381`.
- Search Readiness: PASS after legal sitemap reconciliation.
- Commerce CI: PASS on the current Commerce implementation: cart/page/legal checks, TypeScript, local D1 migrations, 51 Vitest tests, Wrangler staging dry-run.
- GitHub Pages: customer Commerce UI is deployed but public order submission is deliberately feature-gated OFF.
- Staging D1: `black-sheep-commerce-staging` — `d442b45d-93b6-4535-b76a-4b72e62dc271`.
- Production D1: `black-sheep-commerce-prod` — `c1afdb87-47a8-4f6b-bf4b-0ce9b5b41e52`.
- Staging Worker: `https://black-sheep-commerce-api-staging.ky6vfb55p9.workers.dev`.
- Staging deploy run `36070794885` completed successfully on 25 September 2026; GitHub Actions deployment credentials are working.
- Real staging owner-admin and manual-payment lifecycle verified through `COMPLETED` for test order `BSR-260924-2JAYTWT7`.

## Session rules

- [x] Preserve newest `main`; never force-push.
- [x] Keep canonical static product pages under `/products/<slug>.html`.
- [x] Never trust browser-submitted price or payment state.
- [x] Never commit Cloudflare, Resend, Turnstile or payment secrets.
- [x] Keep staging and production D1 separate.
- [x] Run Search Readiness after storefront/catalogue/sitemap changes.
- [x] Run Commerce CI after Commerce/API/cart/checkout/legal changes.

## Phase 0 — Architecture and preparation

Status: COMPLETE for Commerce V1 architecture and staging prerequisites.

- [x] Audit existing static storefront and catalogue architecture.
- [x] Define Worker + D1 Commerce architecture.
- [x] Define cart, order, notification, payment and shipping boundaries.
- [x] Create staging and production D1 resources.
- [x] Configure/verify staging Turnstile.
- [x] Configure/verify Resend staging email delivery.
- [x] Reserve production API target `api.theblacksheepshop.co.uk`.
- [x] Re-add the GitHub Actions deployment credentials required by Wrangler.

## Phase 1 — Commerce Worker foundation

Status: COMPLETE.

- [x] Worker project, TypeScript, Wrangler environments and CI.
- [x] `/health` endpoint.
- [x] Staging Worker previously deployed and remotely verified.
- [x] Exact CORS allowlist and structured API errors.
- [x] Production secrets kept out of source.

## Phase 2 — D1 order model

Status: COMPLETE.

- [x] `orders`, `order_items`, `order_events` schema.
- [x] Unique public reference and idempotency key.
- [x] Order/payment/fulfilment constraints and indexes.
- [x] Transaction-safe D1 persistence.
- [x] Remote staging initial migration previously verified.
- [x] Repository/data-access tests.

## Phase 3 — Server-authoritative catalogue

Status: COMPLETE.

- [x] Deterministic Commerce catalogue generated from `assets/catalog.js`.
- [x] Backend owns product identity, price, status and subtotal calculation.
- [x] Unpriced, arriving-soon and out-of-stock products rejected.
- [x] Catalogue drift check in CI.

## Phase 4 — Secure order creation API

Status: COMPLETE, including prior real staging verification.

- [x] `POST /v1/orders` request/schema validation.
- [x] UK delivery-address validation.
- [x] Server-side price/subtotal calculation.
- [x] Turnstile Siteverify on server.
- [x] Rate/payload/quantity limits.
- [x] Atomic order + items + event creation.
- [x] Idempotent retry protection.
- [x] Real staging Turnstile order submission verified.
- [x] Same idempotency key returned the same order without duplication.

## Phase 5 — Cart core

Status: COMPLETE.

- [x] Versioned `black-sheep-cart-v1` local cart.
- [x] One-time migration from legacy My List storage.
- [x] Quantity bounds and stale/unavailable-item handling.
- [x] Current price/status refresh on read.
- [x] Missing-image fallback.
- [x] Automated cart-core tests.

## Phase 6 — Mini basket

Status: COMPLETE ON `main`.

- [x] Header Basket treatment and item count.
- [x] Product image/placeholder, name, price and quantities.
- [x] Remove, clear confirmation and subtotal.
- [x] View Basket CTA and empty state.
- [x] Keyboard/focus and mobile behaviour.
- [x] Unavailable/unpriced products blocked from normal checkout.

## Phase 7 — Basket page

Status: COMPLETE ON `main`.

- [x] Responsive `basket.html`.
- [x] Line totals, quantities, subtotal and stale-state revalidation.
- [x] Empty state and accessible updates.
- [x] Desktop sticky summary and mobile layout.
- [x] Checkout CTA exists but is intentionally disabled until Phase 14.
- [x] `noindex,follow` and automated page-contract tests.

## Phase 8 — Checkout

Status: CODE COMPLETE ON `main`; public submission deliberately OFF.

- [x] Delivery / collection.
- [x] Customer/contact and conditional delivery address.
- [x] Optional note and client-side UX validation.
- [x] Review step.
- [x] Explicit no-payment-at-submission wording.
- [x] Privacy / delivery & returns / terms links.
- [x] Turnstile integration.
- [x] Loading/duplicate-click/network-failure handling.
- [x] Basket retained after failed submission.
- [x] Feature gate requires `enabled:true` plus a production API base before submission can activate.

## Phase 9 — Order submitted experience

Status: COMPLETE IN CODE; prior staging order/idempotency flow verified.

- [x] API submission sends catalogue IDs + quantities, not trusted prices.
- [x] Session idempotency key.
- [x] Cart clears only after confirmed API success.
- [x] Reference, item summary and next-step explanation.
- [x] `order-requested.html` with `noindex,follow`.
- [x] Recoverable failures reset Turnstile without losing basket.

## Phase 10 — Owner/customer notifications

Status: COMPLETE IN STAGING.

- [x] Provider abstraction.
- [x] Resend owner notification.
- [x] Resend customer acknowledgment.
- [x] Retry transient failures.
- [x] Record send/failure events without unnecessary PII.
- [x] Real staging customer message received.
- [x] Real staging owner message received.

## Phase 11 — Private owner admin

Status: COMPLETE AND LIVE-STAGING VERIFIED.

- [x] `/admin` UI.
- [x] Six-digit owner-email OTP.
- [x] Hashed login code/session storage.
- [x] 10-minute code expiry, attempt cap and request cooldown.
- [x] Secure HttpOnly SameSite=Strict 12-hour session.
- [x] Logout/session revocation.
- [x] Same-origin protection for every admin POST.
- [x] Order list/filter/detail/timeline.
- [x] Server-side quote/final total.
- [x] Payment request, paid, preparing, shipped/ready, completed/cancelled transitions.
- [x] Tracking fields.
- [x] Required delivery/collection timing before payment request.
- [x] Audit events for admin mutations.
- [x] Migration `0001_admin_email_auth.sql`.
- [x] Migration `0002_order_fulfilment_message.sql`.
- [x] Automated admin/auth/state-machine tests.
- [x] Remote staging D1 is current for `0001` + `0002` (deploy reported no pending migrations).
- [x] Deploy newest `main` Worker to staging.
- [x] Verify real owner-code login.
- [x] Run one complete staging admin lifecycle: `SUBMITTED → UNDER_REVIEW → QUOTED → AWAITING_PAYMENT → PAID → PREPARING → READY_FOR_COLLECTION → COMPLETED`.

## Phase 12 — Payment V1

Status: COMPLETE AND LIVE-STAGING VERIFIED.

- [x] Owner confirms final total.
- [x] Order-specific HTTPS payment request URL/reference.
- [x] Required delivery/collection timing before payment request.
- [x] Payment email includes final total, timing, seller contact details and legal links.
- [x] Owner-only transition to PAID.
- [x] Customer payment-received/order-confirmed acknowledgment.
- [x] No reusable public payment link.
- [x] No card/banking credentials stored.
- [x] Payment layer remains replaceable by a future gateway/webhook provider.
- [x] Send one real staging payment request from admin and verify customer email/event trail.
- [x] Mark that staging order PAID and verify payment-received acknowledgment/event trail.

## Phase 13 — Legal/privacy/customer information

Status: COMPLETE, INCLUDING OWNER IDENTITY AND LIVE INBOUND-EMAIL VERIFICATION.

- [x] `privacy.html`.
- [x] `delivery-returns.html`.
- [x] `terms.html`.
- [x] Trading address, phone and customer-service email displayed.
- [x] Cloudflare, Resend, order-data and browser-storage disclosures.
- [x] 14-day distance cancellation and further 14-day return wording.
- [x] Refund timing and standard-delivery refund wording.
- [x] Model cancellation form.
- [x] Faulty/not-as-described statutory rights preserved.
- [x] Legal links in checkout/shared footer.
- [x] Legal pages in sitemap.
- [x] Legal contract checks in Commerce CI.
- [x] GOV.UK distance-selling/returns guidance reviewed on 24 September 2026.
- [x] Current ICO storage/access guidance reviewed.
- [x] Legal business identity confirmed for the customer-facing legal pages as `The Black Sheep Shop`.
- [x] `orders@theblacksheepshop.co.uk` inbound email configured with Cloudflare Email Routing to the verified owner Gmail destination and live forwarding verified.

## Phase 14 — Production cutover

Status: IN PROGRESS; production shell/configuration prepared, public checkout still OFF.

- [x] Conservative production cutover runbook.
- [x] Customer Commerce UI on `main` with public ordering OFF.
- [x] Production workflow checks Cloudflare credentials.
- [x] Production workflow requires explicit `DEPLOY-PRODUCTION` confirmation.
- [x] Production command applies pending D1 migrations before Worker deploy.
- [x] Add/re-add GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- [x] Complete Phase 11/12 live staging verification.
- [x] Confirm Phase 13 business-identity/inbound-email items.
- [x] Create production Worker shell `black-sheep-commerce-api` without GitHub auto-deploy.
- [x] Configure production Worker secrets/variables for Turnstile, Resend and owner email.
- [x] Create separate production Turnstile widget/secret.
- [x] Create separate Resend production API key.
- [x] Attach `api.theblacksheepshop.co.uk` as the production Worker Custom Domain.
- [x] Apply production D1 migrations (`0000`, `0001`, `0002`) via guarded run `36078963186`.
- [x] Deploy production Worker from `main` commit `19418b02473e4d8122b0214021cc1196e84daa3d`.
- [x] Production Worker deployment version: `938f0651-20b5-48df-a8d4-f84defbb263d`.
- [ ] Verify production `/health` and `/admin`.
- [ ] Point checkout config to production API and switch public feature gates ON.
- [ ] Test delivery + collection on mobile/desktop.
- [ ] Verify duplicate protection and API-error cart preservation.
- [ ] Verify owner/customer notifications.
- [ ] Run one controlled low-value production order lifecycle.
- [ ] Search Readiness PASS.
- [ ] Commerce CI PASS.
- [ ] GitHub Pages deployment PASS.
- [ ] Commerce Worker deployment PASS.
- [ ] Update handoff with final production SHA/resources.

## Phase 15 — Future full ecommerce

Status: FUTURE PROGRAM; not part of Commerce V1 production cutover.

- [ ] Automatic inventory/stock.
- [ ] Integrated payment gateway / Apple Pay / Google Pay.
- [ ] Verified payment webhooks.
- [ ] Automatic shipping rates/labels/tracking.
- [ ] Customer accounts/order history.
- [ ] Refund automation.
- [ ] Discounts/promotions.
- [ ] Tax/VAT automation if required.
- [ ] Product/admin CMS.
- [ ] Analytics and abandoned-cart workflow.
- [ ] Inventory reservations.

These Phase 15 items require provider/business decisions and should not be silently enabled as part of the manual-payment Commerce V1 launch.

## Current exact next action

Phases 11, 12 and 13 are complete. Phase 14 production setup is now in progress.

Completed in the production setup:
- Production Worker shell `black-sheep-commerce-api` created.
- Separate production Turnstile secret configured.
- Separate production Resend API key configured.
- `ORDER_OWNER_EMAIL` configured.
- Custom Domain `api.theblacksheepshop.co.uk` attached.
- Public storefront checkout remains feature-gated OFF.

Next:
1. Verify `https://api.theblacksheepshop.co.uk/health` returns the production environment with D1 and notifications configured.
2. Verify owner login at `https://api.theblacksheepshop.co.uk/admin` and confirm the production order list loads.
3. Only after production API/admin checks pass, update the storefront with the production Turnstile Site Key, point checkout to `https://api.theblacksheepshop.co.uk`, and switch the public feature gates ON.
4. Complete delivery/collection, duplicate-protection, cart-preservation, notification and controlled low-value production lifecycle QA.
5. Record final production SHA/resources in the handoff.

Guarded production deploy run `36078963186` succeeded. Production D1 migrations `0000`, `0001`, and `0002` were applied and Worker version `938f0651-20b5-48df-a8d4-f84defbb263d` was deployed. Public storefront checkout remains OFF pending production health/admin verification.
