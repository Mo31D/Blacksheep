# Black Sheep — Session Handoff

Updated: 23 September 2026

Latest handoff commit before this note: `abb7d3855662c45216008a5720b5d10af02a2282`

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

- First exact Highland Cow image/product batch prepared: LP73651, LP73652, LP74354, LP74355, LP74358 and LP75455.
- Six user-supplied 800×800 product photos were converted to WebP with stable descriptive filenames and uploaded to `images/highland-cows/` on `main` in commit `432927584c2ff0ea1c34ab9e2e63211b535328c3`.
- Repository QA confirms all six catalogue image references resolve to existing files, with no duplicate IDs, slugs or SKUs in this batch.
- Catalogue/product pages are prepared on `main`: five new exact entries were added and existing HC-003 was upgraded in place to LP75455 Highland Cow Trio.
- Product detail rendering now shows optional Range and Dimensions fields.
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
1. Start the next exact Highland Cow batch using `docs/HIGHLAND-COW-SOURCE-MAP.md`.
2. Prefer products with already confirmed owner prices and supplied imagery.
3. For each product: prepare a clean WebP, add/update the catalogue entry with SKU/price/brand/details, verify image path, then commit.
4. Add the verified Christmas Highland Cow products after the standard range.
5. Validate the full Highland Cow collection for duplicate IDs/slugs/SKUs, broken image paths and prices.
6. Then continue homepage/shop photography/layout work.
7. Update this handoff and `docs/WORK-CHECKLIST.md` after each milestone.

Current limitation: repository QA is complete for the first batch, but the public custom domain could not be reached from the current web checker, so live-page verification remains pending.
