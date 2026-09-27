# Black Sheep Platform — CARD 09 Seasonal Appearance Staging Verification

Date: 27 September 2026  
Repository: `Mo31D/Blacksheep` · branch `main`  
Environment: **Staging only**  
Production: **not modified**

## Result

CARD 09 — Seasonal theme presets, Hero editor & section imagery is complete and Staging verified.

### Validation evidence

- Commerce CI: **36316749986 — PASS**
- Search readiness: **36316749990 — PASS**
- Focused CARD 09 Staging validation/deploy: **36316859445 — PASS**
- Full Admin browser QA: **36316902429 — PASS**
- Browser artifact: `staging-admin-browser-qa` · artifact `10931007575`
- No new D1 migration was required.

## Seasonal presets

The owner-facing Appearance workspace now exposes five protected presets:

- Default
- Winter
- Christmas
- Summer
- Ice Cream

Each preset supplies approved design tokens. The owner can choose a preset without editing code, make limited colour adjustments, or reset the colours to the selected preset defaults.

## Safety / design guardrails

- Arbitrary CSS remains unavailable.
- Preset keys are whitelisted server-side.
- Core foreground/background combinations are checked against readable contrast thresholds before a draft can be saved.
- Button contrast is protected.
- Appearance remains versioned with private draft, Preview, Publish and Restore.
- Scheduling fields remain future-ready in the existing data model; no scheduling UI was introduced.

## Hero and section imagery

Staging browser QA verified:

- Homepage Hero heading editing.
- Homepage Hero image editing.
- Section image override editing.
- Draft persistence.
- Public Appearance contract after Publish.
- Storefront application of the published Hero/preset/section image configuration.
- Restore to the prior published Appearance version.

The Hero image uses a protected `object-fit: cover` centred crop. Mobile storefront QA ran at 390px width and verified the Hero remains contained with no horizontal overflow.

## Responsive owner UX

- Seasonal presets are shown as owner-friendly visual cards.
- Primary colour controls stay visible.
- Less common colour controls are progressively disclosed under “More colour controls”.
- iPad/phone layout remains protected by the existing Admin responsive rules.

## Cleanup

The full browser QA restores the prior published Appearance state and cleans synthetic QA data after the run.

## Safety

The dedicated deploy workflow targeted only:

- Staging Worker: `black-sheep-commerce-api-staging`
- Staging D1 verification

It explicitly rejects Production custom-domain references during the staging deploy.

**Production Worker and Production D1 were not modified.**

## Next

Proceed with **CARD 11 — Shared Media Library on R2** so Products, Homepage, Sections and Themes can reuse uploaded media through a simple owner-facing picker instead of relying on image-address entry.
