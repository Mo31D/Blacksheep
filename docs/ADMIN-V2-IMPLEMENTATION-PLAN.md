# Black Sheep Admin V2 — Prioritised Implementation Plan

Updated: 25 September 2026
Repository: `Mo31D/Blacksheep`
Authoritative branch: `main`

## Objective

Turn the owner admin from an order list into a mobile-first shop operations system that safely handles partial availability, order revisions, customer communication, payment, fulfilment, cancellations, refunds and actionable reporting.

The operating model is:

**Original customer request → reviewed revision → customer-facing quote/message → payment → fulfilment → completion/refund**

The original request is immutable. All owner changes are represented as new revisions or auditable actions.

## Non-negotiable engineering rules

- Never mutate the original `order_items` snapshots to hide what the customer requested.
- Every owner change that affects money, products, fulfilment or customer communication must be auditable.
- Browser-submitted totals are never trusted; totals are calculated by the Worker.
- A newer quote supersedes older payment instructions.
- Internal notes must never be included in customer email or customer-facing pages.
- Paid orders cannot be silently edited; any post-payment reduction must have a refund/credit decision.
- Full and partial refunds are recorded separately from order lifecycle status.
- The production Worker is deployed only after staging migrations, automated tests and mobile/desktop smoke tests pass.
- No secrets, API keys or customer-sensitive exports are committed to Git.

## Priority order

### P0 — Safety and implementation controls
Purpose: make the project resumable and prevent production drift.

Deliverables:
- Dedicated Admin V2 checklist.
- Detailed implementation specification.
- Migration/version discipline.
- Automated tests added with each behavioural change.
- Explicit staging verification gates before production.

Exit criteria:
- Plan/spec/checklist committed to `main`.
- Current implementation anchor recorded.
- Every later phase can be resumed from the checklist without relying on chat history.

### P1 — Order Revision Engine
Purpose: solve the highest-value operational problem: some requested items are unavailable or quantities need to change.

Deliverables:
- Immutable original order snapshot retained.
- `order_revisions` and `order_revision_items`.
- Revision states: DRAFT, SENT, SUPERSEDED, ACCEPTED, DECLINED, EXPIRED.
- Per-line requested vs confirmed quantity.
- Availability disposition: CONFIRMED, REDUCED, UNAVAILABLE, SUBSTITUTE, ADDED.
- Customer-facing reason and separate internal note.
- Server-calculated revision totals.
- Adjustment support designed for discount/surcharge/manual correction.
- Audit events for revision creation and later actions.

Exit criteria:
- Migration applies locally.
- Domain/data tests pass.
- A draft revision can be created from an existing order without modifying `order_items`.

### P2 — Professional Order Workspace
Purpose: make order handling fast and safe on phones.

Deliverables:
- Order header with human-readable lifecycle/payment/fulfilment chips.
- Progress rail: Request → Review → Quote → Payment → Preparing → Ready/Shipped → Complete.
- Availability review editor.
- Reduce quantity / unavailable / substitute / add item workflows.
- Internal note and customer message separated.
- Sticky primary action based on current state.
- Dangerous actions under a separate More actions area with confirmation.
- Optimistic-concurrency protection using revision/version checks.

Exit criteria:
- Owner can process a partially unavailable order on mobile without editing raw values.
- Invalid actions are prevented in UI and Worker.

### P3 — Communication Centre and Email Design System
Purpose: make every customer contact consistent, professional and editable.

Deliverables:
- Message templates for availability update, revised quote, payment request, reminder, payment received, preparing, ready, shipped, cancellation, refund and custom message.
- Shared responsive HTML email renderer plus plain-text fallback.
- Customer message field editable before send.
- Internal notes never leak to messages.
- Order/revision summary included when relevant.
- Stable From identity and Reply-To to `orders@theblacksheepshop.co.uk`.

Exit criteria:
- Core transaction emails render consistently on mobile Gmail and desktop.
- Message history is auditable.

### P4 — Refund and Post-payment Adjustment Engine
Purpose: safely handle changes after money has been received.

Deliverables:
- `refunds` ledger with amount, reason, method, external reference, actor and timestamp.
- Partial-refund support.
- Full-refund support.
- Refund-and-cancel for eligible orders.
- Refund-after-completion without destroying completed history.
- Guard against refunding more than the net paid amount.
- Clear distinction between recording a manually completed refund and actually moving money.

Exit criteria:
- £40 paid / £12 refunded shows paid £40, refunded £12, net £28.
- Audit trail identifies who recorded each refund and why.

### P5 — Business Reports and Exceptions
Purpose: expose information that changes purchasing and operating decisions.

Deliverables:
- Existing revenue/status/fulfilment/top-product reports retained.
- Lost-sales / unavailable-item report.
- Requested vs confirmed quantity report.
- Cancellation/refund reasons.
- Average review time.
- Quote-to-payment time.
- Payment-to-ready time.
- Uncollected-order ageing.
- Failed/bounced customer email queue.
- Conversion funnel based on lifecycle events.
- CSV export for operational reports.

Exit criteria:
- Reports answer what is selling, what is being lost, what is delayed and where orders drop out.

### P6 — Secure Customer Order Review
Purpose: reduce confusing email threads when the shop changes an order.

Deliverables:
- Random high-entropy customer review token stored only as a hash.
- Expiry and single-current-revision behaviour.
- Customer page shows original request, changes, current confirmed items, shop message, total and fulfilment.
- Accept & pay / question / decline-change paths.
- Superseded revisions cannot be accepted.

Exit criteria:
- Customer can review the exact revision they are being asked to pay for without an account.

### P7 — Deliverability and Email Lifecycle
Purpose: stop treating “send API returned success” as proof that an email reached the customer.

Deliverables:
- SPF/DKIM/DMARC verification checklist.
- Resend webhook endpoint with signature verification.
- SENT, DELIVERED, DELAYED, BOUNCED, COMPLAINED, FAILED states.
- Admin warning for bounced/failed customer emails.
- No link shorteners or unnecessary tracking.
- Transactional-only email patterns.

Exit criteria:
- Admin shows delivery outcome for important emails.

### P8 — Full QA and Production Release
Purpose: verify realistic failure cases before considering Admin V2 complete.

Required scenarios:
- All items available.
- One item unavailable.
- Quantity partially available.
- Substitute offered.
- Customer asks for an added item.
- Collection → delivery revision.
- Delivery → collection revision.
- Quote superseded before payment.
- Partial refund.
- Full refund before fulfilment.
- Refund after completion.
- Payment link replacement.
- Failed email.
- Duplicate browser submission.
- Two admin sessions editing the same order.
- Mobile Safari and desktop browser workflows.

Release gate:
- Local checks pass.
- Commerce CI passes.
- Staging migration passes.
- Staging scenario QA passes.
- Production migration and Worker deploy are explicitly confirmed.
- Post-deploy smoke test passes.

## Delivery sequence

1. P0 documentation/control files.
2. P1 revision schema/domain/data foundation.
3. P1 authenticated APIs and tests.
4. P2 order workspace UI.
5. P3 message/email system.
6. P4 refund ledger and post-payment adjustments.
7. P5 advanced reports.
8. P6 customer review page.
9. P7 email webhooks/deliverability telemetry.
10. P8 staging and production QA.

## Current relationship to Commerce V1

Commerce V1 remains live and functional while Admin V2 is implemented. New migrations and APIs must be backward-compatible until each Admin V2 phase is explicitly enabled. The public checkout remains production-facing; this programme changes owner-side operations and customer follow-up, not the authoritative checkout-price model.
