# Black Sheep Admin V2 — Execution Specification

Updated: 25 September 2026
Repository: `Mo31D/Blacksheep`
Branch: `main`

## 1. Domain model

### Original order
`orders` and `order_items` remain the immutable record of what the customer submitted.

### Revision
A revision is the shop's reviewed proposal derived from an original order.

Required fields:
- revision id
- order id
- monotonically increasing revision number
- state
- currency
- item subtotal
- delivery amount
- adjustment amount
- final total
- customer message
- internal note
- created by
- created/sent/accepted/superseded timestamps

Revision states:
- DRAFT
- SENT
- SUPERSEDED
- ACCEPTED
- DECLINED
- EXPIRED

Only one revision may be the current active SENT revision for an order. Sending a later revision supersedes the prior SENT revision.

### Revision item
Each reviewed line records both demand and supply outcome.

Required fields:
- source original item id when applicable
- catalogue product id
- immutable product name/slug/SKU snapshot
- unit price
- requested quantity
- confirmed quantity
- availability disposition
- customer-facing reason
- internal note
- line total

Availability dispositions:
- CONFIRMED
- REDUCED
- UNAVAILABLE
- SUBSTITUTE
- ADDED

Rules:
- confirmed quantity cannot be negative.
- UNAVAILABLE requires confirmed quantity = 0.
- CONFIRMED normally matches requested quantity.
- REDUCED requires confirmed quantity < requested quantity.
- ADDED may have requested quantity = 0.
- line total = unit price × confirmed quantity.

### Adjustment
Adjustments are explicit monetary lines rather than invisible total edits.

Kinds:
- DISCOUNT
- SURCHARGE
- MANUAL_CORRECTION

Every manual adjustment requires a human-readable label and internal reason.

### Refund
Refunds are a ledger, not just an order status.

Required fields:
- order id
- amount minor
- reason code
- refund method
- external reference when available
- internal note
- actor
- created timestamp

Rules:
- cumulative refund <= captured/recorded paid amount.
- partial refunds do not erase payment history.
- manual V1 refunds are “recorded after external refund”; they never claim the Worker moved money.

## 2. Lifecycle dimensions

The UI must not overload one status field for all concerns.

Order lifecycle:
- Submitted
- Under review
- Quoted
- Awaiting payment
- Paid
- Preparing
- Shipped / Ready for collection
- Completed
- Cancelled

Quote dimension:
- No revision
- Draft
- Sent
- Superseded
- Accepted
- Declined
- Expired

Payment dimension:
- Unpaid
- Payment requested
- Paid
- Partially refunded
- Refunded

Attention dimension is derived:
- Needs review
- Waiting for customer
- Awaiting payment
- Payment overdue
- Ready to contact
- Email failed
- Refund action required

## 3. Admin API target

Existing authenticated endpoints remain.

Planned additions:

- `GET /admin/api/orders/:ref/revisions`
- `POST /admin/api/orders/:ref/revisions`
  - create a DRAFT from the original order or current accepted revision.
- `GET /admin/api/orders/:ref/revisions/:revisionId`
- `PATCH /admin/api/orders/:ref/revisions/:revisionId`
  - update DRAFT customer message, internal note, fulfilment and reviewed lines.
- `POST /admin/api/orders/:ref/revisions/:revisionId/send`
- `POST /admin/api/orders/:ref/revisions/:revisionId/accept`
- `POST /admin/api/orders/:ref/revisions/:revisionId/decline`
- `GET /admin/api/orders/:ref/messages`
- `POST /admin/api/orders/:ref/messages`
- `POST /admin/api/orders/:ref/refunds`
- `GET /admin/api/orders/:ref/refunds`

All POST/PATCH requests require authenticated owner session, same-origin protection and server-side validation.

## 4. Revision pricing rules

The Worker owns pricing.

For catalogue-backed products:
- catalogue id is resolved server-side.
- current authoritative price is used unless an explicit permitted manual override/adjustment is created.
- the admin browser cannot submit a trusted final total.

Calculated:
- revision item subtotal = sum confirmed line totals.
- final total = item subtotal + delivery + adjustments.
- collection delivery amount must be zero.

## 5. Quote supersession

When a revision is sent:
- any previous SENT revision becomes SUPERSEDED.
- previous payment request for a superseded quote is marked superseded in internal state.
- admin must issue a new payment request for the current revision.
- customer-facing pages reject superseded revision tokens.

## 6. Post-payment change rules

Increasing a paid order:
- create a new revision/adjustment.
- collect the additional amount before fulfilment continues when required.

Reducing a paid order:
- calculate amount due back.
- require explicit refund decision.
- record refund ledger entry only after the external refund is actually completed in manual-payment V1.

Cancelling a paid order:
- cannot be represented as a simple cancel.
- owner must confirm refund handling.
- final state and refund ledger are both preserved.

## 7. Communication model

Every outbound customer message should have:
- order id/reference
- optional revision id
- template key
- subject
- rendered plain text
- rendered HTML
- delivery lifecycle state
- provider message id if available
- created/sent/delivery timestamps

Customer-visible text and internal notes are distinct fields.

## 8. Email design standard

Email must be:
- responsive
- readable without images
- contain a plain-text alternative
- have one clear primary CTA
- use full direct HTTPS links
- contain order reference
- contain exact revised items and total when asking for payment
- contain contact details and relevant legal links
- use `The Black Sheep Shop <orders@theblacksheepshop.co.uk>`
- set Reply-To to the inbound-routed shop address

## 9. Mobile admin UX

Primary mobile navigation:
- Dashboard
- Orders
- Reports
- Products
- More

Order screen:
- sticky compact order header
- status chips
- progress rail
- customer card
- item review cards
- totals
- messages
- payment/refund
- fulfilment
- timeline
- sticky context-sensitive primary action

Dangerous actions:
- hidden under More actions
- confirmation sheet
- reason required for financially material changes

## 10. Reporting definitions

Revenue:
- net paid revenue should subtract recorded refunds.

Lost sales:
- unavailable/reduced requested value not included in accepted revision.

Availability:
- requested quantity vs confirmed quantity by product.

Operational durations:
- submitted → review started
- review started → quote sent
- payment requested → paid
- paid → ready/shipped
- ready/shipped → completed

Ageing queues:
- submitted not reviewed
- payment requested not paid
- ready for collection not completed
- outbound email failed/bounced

## 11. Concurrency

Each mutable revision carries a version integer.
PATCH/action requests include expected version.
If current version differs, return 409 and force the UI to reload before retrying.

## 12. Audit requirements

Audit event metadata must record where relevant:
- revision number/id
- before and after quantities
- before and after totals
- reason code
- actor
- message template
- refund amount/reference

Audit events are append-only.

## 13. Security

- Admin session remains secure HttpOnly, Secure, SameSite=Strict.
- Same-origin protection stays mandatory for admin writes.
- Customer review tokens use high entropy and only hashes are stored.
- Customer review endpoints expose only the minimum order data.
- Webhook endpoints verify provider signatures before accepting state changes.
- PII must not be written to logs unnecessarily.

## 14. Deployment contract

No Admin V2 phase is considered live merely because code is on `main`.

Required sequence:
1. automated checks
2. staging migration
3. staging Worker deploy
4. staging functional verification
5. explicit production approval
6. production migration
7. production Worker deploy
8. production smoke test
9. checklist/handoff update
