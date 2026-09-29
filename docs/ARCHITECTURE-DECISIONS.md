# Architecture decisions

## 2026-09-27 — Preserve the current stack and authority boundaries

**Decision:** Keep the static storefront, Commerce Worker and D1/R2. D1 owns operational commerce; Git main owns code and static publication. Static metadata is an export input where explicitly required, never a second checkout pricing source.

**Why:** Existing production workflows and tests already implement these boundaries. Rehabilitation should remove duplication without losing established behaviour or indexed URLs.

**Rejected alternative:** A new framework/app or shadow catalogue would create another migration and competing authority.

## 2026-09-27 — One HTTP image validation owner

**Decision:** `commerce/src/http/image-upload.ts` owns multipart/file/type/size/signature/hash validation for Product and shared-library uploads. Thin named readers retain metadata validation and existing error namespaces/precedence. Domain services continue to own storage associations and lifecycle.

**Why:** All upload entry points must enforce identical binary rules. This is a safe extraction independent of the higher-risk D1/R2 lifecycle migration.

**Rejected alternative:** Removing Product endpoints immediately or making every image a Product image would conflate transport validation with association/history semantics. Permanent parallel storage ownership is also not the target; retirement requires caller and migration proof.

## 2026-09-27 — Separate source verification from deployment evidence

**Decision:** Track local checks, Linux CI, staging acceptance and production promotion independently. Retain production clean Product routes disabled until a dedicated canonical/redirect migration.

**Why:** A public-feed version match does not prove rendered HTML, and a main push does not deploy the Worker.

**Rejected alternative:** Marking work production-complete solely from unit tests or an old release report hides environment drift.

## 2026-09-27 — Upload failure does not prove an unowned object

**Decision:** All upload compensation goes through `data/media-upload-cleanup.ts`. Delete a newly generated key only after successful reads find neither a Product media owner nor an active/archived library owner; Product history rows also retain ownership. Preserve the original error on cleanup failure.

**Why:** D1 may commit before a later read fails. Unconditional R2 deletion turns an HTTP failure into a broken persisted image. Ownership uncertainty must retain data.

**Rejected alternative:** A route-local success flag misses ambiguous database commits and would duplicate lifecycle policy. This helper is only for new-upload compensation, not a substitute for atomic claims when deleting existing assets.

## 2026-09-28 — Lock dependency resolution at CI and release boundaries

**Decision:** Primary Commerce CI and guarded deployment use `npm ci` and cache by the committed lockfile, matching local setup. Explicit pinned browser-only tooling remains a separate ephemeral step.

**Why:** Validation and release must use the same dependency graph; package/lock drift should fail rather than being silently reconciled during a release.

**Rejected alternative:** Fresh dependency resolution with `npm install` in the primary gates weakens reproducibility. A new build framework or composite workflow is unnecessary for this correction. Ancillary QA workflows can be aligned in a separate reviewed task.

## 2026-09-28 - Library ownership for every new upload

**Decision:** data/media-upload.ts is the sole new R2 image creation service. The library and retained Product upload/replace routes call it. Product media and version rows retain gallery placement/history ownership; library assets own new bytes and reusable identity. Old objects and URLs are not rewritten.

**Why:** Product replacement was an active caller creating a competing storage lifecycle. Keeping its transport but changing its persistence owner removes that duplication without changing the full editor or historical associations. Direct Product media references already participate in library usage/deletion checks.

**Rejected alternative:** Deleting the replacement endpoint breaks an active UI. Deleting a successfully created library asset when attachment fails destroys reusable content and can corrupt an ambiguously committed association. Retain it; independent library archive/delete remains the cleanup mechanism.

## 2026-09-28 - Check asset availability inside the Product write

**Decision:** Product add/replace performs the shared asset availability check in the initial optimistic UPDATE of its D1 batch. Archived/deleted assets and any deletion job block the batch's token-gated mutations. Legacy Product keys without a library row remain supported.

**Why:** A prior HTTP/domain read can race with archive/delete. The deletion side already checks Product/history references atomically; both write directions must participate for protection to hold.

**Rejected alternative:** Another preflight lookup or best-effort reference insert after attachment cannot prevent an image deletion already claimed before the Product write. No new lock table/schema is needed.

## 2026-09-28 - Guard newly used content images, retain historical references

**Decision:** shared-media-attachment.ts owns the SQL availability predicates for Product keys and content URL sets. Section create/update and Appearance draft saves apply them in the first D1 batch write. Subsequent version/audit writes require that owner write to succeed.

**Why:** Preflight reads cannot stop a concurrent deletion claim. Only newly selected URLs need ACTIVE assets: old version references already protect archived images, so ordinary text edits must remain possible. One JSON binding covers Appearance image maps without per-image query loops.

**Rejected alternative:** Requiring every retained image to be ACTIVE breaks edits to historical content; post-save reference registration is too late to stop deletion. Separate content and audit commits would permit partial saves.

## Product maker and shop range are separate concepts (28 September 2026)

**Decision:** product_versions.brand owns descriptive maker text. Versioned category relationships own shop classification. Product create/full edit exposes both explicitly; quick selling edits do not change them.

**Why:** Read-only D1 evidence in BRAND-OWNERSHIP-AUDIT.md shows existing makers without Brand/Range categories and different makers grouped under one range. Deriving maker on every save silently loses valid data.

**Rejected alternative:** Collapse maker into the first selected Brand/Range or migrate all maker text to category names. This would change existing product descriptions and erase distinct information. No database migration is needed.

## Inventory replay validates identity at one boundary

**Decision:** replaySnapshot validates the expected variant/location on every replay, including batch-error recovery; initial counts also require INITIAL_COUNT.

**Why:** Catch-path duplication skipped the preflight identity checks and could return another operation as successful. One replay boundary prevents future callers bypassing the check.

**Rejected alternative:** Patch each catch separately. That leaves duplicated checks prone to drift. No new stock owner or request contract is introduced.

## Recover Stocktake from the existing inventory ledger

**Decision:** Same-attempt Stocktake recovery validates committed movement receipts before baseline checks. inventory.ts owns receipt interpretation; stocktake.ts owns workflow aggregation. Preserve existing session/version/chunk keys.

**Why:** A saved count advances the balance version even when session result persistence fails. Treating that receipt as an external edit loses the successful result. Exact namespace/target/type/quantity checks recover it without writing stock again.

**Rejected alternative:** Reset count baselines to live stock, reapply counts, or add a parallel receipt store. These can overwrite later legitimate changes or create competing truth. Entire-session locking/concurrency is separate work, not implied by this bounded recovery.

## Stocktake write fencing and attempt immutability

**Decision:** Stocktake supplies a trusted internal SQL predicate to inventory count writes. Its session/version must still be active in the same statement that mutates stock. Once current-attempt ledger receipts exist, edit/cancel cannot change that attempt until its result is finalized; saved summary advancement opens any REVIEW corrections.

**Why:** Read-before-write checks alone allow cancelled/edited counts to reach balances. Mutating an already partly committed attempt also destroys its recovery identity. The authoritative ledger already records whether an attempt has started.

**Rejected alternative:** UI disabling alone, preflight-only checks, or a new lease/lock store. These either leave races open or add another recovery protocol when atomic predicates and existing evidence suffice. The guard is not accepted from HTTP inputs.

## Completed Stocktake retries use saved outcomes (29 September 2026)

**Decision:** Project cumulative completion results from stocktake_session_items for first completion and retries; return live inventory snapshots and a real batch reference or null. Keep REVIEW results per attempt.

**Why:** The completed session is already the durable workflow receipt. Repeated requests must preserve stock and display accurate totals, including earlier review rounds.

**Rejected alternative:** Reapply counts, invent a batch ID, return empty success arrays, or add a second persisted response store. These either risk stock, misrepresent results, or duplicate authoritative session state.

## A missing lifecycle hold does not imply a legacy order (29 September 2026)

**Decision:** Keep Admin order concurrency guards active when the expected reservation plan is absent; allow the no-plan write only if the revision has no reservation history. Couple its event to the immediately preceding successful update. Customer decline checks current unpaid state in the revision write.

**Why:** Real-schema races proved that a terminal/committed reservation could disappear from a state-filtered lookup while the stale order action still proceeded. Durable reservation history distinguishes this from a genuinely old order.

**Rejected alternative:** Reject every order without a hold (breaks legacy orders), or use another preflight-only check (leaves the same race). No new status flag or shadow reservation store is needed.

## Admin composition root retains security (29 September 2026)

**Decision:** Extract a business-object route area as an internal sub-handler called after the existing Origin/authentication/database guards. Shared-media dependencies are typed and composed at the same root; JSON response/read helpers have one HTTP owner.

**Why:** This reduces coupling without creating a second security policy or changing endpoints, error contracts, storage ownership or frontend behaviour.

**Rejected alternative:** Register an independent media router with copied auth checks, or move business persistence into the HTTP module. Both duplicate established responsibilities.

## Atomic Product edit ownership (29 September 2026)

Decision: draft, quick and variant edits must fail the first batch mutation atomically when expected versions are stale; reuse the required Product version constraint and existing conflict error.

Why: updated_at is a timestamp, not a unique write owner. Nine real-schema races proved that equal millisecond timestamps can authorize a stale request after a no-op optimistic UPDATE. Aborting the transaction protects all dependent writes.

Rejected alternative: adding random suffixes to timestamps or checking only after the batch. The former corrupts timestamp semantics; the latter cannot undo committed dependent changes. No new schema is needed.

## Email retry ends at provider acceptance (29 September 2026)

Decision: notification services share one two-attempt send policy. Resend retries only ambiguous/transient failures with the same provider idempotency key; permanent rejections are final. D1 audit writes happen after provider acceptance and never trigger a resend. Webhook event claims remain atomic and older nonterminal events cannot downgrade a newer delivery state.

Why: a transport timeout can hide successful acceptance, while an audit database error after acceptance is not a send failure. Resend's 24-hour key window covers a single logical retry; D1 remains the authoritative local audit. Signed webhook IDs are the durable replay boundary for delivery events.

Rejected alternative: independently retry every caught error in each notification module, including audit errors and permanent 4xx. That duplicated code can send the same message twice and still misstate delivery. A new queue or universal exactly-once claim would require a separate durable outbox migration and is not implied by this repair.

## Staging outbound mail fails closed (29 September 2026)

Decision: the shared email-provider resolver blocks every staging/preview recipient unless their exact mailbox is present in a staging-only `STAGING_EMAIL_ALLOWLIST`. An absent or malformed list blocks all sends; policy rejection is not retried. Production keeps its established delivery behaviour.

Why: the deployed staging Worker shares the production owner recipient and can target supplied customer addresses. The provider boundary covers order, Admin, customer-review and admin-code flows without adding separate UI or route checks. An operator must supply a safe test mailbox at release; the repository cannot invent one.

Rejected alternative: infer safety from the environment name, rewrite recipients in each caller, or silently claim a blocked message was sent. Those leave bypasses or false audit records. A provider-account split alone would not prevent mail to real recipients.

## JSON response privacy is an explicit HTTP boundary (29 September 2026)

Decision: share exact public no-store and private no-store/noindex JSON response shapes in `http/json-response.ts`. Admin request parsing/error mapping stays in `http/admin-json.ts`; root Worker responses retain their CORS/initialization logic.

Why: catalogue, order and webhook JSON have one exact header contract, while Admin, customer review and media error JSON have the same additional indexing protection. Sharing those two shapes removes drift without flattening distinct route responsibilities.

Rejected alternative: a universal response helper with per-route flags, or merging environment feature flags because they look similar. Both would hide meaningful public/private and staging/production differences behind switches.
