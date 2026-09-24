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
- A temporary production-hostname staging verifier exists on `main` at:
  `/commerce-stage-check-260924.html`

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

Cloudflare Email Service is the selected adapter.

1. Cloudflare dashboard → **Compute → Email Service → Email Sending**.
2. Onboard `theblacksheepshop.co.uk`.
3. Allow Cloudflare to create/verify the required SPF, DKIM, DMARC and bounce-domain DNS records.
4. Activate a working sender:
   `orders@theblacksheepshop.co.uk`
5. Configure a Worker `send_email` binding named:
   `EMAIL`
6. Set non-secret Worker variables:
   - `ORDER_EMAIL_FROM=orders@theblacksheepshop.co.uk`
   - `ORDER_OWNER_EMAIL=<owner receiving address>`
7. If customers must be able to reply to `orders@`, configure Email Routing/inbound forwarding as well.
8. From staging, verify one owner notification and one customer acknowledgment.
9. Verify failure/success events are written to `order_events`.

Cloudflare docs reviewed:
- https://developers.cloudflare.com/email-service/get-started/send-emails/
- https://developers.cloudflare.com/email-service/api/send-emails/workers-api/

## Gate C — private owner admin

The admin code fails closed unless the exact admin hostname and a valid Cloudflare Access JWT are present.

Recommended hostname:
`admin.theblacksheepshop.co.uk`

1. In Cloudflare Zero Trust create a **Self-hosted Access application** for the exact admin hostname.
2. Add an allow policy for the owner/admin identity only.
3. Record:
   - Access team domain, for example `https://<team>.cloudflareaccess.com`
   - application AUD
4. Configure Worker variables:
   - `ADMIN_HOSTNAME=admin.theblacksheepshop.co.uk`
   - `ADMIN_TEAM_DOMAIN=https://<team>.cloudflareaccess.com`
   - `ADMIN_ACCESS_AUD=<Access application AUD>`
   - `ADMIN_ALLOWED_EMAILS=<comma-separated owner/admin emails>`
5. Attach the admin custom domain only when the Access application/policy is ready.
6. Verify:
   - unauthenticated access is denied
   - authorized login succeeds
   - order list/detail works
   - one staging order can progress through review → quote → payment request → paid → preparing → shipped/ready → complete

Cloudflare docs reviewed:
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/

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
4. Configure production Email Service binding/variables.
5. Configure production admin Access variables.
6. Attach:
   - `api.theblacksheepshop.co.uk` as the public API Custom Domain
   - `admin.theblacksheepshop.co.uk` as the Access-protected admin Custom Domain
7. Change storefront checkout API base from the staging `workers.dev` URL to:
   `https://api.theblacksheepshop.co.uk`
8. Disable production `workers.dev`/preview exposure if no longer required.
9. Deploy production Worker.
10. Verify `/health` on the API custom domain.

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

- Do not put any Turnstile secret, Access credential, API token or banking credential in GitHub.
- Do not expose the reusable NatWest payment link in public storefront code.
- Do not mark an order PAID from customer/browser input.
- Do not use email as the source of truth for orders.
- Do not point the public checkout to production D1 before migrations, notifications and Access are verified.
