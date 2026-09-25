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

- Code/test hardening baseline before checklist close: `1208892221271be6f0dfe320e408aafaef1e18d7`
- Commerce CI: PASS (latest hardening run `36135410328`).
- Search Readiness: PASS (run `36134835077`).
- GitHub Pages: PASS (run `36134834631`).
- New concurrency migration: `0008_concurrency_guards.sql`.
- Revision, refund, customer-review and Resend-webhook critical mutations now use winner-owned mutation/idempotency guards.

Environment facts — direct Cloudflare audit on 25 September 2026:

- [x] Staging Worker current Version ID `0f5fb208-e4a8-49b7-9721-23bab226ba1b`; deployed after adjustment API/UI + customer-review adjustment transparency changes; staging health verified on 25 September 2026.
- [x] Production Worker remains unchanged at Version ID `938f0651-20b5-48df-a8d4-f84defbb263d`; deployment ID `f1ff4d67-bda6-4330-b4ae-961ea8d55f95`; created `2026-09-25T00:45:39Z`.
- [x] Staging D1 migrations `0003–0008` were applied successfully; post-deploy remote migration check reports **No migrations to apply**.
- [x] Production D1 remains unchanged through `0002_order_fulfilment_message.sql`; remote pending migrations remain `0003–0008`.
- [x] Production public `/health` is reachable and reports `status=ok`, `environment=production`, DB bound and Resend configured.
- [~] Current production health payload does not yet expose `webhookConfigured`, while current source does; therefore the live Worker predates the current Admin V2 health contract. Resend webhook secret must be re-verified after staging deployment and before production release.
- [~] New staging Worker exposes the expected Turnstile configuration bindings; functional Turnstile submission still requires Phase 10 E2E.
- [!] Staging `RESEND_WEBHOOK_SECRET` is currently **not configured**: staging health reports `notifications.webhookConfigured=false`. Signed live Resend webhook E2E is blocked until the secret is configured.

---

# PHASE 0 — CONTROL-PLANE RECONCILIATION

Goal: make project state resumable before adding more behaviour.

- [x] Deep repository audit completed against current `main`.
- [x] Confirmed old `ADMIN-V2-CHECKLIST.md` materially understated implementation.
- [x] Confirmed P2/P3/P4/P5/P6/P7 code already exists in current source.
- [x] Replace stale Admin V2 checklist with this reality-based tracker.
- [x] Replace the top of `docs/SESSION-HANDOFF.md` with one truthful current Admin V2 handoff.
- [x] Mark/archive obsolete Commerce pre-merge handoff sections so they cannot be mistaken for current state.
- [x] Update README current-commerce wording after runtime state is established.

Exit gate:
- one live checklist,
- one current handoff,
- no future session instructed to restart already-built V2 features.

Status: COMPLETE — one live checklist, a current handoff header, archived stale handoff material and corrected README commerce wording are now in place.

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
- [x] Revised payment-request emails are confirmed `delivered` by Resend for both staging E2E orders (`E2E-36142333770` and `E2E-36142342245`).
- [ ] Verify payment reminder behaviour if supported; implement only if genuinely absent.
- [ ] Verify preparing email.
- [x] Ready-for-collection notifications were received, visually verified on iPhone, and confirmed `delivered` by Resend for both staging E2E orders.
- [ ] Verify shipped email.
- [ ] Verify cancellation email.
- [x] Partial-refund, full-refund and refund-and-cancellation notifications were received/visually verified where captured and confirmed `delivered` by Resend.
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
- [x] Verify refund-after-completion in real staging D1/API.
- [x] Verify refund-and-cancel in a separate synthetic staging order.
- [x] Verify partial → idempotent replay → cumulative full refund in real staging D1.
- [x] Verify staging reports include the E2E gross/refund totals and net effect.
- [x] Staging E2E refund scenario passed in run `36142333770`.
- [ ] Production controlled refund record scenario.

Status: STAGING E2E VERIFIED; ONLY CONTROLLED PRODUCTION REFUND VERIFICATION REMAINS FOR RELEASE.

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

- [x] Confirm `/admin/api/reports` uses the V2 report provider and returns a V2 summary on real staging data.
- [ ] Compare every planned metric in `ADMIN-V2-SPEC.md` with actual response shape.
- [x] Verify review→payment→ready/completed event histories are consumed successfully by staging reports.
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
- [x] Explicit cross-order reference/content isolation verified in staging edge E2E.
- [x] Idempotent double-accept behaviour test.
- [x] Accept/decline concurrency conflict coverage.
- [x] Verify current-revision-only enforcement under an explicitly superseded revision in staging (edge E2E run `36143031389`).
- [x] Verify customer decline flow end to end in staging, including payment reset + token revocation.
- [x] Verify customer accept returns the exact payment URL attached to the active reviewed order.
- [ ] iPhone Safari QA.
- [ ] Desktop QA.

Status: CORE SECURITY/RACE/DECLINE/SUPERSEDED-TOKEN STAGING E2E VERIFIED; TOKEN EXPIRY SPEC REVIEW + BROWSER QA REMAIN.

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
- [!] Staging Resend webhook has now been created for sent/delivered/delayed/complained/bounced/failed/suppressed events, but remains disabled until its real signing secret is stored in the staging Worker.
- [x] `RESEND_WEBHOOK_SECRET` is now present in the **staging** Worker and remains absent from the production Worker. The user added it manually; Cloudflare was independently checked before enabling the webhook.
- [ ] Confirm production webhook secret.
- [x] SPF verified in Resend domain configuration (`rsend` and `send` CNAME records both verified).
- [x] DKIM verified in Resend domain configuration (`resend._domainkey`).
- [!] DMARC checked directly in live Cloudflare DNS: no `_dmarc.theblacksheepshop.co.uk` TXT record exists. Policy creation remains an explicit production-DNS decision.
- [ ] Verify admin warning/attention queue renders delayed/bounced/complained/failed messages usefully.
- [ ] Verify repeated provider delivery is idempotent in real D1.

Status: CODE SUBSTANTIALLY COMPLETE; PROVIDER/DNS/RUNTIME VERIFICATION REMAINS.

---

# PHASE 8 — CRITICAL AUTOMATED HARDENING

This is the next code milestone.

- [x] Same-version concurrent revision/transition mutation loser is rejected; side effects require the winning mutation token.
- [x] Concurrent add/remove/restore mutation protection tests.
- [x] Concurrent adjustment protection test.
- [x] Concurrent refund protection test.
- [x] Customer review accept/decline race test.
- [x] Duplicate webhook test, including insert-race loser.
- [x] Migration clean-install through `0008` is exercised by `npm run check` → `db:migrate:local`.
- [x] Pre-`0008` upgrade-path test: apply `0000–0007`, then apply `0008` to the same isolated local D1 and verify new guard columns/index.
- [x] `npm run check` PASS on `1208892221271be6f0dfe320e408aafaef1e18d7` (Commerce CI run `36135410328`).

Exit gate:
- no money-affecting action can be duplicated by a stale version/race in the tested model,
- migrations are deterministic,
- Commerce CI remains green.

Status: COMPLETE — concurrency/idempotency hardening and clean/upgrade migration gates pass in Commerce CI.

---

# PHASE 9 — RELEASE-STATE DISCOVERY

Must happen before claiming Admin V2 is deployed.

## Direct current-state audit

Read-only audit workflow:

- GitHub workflow: `.github/workflows/commerce-release-state.yml`
- creation/source commit: `abb7e85a60c837a2e10a0f6fbf249ba542ea0d1f`
- audit run: `36136085712`
- Cloudflare Actions credentials: available to GitHub Actions; secret values were not exposed.
- No deploy or migration-apply command was executed by the audit.

### Staging

- [x] Staging deployment workflow run: `36136427258`; job `108075499565`; conclusion: **success**.
- [x] Deployed source SHA: `860e260c6bfdcc1ab2f9de14e757b95d2f155af0`.
- [x] Remote migrations `0003_order_revisions.sql` through `0008_concurrency_guards.sql` applied successfully.
- [x] Post-migration remote check: **No migrations to apply**.
- [x] Current Cloudflare deployment ID: `287523a7-ea4d-4e4e-b666-5358b7dc7338`.
- [x] Current Worker Version ID: `ce641bd3-7817-4cef-8cef-b9cb7fe29c0f`.
- [x] Current deployment created: `2026-09-25T12:42:52.348134Z`.
- [x] Staging URL: `https://black-sheep-commerce-api-staging.ky6vfb55p9.workers.dev`.
- [x] Staging health: `status=ok`, `environment=staging`, D1 bound, Resend provider/from/owner configured.
- [!] Staging health reports `webhookConfigured=false`; live signed Resend webhook verification is blocked until `RESEND_WEBHOOK_SECRET` is added to the staging Worker.

### Production

- [x] Current Cloudflare deployment ID: `f1ff4d67-bda6-4330-b4ae-961ea8d55f95`.
- [x] Current Worker Version ID: `938f0651-20b5-48df-a8d4-f84defbb263d`.
- [x] Current deployment created: `2026-09-25T00:45:39.494054Z`.
- [x] Current version matches the last GitHub-recorded production deployment, so no later manual Cloudflare deployment was found.
- [x] Current remote D1 migration table also reports `0003–0008` pending.
- [x] Production public health is live and returns an OK production service with D1 bound and Resend credentials configured.
- [x] Live production health payload is older than current source: it does not include `notifications.webhookConfigured`, which is present in current `commerce/src/index.ts`.
- [x] Production is intentionally left unchanged until Phase 10 staging E2E passes.

## Source/deployment mapping

- [x] GitHub-recorded source for both currently deployed Workers: `19418b02473e4d8122b0214021cc1196e84daa3d`.
- [x] Direct Cloudflare current Version IDs match those GitHub-recorded deployments.
- [x] Admin V2 hardened commerce-code baseline: `1208892221271be6f0dfe320e408aafaef1e18d7`.
- [x] Current `main` also includes subsequent checklist/audit-only commits; these do not weaken the Phase 8 code baseline.
- [x] Exact staging release delta: apply remote migrations `0003–0008`, then deploy current `main` Worker code.
- [x] Exact production release delta is intentionally recorded but blocked: same migration range + current Worker code, only after staging approval.

## Release decision

- [x] Direct Cloudflare state is now verified rather than inferred.
- [x] Staging-first delta is understood.
- [x] Do not migrate/deploy production in Phase 9.
- [x] Run the guarded staging deploy from newest release commit.
- [x] Confirm `npm run check` passes in the staging deploy job.
- [x] Confirm staging migrations `0003–0008` apply successfully.
- [x] Confirm staging Worker deployment succeeds and record its new Version ID.
- [x] Verify staging `/health`.
- [x] Move to Phase 10 staging E2E.
- [!] Configure staging `RESEND_WEBHOOK_SECRET` before the email-deliverability portion of Phase 10 can pass.

Status: **COMPLETE — STAGING IS MIGRATED AND DEPLOYED; PHASE 10 IS ACTIVE WITH ONE EMAIL-WEBHOOK SECRET BLOCKER.**

---

# PHASE 10 — STAGING END-TO-END V2

## Verified staging baseline

- [x] Adjustment data layer is exposed through authenticated Admin API routes.
- [x] Draft-review UI supports add/remove Discount, Surcharge and Manual Correction lines.
- [x] Customer review now exposes explicit adjustment labels/amounts instead of an unexplained total difference.
- [x] Commerce CI, Search Readiness and Pages passed after the adjustment/customer-review fixes.
- [x] Staging D1 remains current through `0008_concurrency_guards.sql`.
- [x] Current staging Worker Version ID: `0f5fb208-e4a8-49b7-9721-23bab226ba1b`.
- [x] Isolated staging E2E workflow: `.github/workflows/commerce-staging-v2-e2e.yml`.
- [x] E2E script: `commerce/scripts/staging-v2-e2e.mjs`.
- [x] E2E run `36142333770`, job `108094936767`: **SUCCESS**.
- [x] Additional core E2E run `36142342245`: **SUCCESS**; its synthetic order references match the user-verified inbox screenshots.
- [x] Resend provider records confirm both core E2E order sets as delivered for payment request, payment received, ready for collection, partial refund, final refund/refund-and-cancel, plus owner customer-question notifications.
- [x] Edge-case E2E run `36143031389`, job `108097224317`: **SUCCESS** (decline, token revocation, superseded-token rejection, current-token enforcement, cross-order isolation).
- [x] Synthetic edge-case data was automatically cleaned after the successful run.
- [x] Synthetic test data was automatically cleaned after the successful run.
- [x] Production was not touched.

## E2E scenario

- [~] Public order submission was not exercised because the automated scenario intentionally seeded an isolated staging-only order. Actual checkout submission remains Phase 11/Turnstile QA.
- [x] Start review.
- [x] Reduce quantity.
- [x] Mark product unavailable.
- [x] Substitute product.
- [x] Restore original line.
- [x] Add extra catalogue item.
- [x] Remove shop-added item.
- [x] Apply Discount.
- [x] Apply Surcharge.
- [x] Apply Manual Correction and remove it again.
- [x] Change fulfilment collection → delivery → collection.
- [x] Finalize/send reviewed revision.
- [x] Payment-request flow reached `AWAITING_PAYMENT / PAYMENT_REQUESTED`.
- [x] Customer review page opened successfully with explicit adjustment lines and exact final total.
- [x] Customer question route succeeded and appeared in admin message history.
- [x] Customer accepted the current revision.
- [x] Second accept behaved idempotently.
- [x] Accepted review returned the exact configured secure payment URL.
- [x] Mark paid.
- [x] Start preparing.
- [x] Ready for collection.
- [x] Complete order.
- [x] Partial refund against real staging D1.
- [x] Same refund idempotency replay.
- [x] Cumulative full refund after completion while preserving `COMPLETED`.
- [x] Separate full refund-and-cancel scenario → `CANCELLED / REFUNDED`.
- [x] Audit events verified for revision, adjustments, acceptance, payment, fulfilment and refunds.
- [x] Reports verified to include E2E gross/refund figures.
- [x] Payment-confirmed, ready-for-collection, partial-refund and refund-and-cancellation emails were received in the real inbox and rendered cleanly on iPhone; user-provided screenshots correspond to successful staging E2E orders including `E2E-36142333770` and `E2E-36142342245`.
- [!] Resend staging webhook now exists with the required delivery events but is intentionally disabled until the real signing secret is stored in Cloudflare staging; staging health therefore still reports `notifications.webhookConfigured=false`.
- [x] Customer decline flow E2E: revision → `DECLINED`, order → `UNDER_REVIEW`, payment request cleared, token revoked.
- [x] Superseded/current-revision-only review-token E2E: old token → 404, current token → 200.
- [x] Cross-order reference/content isolation verified with separate synthetic orders.
- [x] Checkout browser QA run `36146604387`, job `108109223048`: **SUCCESS** — delivery review UI, production Turnstile widget render, production-origin→staging CORS, staging idempotent replay and network-failure basket recovery.
- [x] Production order read-only audit run `36146984153`, job `108110486489`: **SUCCESS** — controlled collection orders ended `COMPLETED / PAID`; no production write command was executed.
- [x] Aggregate production delivery audit run `36147282538`, job `108111475317`: **SUCCESS / READ-ONLY** — `deliveryOrderCount=0`, so no real delivery-order submission can be claimed yet.
- [x] Admin UI browser QA run `36150996964`, job `108123926387`: **SUCCESS** — authenticated order list/detail, start review, create revision, adjustment controls, collection↔delivery UI, desktop overflow checks, mobile WebKit detail/open-close, unclipped controls and no horizontal overflow.
- [x] Staging webhook health re-verification run `36153542380`, job `108132465462`: **SUCCESS** — current Worker Version ID `e84f43fc-c9bc-4f8d-a259-f8d8646f5df7`; `/health` reports `notifications.webhookConfigured=true`.
- [x] Deployed production source `19418b02473e4d8122b0214021cc1196e84daa3d` confirms `/v1/orders` required Turnstile verification before creating a new order.
- [x] WebKit mobile Admin UI QA passed in staging browser workflow; real-device iPhone Safari spot-check remains optional polish, not a functional blocker.
- [x] Desktop Chromium Admin UI QA passed on current staging build.

Status: **CORE + REVIEW-EDGE ADMIN V2 STAGING E2E PASSED, transactional emails are inbox/provider-verified, checkout browser regression passes, and Admin UI browser QA now passes on desktop Chromium + mobile WebKit. Remaining gates are webhook telemetry and one real Delivery submission through Turnstile.**

---

# PHASE 11 — COMMERCE V1 REMAINING QA

Historical production gaps that should be closed while V2 is staged.

## Code/test state already verified

- [x] Customer-facing delivery checkout fields and delivery/collection switching exist in `checkout.html`.
- [x] Server route accepts delivery and collection and enforces the current GB-only delivery rule.
- [x] Client keeps one UUID idempotency key in `sessionStorage` across retry attempts and removes it only after successful order creation.
- [x] Server-side idempotent retry returns the existing order **before reusing Turnstile**; covered in `commerce/test/orders-route.test.ts`.
- [x] Turnstile failure / replayed-token rejection is covered.
- [x] Turnstile hostname and action mismatch checks are covered.
- [x] Client network/API failure path does not clear the basket and explicitly tells the customer the basket is safe.
- [x] Basket is cleared only after a successful order response.

## Runtime/browser gates still open

- [ ] Real delivery checkout submission through the public checkout with a valid Turnstile token.
- [ ] Repeat desktop checkout through the live customer flow.
- [ ] Duplicate order submission against the **real** API with one real order/idempotency key.
- [ ] Browser-runtime verification that API/network failure preserves basket state after a failed submit.
- [x] Controlled production test orders were audited read-only: `BSR-260925-XHWRY3CV` and `BSR-260925-REZJU5DE` are `COMPLETED / PAID / collection`; full review→quote→payment→preparing→ready→completed event histories are present.

Status: **CODE BEHAVIOUR IS PRESENT AND UNIT-VERIFIED; REAL PUBLIC CHECKOUT/TURNSTILE BROWSER QA REMAINS.**

---

# PHASE 12 — DOCUMENTATION RESET

- [x] README aligned to current basket/order-request + commerce runtime boundary.
- [x] `SESSION-HANDOFF.md` synchronized to the verified current Admin V2 state and historical material clearly isolated.
- [x] `WORK-CHECKLIST.md` explicitly labelled historical/non-authoritative for current engineering work.
- [x] Keep this file as the single live V2 execution tracker.
- [ ] Record exact staging/prod Worker versions and migration levels after release work.

Status: COMPLETE FOR PRE-RELEASE CONTROL PLANE — current checklist is authoritative, session handoff is synchronized, legacy work checklist is historical.

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

- [x] Staging Resend webhook enabled successfully after `/health` confirmed `webhookConfigured=true`.

# EXACT NEXT ACTION

**STEP IN PROGRESS — Inspect and verify a real staging webhook event.**

Pre-step state:
- staging Resend webhook: ENABLED
- staging Worker health: `webhookConfigured=true`
- staging Worker Version ID: `e84f43fc-c9bc-4f8d-a259-f8d8646f5df7`
- production remains unchanged

Current step:
1. list recent events delivered to this webhook,
2. choose a real email event suitable for verification,
3. inspect delivery attempts/status,
4. if no suitable event exists, generate one controlled staging transactional email,
5. update this checklist before replaying the selected event.

**Do not touch production.**
