# Black Sheep Commerce — Email Deliverability Runbook

Updated: 25 September 2026

## Objective

Keep transactional order email branded, authenticated, observable and easy to recover when delivery fails.

The application sends transactional messages from:

`The Black Sheep Shop <orders@theblacksheepshop.co.uk>`

Replies should continue to reach the owner through the configured inbound routing.

## Application controls now implemented

- Shared responsive HTML email design plus a plain-text alternative.
- Consistent From identity and shop Reply-To.
- Direct HTTPS links only; no link shorteners.
- Customer-facing order/reference context on transactional messages.
- Provider message IDs stored for tracked customer email.
- Resend webhook endpoint:
  `POST https://api.theblacksheepshop.co.uk/webhooks/resend`
- Raw webhook body verified before JSON parsing.
- Verification requires:
  - `svix-id`
  - `svix-timestamp`
  - `svix-signature`
  - Worker secret `RESEND_WEBHOOK_SECRET`
- Five-minute timestamp tolerance to reduce replay risk.
- Webhook event IDs deduplicated in D1.
- Raw webhook payloads are not retained.
- Tracked delivery states:
  - SENT
  - DELIVERED
  - DELAYED
  - BOUNCED
  - COMPLAINED
  - FAILED
- Admin Reports surfaces email delivery exceptions.
- A webhook race is reconciled if the provider event arrives before the local message audit row is written.

## Resend webhook setup

Do not put the signing secret in GitHub source, documentation or chat.

In Resend, create a webhook with endpoint:

`https://api.theblacksheepshop.co.uk/webhooks/resend`

Subscribe at minimum to:

- `email.sent`
- `email.delivered`
- `email.delivery_delayed`
- `email.bounced`
- `email.complained`
- `email.failed`
- `email.suppressed` if available in the current Resend webhook selector

Store the webhook signing secret as the Cloudflare Worker secret:

`RESEND_WEBHOOK_SECRET`

Use a separate signing secret for staging if webhook telemetry is also tested there.

After configuration, `GET /health` should report:

`notifications.webhookConfigured: true`

## Domain authentication release gate

Before calling deliverability setup complete, verify in the current Resend domain screen and DNS that:

- DKIM is verified.
- SPF/alignment records requested by Resend are verified.
- The sending domain is shown as verified by Resend.
- DMARC exists for the organizational domain.
- DMARC begins conservatively if reporting has not been observed yet; do not jump to an aggressive reject policy without checking legitimate senders.
- Cloudflare Email Routing records required for inbound replies remain intact.
- There are no duplicate/conflicting SPF records.

Record only the result/status in the project checklist. Never copy DNS secret material into the repository.

## Production verification

Use a controlled order/customer address that you own.

1. Send an order acknowledgement.
2. Confirm it appears in the customer inbox with the intended From name/address.
3. Confirm Reply goes to the shop inbox.
4. Send a reviewed payment request.
5. Confirm the email links to the secure customer review page when a revision exists.
6. Confirm the matching message progresses from SENT to DELIVERED in Admin.
7. Use a controlled failing address only if safe/appropriate to verify the BOUNCED or FAILED path.
8. Verify the Reports email-exception section surfaces a failure and does not expose unnecessary PII.
9. Verify webhook replays do not duplicate audit events.

## Operational response

### DELAYED

Do not immediately resend. Allow the provider retry process unless the customer has an urgent fulfilment deadline. The admin should flag the order for attention.

### BOUNCED

Use another customer contact method if available. Confirm the address with the customer before sending again. Do not repeatedly resend to a known bouncing address.

### COMPLAINED

Do not keep retrying that address. Treat it as a deliverability/reputation issue and review whether the message was expected by the customer.

### FAILED / SUPPRESSED

Check the provider log and the customer address. A suppressed address may have prior bounce/complaint history. Resolve the underlying cause before retrying.

## Release status

Code support is complete only when Commerce CI passes. Live webhook telemetry remains account/configuration-gated until:

- the Resend webhook is created,
- `RESEND_WEBHOOK_SECRET` is configured in the target Worker environment,
- migrations through `0007_email_delivery_webhooks.sql` are applied,
- a signed live webhook is observed,
- a tracked email reaches DELIVERED in Admin.
