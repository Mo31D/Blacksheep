# Black Sheep Admin V2 — Execution Checklist

Updated: 25 September 2026
Repository: `Mo31D/Blacksheep`
Branch: `main`

This file is the authoritative progress tracker for the professional Admin V2 programme.

## Current anchor

- Commerce V1 is live.
- Public checkout is enabled against `https://api.theblacksheepshop.co.uk`.
- Existing professional dashboard/reports UI code is on `main`.
- Admin V2 work must preserve existing production ordering while new capabilities are staged.
- Detailed priorities: `docs/ADMIN-V2-IMPLEMENTATION-PLAN.md`.
- Technical contract: `docs/ADMIN-V2-SPEC.md`.

## P0 — Controls and specification

- [x] Define operating model: original request → revision → payment → fulfilment.
- [x] Prioritise implementation phases.
- [x] Define immutable-original-order rule.
- [x] Define revision/payment/refund/attention dimensions.
- [x] Define mobile Admin V2 target UX.
- [x] Define email and deliverability target.
- [x] Define staging-before-production release gate.
- [x] Commit implementation plan.
- [x] Commit execution specification.
- [x] Create this resumable checklist.

Status: COMPLETE.

## P1A — Revision data foundation

- [ ] Add migration for `order_revisions`.
- [ ] Add migration for `order_revision_items`.
- [ ] Add migration for `order_adjustments`.
- [ ] Add indexes and integrity checks.
- [ ] Add revision domain types/validation.
- [ ] Add D1 repository methods.
- [ ] Add automated tests.
- [ ] Confirm local D1 migration through Commerce CI.

Status: IN PROGRESS.

## P1B — Revision admin API

- [ ] List revisions.
- [ ] Create draft revision from original order.
- [ ] Read revision detail.
- [ ] Update draft reviewed quantities/dispositions.
- [ ] Update customer message separately from internal note.
- [ ] Send revision.
- [ ] Supersede older sent revision.
- [ ] Accept/decline revision.
- [ ] Add version/concurrency protection.
- [ ] Add route/auth/same-origin tests.

Status: NOT STARTED.

## P2 — Professional order workspace

- [ ] Integrate revisions into order detail.
- [ ] Add item availability review controls.
- [ ] Add reduce/unavailable/substitute/add-item flows.
- [ ] Add human-readable change summary.
- [ ] Add revised totals card.
- [ ] Add context-sensitive sticky primary action.
- [ ] Move dangerous actions under More actions.
- [ ] Add mobile action sheets/confirmations.
- [ ] Verify iPhone Safari.
- [ ] Verify desktop.

Status: NOT STARTED.

## P3 — Communication Centre / Email V2

- [ ] Shared responsive transactional email renderer.
- [ ] Plain-text renderer.
- [ ] Availability/revision email.
- [ ] Revised payment request email.
- [ ] Payment reminder.
- [ ] Payment confirmed.
- [ ] Preparing.
- [ ] Ready for collection.
- [ ] Shipped.
- [ ] Cancellation.
- [ ] Refund/partial refund.
- [ ] Custom customer message.
- [ ] Separate internal notes.
- [ ] Message audit history.
- [ ] Reply-To verified to shop inbox.

Status: NOT STARTED.

## P4 — Refund/post-payment engine

- [ ] Add `refunds` ledger migration.
- [ ] Partial refund.
- [ ] Full refund.
- [ ] Refund and cancel.
- [ ] Refund after completion.
- [ ] Cumulative refund guard.
- [ ] Net paid/refunded calculations.
- [ ] Admin refund UX.
- [ ] Refund emails.
- [ ] Automated tests.

Status: NOT STARTED.

## P5 — Advanced reports

- [ ] Net revenue after refunds.
- [ ] Lost sales/unavailable products.
- [ ] Requested vs confirmed quantities.
- [ ] Cancellation reasons.
- [ ] Refund reasons/values.
- [ ] Average review time.
- [ ] Quote-to-payment time.
- [ ] Payment-to-ready time.
- [ ] Uncollected ageing.
- [ ] Email failure queue.
- [ ] Revised conversion funnel.
- [ ] CSV exports.

Status: NOT STARTED.

## P6 — Secure customer review page

- [ ] Hashed review tokens.
- [ ] Expiry.
- [ ] Current-revision-only enforcement.
- [ ] Original vs revised comparison.
- [ ] Customer message.
- [ ] Exact total.
- [ ] Accept & pay.
- [ ] Ask a question.
- [ ] Decline changes.
- [ ] Mobile QA.

Status: NOT STARTED.

## P7 — Deliverability telemetry

- [ ] Verify SPF.
- [ ] Verify DKIM.
- [ ] Add/verify DMARC.
- [ ] Resend webhook endpoint.
- [ ] Verify webhook signatures.
- [ ] Store provider message ids.
- [ ] Delivered state.
- [ ] Delayed state.
- [ ] Bounced state.
- [ ] Complained state.
- [ ] Failed state.
- [ ] Admin warning/attention queue.

Status: NOT STARTED.

## P8 — Release QA

- [ ] All-items-available scenario.
- [ ] Unavailable-item scenario.
- [ ] Reduced-quantity scenario.
- [ ] Substitute scenario.
- [ ] Add-item scenario.
- [ ] Collection→delivery revision.
- [ ] Delivery→collection revision.
- [ ] Superseded quote.
- [ ] Partial refund.
- [ ] Full refund.
- [ ] Refund after completion.
- [ ] Failed email.
- [ ] Duplicate submission.
- [ ] Concurrent admin edit.
- [ ] Mobile Safari.
- [ ] Desktop.
- [ ] Staging migration/deploy pass.
- [ ] Production migration/deploy pass.
- [ ] Final handoff updated.

Status: NOT STARTED.

## Exact next implementation step

Complete P1A: add the backwards-compatible revision schema, domain/data layer and tests. Do not expose unfinished revision controls to production UI until P1B/P2 are validated in staging.
