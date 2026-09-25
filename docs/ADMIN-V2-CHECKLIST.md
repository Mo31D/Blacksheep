# Black Sheep Admin V2 — Live Execution Checklist

Updated: 25 September 2026  
Repository: `Mo31D/Blacksheep`  
Branch: `main`

This file is the **authoritative, resumable execution tracker for Admin V2**.

## Operating rule

- Always start from the newest remote `main`.
- Current code is the source of truth; old handoff prose is historical unless reconfirmed.
- **Update this checklist in the same milestone that changes implementation state.**
- Do not begin a new milestone until the previous milestone has:
  1. code committed,
  2. relevant automated checks green,
  3. this checklist updated,
  4. the exact next action recorded.
- Do not claim staging/production completion from source inspection alone.
- Preserve Commerce V1 ordering while Admin V2 is hardened.
- Never replace current `main` with an older Work/Sites copy.

## Status legend

- [x] Verified in current repository code/CI
- [~] Implemented or materially present, but runtime/release verification remains
- [ ] Not yet complete
- [!] Blocker / must be resolved before dependent release work

---

# CURRENT RELEASE BASELINE

Source anchor at reconstruction start:

- `4fc459fa97939f4ba45cd01db5a4be8ac807d038`
- Commit: `commerce: add explicit reviewed-order adjustments`
- Search Readiness: PASS at that source anchor.
- Commerce CI: PASS at that source anchor.
- GitHub Pages deployment: PASS at that source anchor.
- Static storefront/search architecture is stable and must not be redesigned during Admin V2 completion.

Hardened source baseline after Phase 8 work:

- `fafdcac6a4e0ab82e81954ea6f5fa1d8841df1c1`
- Commerce CI: PASS (run `36134835149`).
- Search Readiness: PASS (run `36134835077`).
- GitHub Pages: PASS (run `36134834631`).
- New concurrency migration: `0008_concurrency_guards.sql`.
- Revision, refund, customer-review and Resend-webhook critical mutations now use winner-owned mutation/idempotency guards.

Environment facts that must still be recorded:

- [ ] Staging Worker deployed SHA/version.
- [ ] Production Worker deployed SHA/version.
- [ ] Staging D1 applied migration level.
- [ ] Production D1 applied migration level.
- [ ] Current production Resend webhook configuration state.
- [ ] Current production Turnstile configuration re-confirmed after the next Worker deployment.

---

# PHASE 0 — CONTROL-PLANE RECONCILIATION

Goal: make project state resumable before adding more behaviour.

- [x] Deep repository audit completed against current `main`.
- [x] Confirmed old `ADMIN-V2-CHECKLIST.md` materially understated implementation.
- [x] Confirmed P2/P3/P4/P5/P6/P7 code already exists in current source.
- [x] Replace stale Admin V2 checklist with this reality-based tracker.
- [ ] Replace the top of `docs/SESSION-HANDOFF.md` with one truthful current Admin V2 handoff.
- [ ] Mark/archive obsolete Commerce pre-merge handoff sections so they cannot be mistaken for current state.
- [ ] Update README current-commerce wording after runtime state is established.

Exit gate:
- one live checklist,
- one current handoff,
- no future session instructed to restart already-built V2 features.

Status: IN PROGRESS.

---

# PHASE 1 — REVISION FOUNDATION

## P1A — Data model

- [x] `order_revisions` migration.
- [x] `order_revision_items` migration.
- [x] `order_adjustments` support.
- [x] Revision version field / optimistic concurrency model.
- [x] Immutable original-order snapshot preserved.
- [x] Revision fulfilment migration.
- [x] Local migrations included in Commerce CI.

## P1B — Revision API

- [x] List revisions.
- [x] Create draft from original order.
- [x] Read revision detail.
- [x] Update requested-line quantities/dispositions.
- [x] Customer message separated from internal note.
- [x] Catalogue-backed add-item endpoint.
- [x] Catalogue-backed substitute endpoint.
- [x] Remove owner-added revision line.
- [x] Restore original requested line.
- [x] Send / accept / decline / supersede transition support.
- [x] Expected-version input and conflict handling.
- [x] Same-origin protection extended to mutating admin routes.
- [x] Route-level revision tests exist.

## P1C — Explicit adjustments

- [x] Discount adjustment.
- [x] Surcharge adjustment.
- [x] Manual correction adjustment.
- [x] Label/reason validation.
- [x] Final-total recalculation.
- [x] Audit events for adjustment add/remove.
- [x] Concurrent same-version revision/transition losers are rejected via D1 `meta.changes` + mutation ownership tokens.
- [x] Adjustment race safety has explicit loser-path coverage.

Status: CODE COMPLETE; CORE CONCURRENCY HARDENING VERIFIED IN CI.

---

# PHASE 2 — PROFESSIONAL ORDER WORKSPACE

Current repository evidence shows this phase has already moved well beyond "not started".

## Implemented in code

- [x] Revisions are exposed through admin APIs.
- [x] Admin catalogue lookup exists.
- [x] Add-item flow exists.
- [x] Substitute flow exists.
- [x] Remove added item exists.
- [x] Restore original item exists.
- [x] Reduced/unavailable review semantics exist.
- [x] Revised totals are calculated server-side.
- [x] Explicit reviewed-order adjustments exist.
- [x] Refund summary/actions are wired into admin routes.
- [x] Customer review-token creation is wired into admin routes.
- [x] Customer/internal messaging infrastructure exists.

## Still to verify/finish

- [ ] Audit current `commerce/src/admin/ui` against V2 UX specification item by item.
- [ ] Confirm human-readable change summary is complete for every revision mutation.
- [ ] Confirm sticky primary action changes correctly by order/revision state.
- [ ] Confirm dangerous actions are separated from primary actions.
- [ ] Confirm mobile confirmations/action sheets are complete.
- [ ] Verify unavailable/reduced/substitute/add/remove/restore on iPhone Safari.
- [ ] Verify the same flows on desktop.
- [ ] Verify fulfilment collection↔delivery revision UX end to end.

Status: MATERIAL IMPLEMENTATION PRESENT; UX/E2E VERIFICATION REMAINS.

---

# PHASE 3 — COMMUNICATION CENTRE / EMAIL V2

## Implemented/materially present

- [x] Existing Resend transactional layer.
- [x] Structured order-message persistence.
- [x] Customer-facing message support.
- [x] Internal notes remain separate from customer messages.
- [x] Payment-request notification path.
- [x] Payment-confirmed notification path.
- [x] Lifecycle notification path.
- [x] Refund notification path.
- [x] Owner custom-customer-message path.
- [x] Customer question/message history support.

## Remaining

- [ ] Build a definitive lifecycle-email matrix from current code.
- [ ] Verify availability/revision email.
- [ ] Verify revised payment request email.
- [ ] Verify payment reminder behaviour if supported; implement only if genuinely absent.
- [ ] Verify preparing email.
- [ ] Verify ready-for-collection email.
- [ ] Verify shipped email.
- [ ] Verify cancellation email.
- [ ] Verify partial/full refund emails.
- [ ] Confirm all HTML emails have a usable plain-text equivalent.
- [ ] Confirm responsive rendering on major mobile clients.
- [ ] Confirm `Reply-To` uses the intended shop inbox.
- [ ] Confirm message audit history surfaces useful delivery state.

Status: PARTIALLY COMPLETE; COVERAGE MATRIX + RUNTIME VALIDATION REQUIRED.

---

# PHASE 4 — REFUND / POST-PAYMENT ENGINE

## Implemented in code

- [x] `refunds` migration exists.
- [x] Refund ledger exists.
- [x] Partial refund calculation.
- [x] Full cumulative refund calculation.
- [x] Over-refund guard.
- [x] Paid vs fully-refunded payment-state handling.
- [x] Refund audit event recording.
- [x] Refund data tests exist.
- [x] Admin refund route integration exists.
- [x] Refund notification module exists.

## Remaining

- [x] Zero and negative refund amount tests.
- [x] Duplicate-admin-submission/idempotent refund replay test.
- [x] Concurrent-refund loser-path test.
- [ ] Verify refund-after-completion.
- [ ] Verify refund-and-cancel.
- [ ] Verify cumulative partial refunds in real D1.
- [ ] Verify reporting net revenue after refund.
- [ ] Staging E2E refund scenario.
- [ ] Production controlled refund record scenario.

Status: MATERIAL IMPLEMENTATION PRESENT; CONCURRENCY/E2E HARDENING REMAINS.

---

# PHASE 5 — ADVANCED REPORTS

## Implemented/materially present in `admin-reports-v2.ts`

- [x] Gross revenue.
- [x] Refund totals.
- [x] Net revenue calculation.
- [x] Paid/payment-requested counts.
- [x] Collection vs delivery counts.
- [x] Revenue/refund trends.
- [x] Top products.
- [x] Requested vs confirmed quantities.
- [x] Lost quantity/value from unavailable/reduced items.
- [x] Refund reasons.
- [x] Cancellation reasons.
- [x] Operational duration metrics.
- [x] Ageing queues.
- [x] Email-failure/deliverability queue data.

## Remaining

- [ ] Confirm V2 reports route actually uses V2 report provider everywhere intended.
- [ ] Compare every planned metric in `ADMIN-V2-SPEC.md` with actual response shape.
- [ ] Verify quote→payment and payment→ready timing semantics with real event histories.
- [ ] Verify uncollected ageing thresholds/labels.
- [ ] Verify revised conversion funnel.
- [ ] Verify CSV exports; implement only if absent.
- [ ] Desktop + mobile report UI QA.

Status: SUBSTANTIALLY IMPLEMENTED; CONTRACT/UI VALIDATION REMAINS.

---

# PHASE 6 — SECURE CUSTOMER REVIEW

## Implemented in code

- [x] Customer review token storage.
- [x] Private review route.
- [x] Expired/superseded token rejection.
- [x] Original vs revised item rendering.
- [x] Customer message.
- [x] Exact revised total.
- [x] Accept-and-pay path.
- [x] Ask-a-question path.
- [x] Customer contact details not exposed in rendered page.
- [x] `noindex` / no-referrer protections.
- [x] Route tests exist.

## Remaining

- [ ] Verify token hashing and expiry implementation against spec.
- [ ] Add explicit cross-order token isolation test.
- [x] Idempotent double-accept behaviour test.
- [x] Accept/decline concurrency conflict coverage.
- [ ] Verify current-revision-only enforcement under superseded revisions.
- [ ] Verify decline flow end to end.
- [ ] Verify payment target always matches accepted revision.
- [ ] iPhone Safari QA.
- [ ] Desktop QA.

Status: SUBSTANTIALLY IMPLEMENTED; SECURITY/RACE/E2E VALIDATION REMAINS.

---

# PHASE 7 — EMAIL DELIVERABILITY TELEMETRY

## Implemented in code

- [x] `email_delivery_webhooks` migration exists.
- [x] Resend webhook route exists.
- [x] Svix/Resend signature verification path exists.
- [x] Provider message IDs are tracked.
- [x] SENT state mapping.
- [x] DELIVERED state mapping.
- [x] DELAYED state mapping.
- [x] BOUNCED state mapping.
- [x] COMPLAINED state mapping.
- [x] FAILED/SUPPRESSED state mapping.
- [x] Duplicate webhook event short-circuit exists.
- [x] Delivery state updates message records.
- [x] Order audit events are written for delivery transitions.

## Remaining

- [x] Duplicate webhook automated tests, including concurrent claim loser.
- [ ] Verify signed real Resend webhook in staging.
- [ ] Confirm staging webhook secret.
- [ ] Confirm production webhook secret.
- [ ] Confirm SPF.
- [ ] Confirm DKIM.
- [ ] Confirm DMARC.
- [ ] Verify admin warning/attention queue renders delayed/bounced/complained/failed messages usefully.
- [ ] Verify repeated provider delivery is idempotent in real D1.

Status: CODE SUBSTANTIALLY COMPLETE; PROVIDER/DNS/RUNTIME VERIFICATION REMAINS.

---

# PHASE 8 — CRITICAL AUTOMATED HARDENING

This is the next code milestone.

- [x] Same-version concurrent revision/transition mutation loser is rejected; side effects require the winning mutation token.
- [ ] Concurrent add/remove/restore mutation protection test.
- [x] Concurrent adjustment protection test.
- [x] Concurrent refund protection test.
- [x] Customer review accept/decline race test.
- [x] Duplicate webhook test, including insert-race loser.
- [x] Migration clean-install through `0008` is exercised by `npm run check` → `db:migrate:local`.
- [ ] Migration upgrade-path verification from production-equivalent schema.
- [x] `npm run check` PASS on `fafdcac6a4e0ab82e81954ea6f5fa1d8841df1c1` (Commerce CI run 36134835149).

Exit gate:
- no money-affecting action can be duplicated by a stale version/race in the tested model,
- migrations are deterministic,
- Commerce CI remains green.

Status: IN PROGRESS — CORE RACE/IDEMPOTENCY GATE PASSED; TWO VALIDATION ITEMS REMAIN.

---

# PHASE 9 — RELEASE-STATE DISCOVERY

Must happen before claiming Admin V2 is deployed.

- [ ] Record staging Worker SHA/version.
- [ ] Record production Worker SHA/version.
- [ ] Record staging D1 migration level.
- [ ] Record production D1 migration level.
- [ ] Compare deployed environments against audited source SHA.
- [ ] Create exact migration/deployment delta.
- [ ] No production migration until staging passes.

Status: NOT YET VERIFIED.

---

# PHASE 10 — STAGING END-TO-END V2

Run one complete scenario:

- [ ] Submit order.
- [ ] Start review.
- [ ] Reduce quantity.
- [ ] Mark product unavailable.
- [ ] Substitute product.
- [ ] Restore original line.
- [ ] Add extra item.
- [ ] Remove added item.
- [ ] Apply discount.
- [ ] Apply surcharge/manual correction.
- [ ] Change fulfilment method if supported.
- [ ] Send revised order to customer.
- [ ] Customer opens review page.
- [ ] Customer asks a question.
- [ ] Customer accepts current revision.
- [ ] Payment request flow.
- [ ] Mark paid.
- [ ] Preparing.
- [ ] Ready/shipped.
- [ ] Partial refund.
- [ ] Full/refund-and-cancel scenario where appropriate.
- [ ] Verify customer/owner emails.
- [ ] Verify Resend delivery webhook events.
- [ ] Verify reports/net figures.
- [ ] iPhone Safari.
- [ ] Desktop.

Status: WAITING FOR PHASES 8–9.

---

# PHASE 11 — COMMERCE V1 REMAINING QA

Historical production gaps that should be closed while V2 is staged:

- [ ] Delivery checkout.
- [ ] Repeat desktop checkout.
- [ ] Duplicate order submission against real API.
- [ ] API/network failure preserves basket.
- [ ] Confirm controlled production test order final lifecycle state.

Status: REMAINS.

---

# PHASE 12 — DOCUMENTATION RESET

- [ ] Rewrite README present architecture only.
- [ ] Reduce `SESSION-HANDOFF.md` to one current handoff plus archive pointers.
- [ ] Archive/label `WORK-CHECKLIST.md` as historical for current engineering work.
- [ ] Keep this file as the single live V2 execution tracker.
- [ ] Record exact staging/prod Worker versions and migration levels after release work.

Status: STARTED BY THIS CHECKLIST RECONSTRUCTION.

---

# PHASE 13 — GUARDED PRODUCTION RELEASE

Only after staging exit gates pass:

- [ ] Review migration plan.
- [ ] Apply only required production migrations.
- [ ] Deploy exact audited source SHA to production Worker.
- [ ] Verify health.
- [ ] Verify owner OTP.
- [ ] Verify admin order workspace on phone.
- [ ] Verify admin order workspace on desktop.
- [ ] Run controlled low-value revised-order scenario.
- [ ] Verify review email/page/payment path.
- [ ] Verify refund recording.
- [ ] Verify Resend delivery telemetry.
- [ ] Record final production Worker version/SHA.
- [ ] Record final production D1 migration level.
- [ ] Update this checklist and session handoff.

Status: BLOCKED UNTIL STAGING PASS.

---

# DO NOT TOUCH / PRESERVE

- Canonical static `/products/<slug>.html` architecture.
- Existing Search Readiness protections.
- Server-authoritative Commerce catalogue/pricing.
- Turnstile server verification.
- Order idempotency.
- Original customer-order snapshot.
- Separate revision state rather than rewriting the original order.
- Internal-note vs customer-message separation.
- Same-origin admin mutation controls.
- Expected-version concurrency model.
- Audit-event history.
- Separate staging and production D1 databases.
- Secrets outside source control.
- Manual payment/refund recording must not be presented as automatic bank movement.
- Do not delete historical/recovery assets without a reference audit.

---

# EXACT NEXT ACTION

**Finish Phase 8, then enter Phase 9 — Release-state discovery.**

Start by auditing the actual mutation SQL in:

- `commerce/src/data/order-revisions.ts`
- `commerce/src/data/refunds.ts`
- `commerce/src/data/customer-review.ts`
- `commerce/src/data/email-delivery.ts`

Then add tests proving stale/concurrent operations cannot produce duplicate money/state side effects.

Minimum first milestone:

1. same-version revision write race,
2. adjustment race,
3. refund race,
4. review accept/decline race,
5. duplicate Resend webhook handling.

Current hardened source baseline:
- `fafdcac6a4e0ab82e81954ea6f5fa1d8841df1c1`
- Commerce CI: PASS
- Search Readiness: PASS
- GitHub Pages: PASS
- `npm run check` includes local D1 migrations and therefore applied migrations through `0008_concurrency_guards.sql` on the clean CI database.

Remaining before Phase 8 is fully closed:
1. Add explicit concurrent add/remove/restore reviewed-item coverage, not only shared mutation-token/adjustment coverage.
2. Verify the migration **upgrade path** from a production-equivalent pre-`0008` schema, distinct from the clean-install CI path.
3. Update this checklist again with the exact closing SHA.
4. Then proceed immediately to Phase 9 deployment-state discovery.
