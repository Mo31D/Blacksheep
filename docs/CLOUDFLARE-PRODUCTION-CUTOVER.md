# Black Sheep Commerce V1 — Production Cutover Runbook

Updated: 24 September 2026  
Branch: `commerce-v1`

This runbook is deliberately conservative. Do not apply production D1 migrations, attach production custom domains or merge the customer-facing Commerce branch until the staging order path has been verified end to end.

## Current safe state

- Production storefront `main` remains separate from the Commerce UI.
- Production D1 exists but has not been migrated/touched for live orders.
- Staging Worker and staging D1 are deployed.
- Staging Turnstile secret is configured.
- Commerce code is complete through Phase 13 on `commerce-v1`.
- Controlled staging order/idempotency verification has passed.
- Resend staging delivery has passed for both customer and owner notifications.
- Cloudflare Access is no longer required: the admin now uses an owner-email one-time-code login stored as hashed D1 state.
- Temporary staging verifier pages have been removed after their gates passed.

## Gate A — controlled staging order

1. Open:
   `https://theblacksheepshop.co.uk/commerce-stage-check-260924.html`
2. Complete the Turnstile check.
3. Press **Run staging test** once.
4. Expected result:
   - first request: HTTP 201
   - retry: HTTP 200
   - same public reference both times
   - `idempotentReplay=true` on retry
5. In staging D1 confirm:
   - exactly one `orders` row for that public reference
   - expected `order_items` row(s)
   - initial `order_events` entry
6. Record the reference in the handoff.
7. Remove the temporary verifier page from `main` after the test is complete.

Do not perform this test against production D1.

## Gate B — customer email

Status: **PASSED in staging on 24 September 2026.**

Provider: **Resend** using the verified `theblacksheepshop.co.uk` domain.

Verified:
- `orders@theblacksheepshop.co.uk` sends successfully.
- Customer acknowledgment was received.
- Owner notification was received after correcting `ORDER_OWNER_EMAIL`.
- The Worker uses `RESEND_API_KEY` as a secret.
- `ORDER_EMAIL_FROM` and `ORDER_OWNER_EMAIL` are runtime variables.
- Notification outcomes are recorded in `order_events`.
- The Cloudflare Workers fetch receiver bug was fixed so Resend requests execute correctly.
- The temporary staging email verifier has been removed from `main`.

Do not replace the working Resend integration during cutover unless there is a specific migration requirement.

## Gate C — private owner admin

The current admin no longer depends on Cloudflare Zero Trust Access.

Authentication model:
- Admin is served by the Commerce Worker at `/admin`.
- Pressing **Send login code** sends a six-digit one-time code to the configured `ORDER_OWNER_EMAIL`.
- Codes expire after 10 minutes, have a failed-attempt cap and are stored hashed in D1.
- Successful login creates a hashed server-side session with a Secure, HttpOnly, SameSite cookie.
- Sessions expire after 12 hours and can be revoked on logout.

Staging gate:
1. Apply `commerce/migrations/0001_admin_email_auth.sql` to staging D1.
2. Deploy the newest `commerce-v1` Worker to staging.
3. Open the staging Worker `/admin` route.
4. Request a code and confirm it arrives only at the owner email.
5. Sign in and verify order list/detail.
6. Move one staging order through review → quote → payment request → paid → preparing → shipped/ready → complete.
7. Verify unauthorized API requests remain denied.

No Cloudflare Zero Trust subscription or payment-card onboarding is required for this V1 admin flow.

## Gate D — legal/business identity

Before public checkout launch:

- Confirm the legal proprietor/registered business identity to display with the trading name.
- Verify `orders@theblacksheepshop.co.uk` receives customer messages.
- Re-read:
  - `privacy.html`
  - `delivery-returns.html`
  - `terms.html`
  - `docs/LEGAL-COMMERCE-BASIS-2026-09-24.md`

## Gate E — production Worker and D1

Only after Gates A–D pass:

1. Review production migrations:
   `npm run db:migrations:list:production`
2. Apply production D1 migrations:
   `npm run db:migrate:production`
3. Configure the production `TURNSTILE_SECRET_KEY` as a Worker secret.
4. Configure production Resend/owner-email variables and secrets.
5. Apply the admin email-auth migration to production D1.
6. Attach `api.theblacksheepshop.co.uk` as the public Commerce Worker Custom Domain.
7. Serve the protected owner admin at `https://api.theblacksheepshop.co.uk/admin` unless a separate admin hostname is deliberately added later.
8. Change storefront checkout API base from the staging `workers.dev` URL to:
   `https://api.theblacksheepshop.co.uk`
9. Disable production `workers.dev`/preview exposure if no longer required.
10. Deploy production Worker.
11. Verify `/health`, order creation and `/admin` authentication on the production custom domain.

Cloudflare recommends Custom Domains for a Worker acting as the origin for a business application rather than relying on `workers.dev`.

## Gate F — merge and public QA

1. Fetch newest `main`.
2. Reconcile any newer storefront work into `commerce-v1`.
3. Run:
   - Commerce CI
   - Search readiness
4. Merge without force-push.
5. Confirm GitHub Pages deployment.
6. Test on desktop and mobile:
   - Add to basket
   - Mini basket
   - Basket page
   - checkout delivery
   - checkout collection
   - Turnstile
   - network/API error preserves basket
   - successful order clears basket only after HTTP success
   - customer receives acknowledgment
   - owner receives notification
   - admin receives/updates order
   - payment request uses order-specific final total/link
7. Perform one low-value real order lifecycle.
8. Update `docs/SESSION-HANDOFF.md` with final production SHA and Cloudflare resource names.

## Do not do

- Do not put any Turnstile secret, Resend API key, session secret/token or banking credential in GitHub.
- Do not expose the reusable NatWest payment link in public storefront code.
- Do not mark an order PAID from customer/browser input.
- Do not use email as the source of truth for orders.
- Do not point the public checkout to production D1 before migrations, notifications and Access are verified.
