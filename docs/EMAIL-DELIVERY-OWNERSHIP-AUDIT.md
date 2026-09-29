# Email delivery ownership audit

Reviewed 29 September 2026 against the active Worker routes and notification callers.

## Responsibility and flow

- `routes/orders.ts` accepts an idempotent order request, commits the order to D1, then invokes `notifications/service.ts` for owner and customer mail. An already recorded order-key replay returns without notifying again.
- Authenticated actions in `routes/admin.ts` commit order transitions, messages or refunds before invoking `payment.ts`, `status.ts`, `refund.ts` or `customer-message.ts`. `routes/customer-review.ts` stores a token-authorized question before `customer-question.ts` alerts the owner. These services own message intent and D1 audit, not provider HTTP transport.
- `email-provider.ts` selects the optional `EMAIL` binding first or Resend. `resend-email.ts` owns the Resend request, sanitized error code and `Idempotency-Key` header. `send-attempt.ts` owns the two-attempt boundary: only transport uncertainty, 408, 429, 5xx and Resend's concurrent-key 409 are retried. Permanent provider rejections fail after one attempt. A logical send reuses one key across its attempts. Customer messages use their D1 message UUID; customer questions use their persisted question UUID. [Resend retains keys for 24 hours](https://resend.com/changelog/idempotency-keys), so this is provider-side protection for that window, not a durable exactly-once guarantee across every future Admin action.
- Successful provider acceptance is separated from D1 audit persistence. Audit failure must not trigger another email. A failed audit can leave a delivered message without a matching D1 row; recovery would require provider reconciliation, not an automatic resend.
- `routes/resend-webhook.ts` verifies the signed raw payload before passing it to `data/email-delivery.ts`. D1 `email_webhook_events` claims the provider event ID atomically with the message update and order event. Replayed webhook IDs cannot apply side effects twice. A late `sent`/`delayed` event no longer downgrades a terminal delivery state; a late `sent` event no longer downgrades `DELAYED`. Provider events remain in the event log even when their status does not supersede the current one.

## Deliberate limits

- Admin can intentionally send a new customer message or reminder with the same text. Each new action has a new message ID; server-side retry of one action shares its ID. Separate Admin submissions are not deduplicated by body text.
- The generic `EMAIL` binding has no documented provider idempotency contract. Its existing two-attempt behaviour remains; the Resend header protects only the Resend path.
- No production or staging customer message was sent as a test. Local fake-provider tests cover timeout/429/401, stable keys, audit failure after acceptance, signed webhook claim behaviour and out-of-order status transitions using in-memory SQLite. Deployment and real provider delivery remain release acceptance work.
