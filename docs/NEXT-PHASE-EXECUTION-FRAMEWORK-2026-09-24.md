# Black Sheep — Next Phase Execution Framework

Date: 24 September 2026  
Repository: `Mo31D/Blacksheep`  
Branch authority: `main`

Read first:

1. `docs/NEXT-PHASE-BASELINE-2026-09-24.md`
2. `docs/SESSION-HANDOFF.md`
3. `docs/OWNER-REQUESTS.md`
4. `docs/WORK-CHECKLIST.md`

## Working rule

The next phase is intentionally split into small, reversible milestones. Do not combine a broad redesign, catalogue migration and infrastructure refactor into one change set.

Every implementation milestone must:

1. fetch/re-read the newest remote `main`
2. preserve every newer commit
3. change one coherent concern
4. run the relevant deterministic builders
5. run search-readiness validation
6. inspect generated diffs for accidental catalogue/page drift
7. commit with a narrow message
8. verify GitHub Actions / Pages after the milestone
9. update the next-phase documentation when architecture or assumptions change

Never force-push.

## Phase 0 — Baseline and audit

Status: COMPLETE.

Completed:

- established current authoritative commit
- confirmed current CI and Pages deployment are green
- mapped catalogue/runtime/build architecture
- checked all root HTML pages for local-reference and metadata problems
- identified current catalogue counts/status distribution
- identified confirmed My list image-pending bug
- recorded generator/process/repository risks

Reference: `docs/NEXT-PHASE-BASELINE-2026-09-24.md`.

## Phase 1 — Stabilise the foundation

Do before a large visual/feature overhaul.

### 1A. Fix confirmed behavioural defects

- fix My list image-pending rendering
- add a regression guard for missing product images in list UI
- add keyboard focus containment for the My list dialog if the drawer remains part of the next design

### 1B. Define a single generated-output contract

Create a clear manifest of:

- source-of-truth catalogue data
- product-page outputs
- collection-page outputs
- Full range output
- sitemap output
- redirects/retired routes
- JSON-LD ownership

The goal is to prevent one section builder from silently invalidating another section.

### 1C. Unify build orchestration

Preferred direction:

- one top-level build/check command
- section-specific renderers may remain internally
- one orchestrator owns shared outputs
- a `--check` mode must detect every generated-file drift
- CI calls the orchestrator rather than relying on growing chains of unrelated builders

Do not convert the site to a framework unless the requested next-phase features justify it.

### 1D. Strengthen generic QA

Move product-family-specific invariants toward generic catalogue invariants where possible:

- exactly one static page per active catalogue slug
- no orphan static product pages unless explicitly retired
- collection card text/image/price/status match catalogue source
- missing-image states never emit broken `src` or OG image URLs
- no duplicate IDs/slugs/SKUs
- canonical/sitemap/schema consistency
- internal links/assets resolve
- Product Information open by default

## Phase 2 — Repository and branch hygiene

Do only after generating an exact usage map.

- identify unused root numbered images and recovery artifacts
- identify duplicate assets by hash
- distinguish production assets from recovery/history assets
- remove only confirmed unused files
- inspect the four non-main branches for unique work
- delete branches only after confirming their unique commits are obsolete
- remove or repurpose branch-specific workflows that no longer serve production

Because `main` is currently unprotected, use either:
- branch protection, or
- a dedicated next-phase branch with milestone merges

for high-volume changes.

## Phase 3 — Product/catalogue architecture for the new design

This phase should be filled in only after the owner supplies the exact next-stage requirements.

Default design constraint:

The visual design may change radically, but product identity, owner pricing, provenance, static canonical URLs and search discoverability remain stable unless explicitly changed.

Potential tasks will be split by surface, for example:

- global shell/navigation
- homepage
- Gifts discovery
- individual product pages
- food/confectionery collections
- Full range/search/filter UX
- My list
- visit/contact experience
- responsive/mobile system
- structured data/SEO
- performance/image pipeline

Do not implement all surfaces in one commit.

## Phase 4 — Visual system migration

When the new design brief is known:

1. create tokens/layout primitives first
2. migrate one representative page
3. validate mobile + desktop
4. migrate collection pages
5. migrate product pages through shared templates/builders
6. remove obsolete CSS only after all pages are migrated

Avoid page-by-page bespoke CSS unless a page genuinely requires a unique component.

## Phase 5 — Final production QA

Minimum final checks:

- deterministic build/check passes
- Search readiness passes
- GitHub Pages deploys successfully
- all active pages return correct canonical/robots state
- all catalogue products have the expected static page
- sitemap count matches generated active/indexable URLs
- Product Information opens by default
- no invalid image references
- no supplier/trade links leak publicly
- My list works for normal, out-of-stock, unpriced and image-pending items
- keyboard navigation works
- mobile and desktop navigation work
- retired URLs remain safe/noindex
- production domain and CNAME remain correct

## Master execution prompt template

Use this when a large next-stage requirement is supplied:

> BLACK SHEEP — NEXT PHASE EXECUTION
>
> Continue the existing `Mo31D/Blacksheep` project.  
> GitHub `main` is authoritative.
>
> First read `docs/NEXT-PHASE-BASELINE-2026-09-24.md` and `docs/NEXT-PHASE-EXECUTION-FRAMEWORK-2026-09-24.md`, then fetch current `main` and inspect newer commits.
>
> Do not restart or redesign blindly. Preserve the canonical static-product architecture, owner-confirmed pricing, supplier/source rules, Product Information default-open behaviour, SEO/schema/sitemap invariants and all newer work.
>
> Convert the requested change into small milestones before implementation. Each milestone must have:
> - exact scope
> - files/systems affected
> - validation criteria
> - rollback-safe commit boundary
>
> Implement one milestone at a time. Run deterministic generation/checks and search-readiness after every milestone. Never force-push.
>
> If the requested design requires architectural change, first modify the shared source/template/build layer, then regenerate outputs. Do not hand-edit large sets of generated product pages when a shared generator should own them.
>
> Record any new architectural decision or unresolved blocker in the next-phase documentation.

## Current next action

Wait for the owner's concrete description of what the “new phase” should become.

Once supplied, convert that request into Phase 3+ milestones using this framework before changing production code.
