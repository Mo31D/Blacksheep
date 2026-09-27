# Black Sheep Platform — Cards 03–08 Staging Verification

Date: 27 September 2026  
Repository: `Mo31D/Blacksheep` · branch `main`  
Environment: **Staging only**  
Production: **not modified**

## Result

The D1 daily quota reset allowed the previously deferred remote verification to complete.

Full Admin browser QA:

- Workflow: **Commerce Staging Admin Browser QA**
- Run: **36315773161**
- Result: **PASS**
- Browser artifact: `staging-admin-browser-qa`
- All synthetic Product, Storefront Structure, Homepage, Appearance, Stocktake and order QA records were cleaned after the run.

## CARD 03 — Product placement

Verified:
- Primary + multi-location Product placement.
- placement persistence in Edit Product.
- private draft preview.
- publish → public version/placement verification.
- Staging never falsely claims Production is live.
- iPad portrait has no Product placement overflow.

## CARD 04 — Dynamic collections/navigation

Verified:
- published Storefront Structure public contract.
- Admin menu-visibility publication.
- collection membership driven by Product placements.
- storefront preview navigation.
- Catalogue hierarchy/reorder/archive/restore still works.
- no technical category enums exposed to owner.
- iPad portrait Catalogue layout passes.

## CARD 05 — Stocktake 2.0

Migration:
- `0019_stocktake_sessions.sql` is applied on remote Staging D1.
- migration ledger confirmed current before Browser QA.

Verified:
- Romney's scoped Stocktake preview.
- Highland Cows scoped Stocktake preview.
- persistent Stocktake session.
- Save & next reuses the same quantity input.
- quantity input remains focused after Save & next on WebKit/iPad flow.
- `enterkeyhint="next"` is present.
- closing then reopening exposes the unfinished Stocktake for Continue.
- Cancel works.
- conflict logic routes concurrency changes into review instead of overwrite.
- final review/result summary remains in the owner flow.
- iPhone/iPad Stocktake has no horizontal overflow.

## CARD 06 — Homepage merchandising

Migration:
- `0020_homepage_merchandising.sql`

Verified:
- New arrivals.
- Featured products / Popular picks.
- Selected collection.
- manual Featured selection/reorder.
- draft changes do not replace published version.
- private preview.
- iPad portrait layout passes.

## CARD 07 — Homepage modules

Migration:
- `0021_homepage_modules.sql`

Verified:
- protected five-module model.
- owner reorder.
- owner hide/show.
- changes remain draft until publish.
- private module-layout preview.
- public composition keeps live commerce authoritative for Product data.

## CARD 08 — Website Appearance

Migration:
- `0022_website_appearance.sql`

Verified:
- safe Appearance workspace.
- versioned private draft.
- private preview.
- publish → public Appearance contract.
- storefront applies published tokens and Hero.
- restore prior Appearance version.
- iPad portrait no-overflow.
- no arbitrary CSS storage/input.

## QA cleanup

The passing run explicitly cleaned:
- Website Appearance QA data.
- Homepage merchandising QA data.
- Stocktake sessions.
- Product placement QA data.
- Storefront Structure QA data.
- legacy Category QA data.
- Admin order/session QA data.

## Safety

The QA workflow explicitly targets:
- staging Worker.
- `black-sheep-commerce-staging` D1.

It contains no Production Worker deploy, Production D1 migration, or Production write command.

## Next

**CARD 09 — Seasonal theme presets, Hero editor & section imagery**.
