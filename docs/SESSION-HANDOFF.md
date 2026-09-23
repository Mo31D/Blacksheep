# Black Sheep — Session Handoff

Updated: 23 September 2026

This is the short handoff file for ChatGPT, Work/Sites, Codex, or any future session. Read this before making changes.

## Authority

- Repository: `Mo31D/Blacksheep`
- Branch: `main`
- GitHub `main` is the primary source of truth.
- The user is continuing the project directly and does **not** depend on recovering the previous Work-local tree.
- Never force-push over newer work.
- Work/Sites may rejoin later, but it must sync from current GitHub and follow this handoff/checklist rather than relying on its old local state.
- Do not create a duplicate Sites project. Synchronize only when the exact existing Black Sheep Sites project is identified.

## Required session procedure

At the start:
1. Fetch latest `main`.
2. Read:
   - `docs/WORK-CHECKLIST.md`
   - `docs/SESSION-HANDOFF.md`
   - `docs/OWNER-REQUESTS.md`
   - `docs/HIGHLAND-COW-SOURCE-MAP.md`
3. Inspect recent commits before editing.

During work:
1. Work in small milestones.
2. Validate each milestone.
3. Commit and push each completed milestone to `main`.
4. If an external image/manual asset is needed from the user, provide:
   - direct/source page link,
   - exact file to download,
   - exact new filename,
   - exact repository folder,
   - whether to crop/remove background/convert to WebP.
5. Do not guess owner prices or product identities.

At the end:
1. Update `docs/WORK-CHECKLIST.md`.
2. Replace the “Latest completed work” and “Exact next action” sections below.
3. Record the final commit SHA.
4. State any unresolved blockers explicitly.

## Latest completed work

- Latest Peter Rabbit and full Romney’s catalogue work was preserved from earlier GitHub updates.
- Owner evidence from `Blacksheep.zip` was extracted and recorded.
- The 19 supplied Highland Cow product screenshots were audited: 18 distinct products plus one duplicate.
- All 18 distinct supplied Highland Cow product images were mapped to official Lesser & Pavey / Leonardo stock codes.
- Christmas products from the owner screenshots were mapped to product codes and owner prices.
- The Christmas Highland Cow family with Merry Christmas sign/tree was corrected to `LP54679`.
- Existing GitHub Highland Cow image slots `images/157.png`–`images/179.png` were confirmed to be duplicate placeholder blobs rather than real product photos.
- A detailed source map exists at `docs/HIGHLAND-COW-SOURCE-MAP.md`.
- A previous recovery branch exists only as safety/history: `recovery/black-sheep-work-2026-09-23`. It is no longer the primary workflow.

## Important owner pricing already recorded

Examples:
- standard matching single Highland Cow ornaments: £9.50
- Highland Cows With Umbrella: £11.00
- red couple: £13.99
- tartan couple: £13.99
- home-message plaque: £28.99
- Hughie Highland Cows True Love: £15.99
- Highland Cow Trio: £14.95
- set of 6 Highland Cow baubles: £9.90
- Christmas items: see `docs/HIGHLAND-COW-SOURCE-MAP.md`

Do not publish the £26.99 HOME / LOVE / FAMILY price until its exact scope is confirmed.

## Exact next action

Continue directly on `main`.

Priority:
1. Acquire clean genuine Highland Cow product images from official/supplier sources.
2. Use stable descriptive WebP filenames rather than opaque numeric placeholders where practical.
3. Update the relevant `assets/catalog.js` Highland Cow entries with exact product names, SKUs, clean images and only owner-confirmed prices.
4. Add the verified Christmas items.
5. Validate Highland Cow category/search/product-detail behaviour on desktop and mobile.
6. Then continue homepage/shop photography/layout work, including genuine shop/Google 360 imagery where permitted and useful.
7. Update this handoff after each milestone.

If ChatGPT cannot directly retrieve a suitable image binary, ask the user to download/upload it manually using exact link + filename + target path instructions rather than blocking the entire task.
