# Admin productization audit

## Owner storefront-structure clarification — 30 September 2026

Implementation `49e7480` retained stable-node Section level from `9bb2d7e`, extended it to a guarded three-level tree, and added forward migration `0029` after applied `0028`. Admin tree/Product picker display third-level sections. Migration clones published versions and aligns hierarchy fields on any draft while preserving its other content, stable node IDs, Product placements, inventory, slugs and legacy paths. Local SQLite FK/draft/placement checks, TypeScript and 81 files / 582 tests passed. [Commerce CI 36715995115](https://github.com/Mo31D/Blacksheep/actions/runs/36715995115), [CI 36718457955](https://github.com/Mo31D/Blacksheep/actions/runs/36718457955), initial guarded Staging 36716553693 and final [Staging acceptance 36720391093](https://github.com/Mo31D/Blacksheep/actions/runs/36720391093) succeeded. Live Admin showed six roots and the Romney's/Hawkshead children; Local Treats clean page rendered 70 Products. The four-link hardcoded server header was fixed by `ffe796d`; acceptance verified six raw HTML links, third-level breadcrumb, sitemap and legacy redirect. Production Worker/data unchanged.

The final owner-facing navigation target is **six main sections only**: **Local Treats**, **Lake District Souvenirs**, **Peter Rabbit Gifts**, **Highland Cows Ornaments**, **Ice cream**, and **Christmas**.

The important productization requirement is broader than the first Section-level UI patch:

- the owner must be able to re-parent an existing canonical Website section without manually reassigning Products;
- the Storefront node's stable identity must remain the Product-placement anchor;
- moving a section must also be safe when that section already owns child sections;
- the hierarchy therefore needs **at least three levels** for the intended Local Treats design.

Required example:

```text
Local Treats
├── Romney's
│   ├── Mint Cake
│   ├── Fudge
│   ├── Biscuits
│   └── ...
└── Hawkshead Relish
    ├── Chutneys & Pickles
    ├── Jams & Preserves
    ├── Honey
    └── ...
```

Commit `9bb2d7e` was the **first implementation of this UX principle**. It allowed leaf-node re-parenting and preserved Product placements, but hid parent choices for nodes with children and capped depth at two levels. The three-level follow-up now allows Romney's parent to be edited while its children stay attached.

The implemented interaction moved existing Romney's and Hawkshead Relish nodes beneath Local Treats while retaining their children and Product placements. Cycle/self-parent protection, ordering, versioning, audit history and publish behavior remain guarded.

The earlier staging migration 0028 that promoted Peter Rabbit is valid interim history but only one piece of the final hierarchy. It must be superseded by forward changes, never rewritten after application. See `docs/ADMIN-V2-CHECKLIST.md` and `docs/SESSION-HANDOFF.md` for the exact six-root target and Codex review gate.


Initial owner-job review: 30 September 2026, against remote `main` through `53bf362` and deployed staging Admin #50. Scope is the existing Worker Admin only. Closed backend/domain phases remain closed. Status below is an implementation queue, not a claim that the final UX already exists.

| Current UX | Why it slows a first-time owner | Canonical responsibility and proposed experience | Priority | Status |
| --- | --- | --- | --- | --- |
| Sidebar promoted Homepage, Themes & appearance and Media Library while Website tabs repeated Homepage, Appearance and Media. Sections & brands sat apart from Website. | The same task had two apparent homes and implementation areas looked like separate products. | Website is one primary destination with subordinate Homepage, Sections & collections, Appearance & themes, Image Library. Sections keeps its existing deep link as a Website child page with a return control; existing `#catalogue`, `#appearance` and `#media` links still resolve. | High | Slice A complete: `b43c23e` deployed to staging #51; desktop review passed; generated Admin passed 390px/320px Chromium/WebKit CI 36684237786. Physical phone check remains in Slice F. |
| Dashboard was called Home in compact navigation while Homepage meant editing the public site. | “Home” could mean shop overview or public Homepage. | Admin landing view and mobile label are Overview; Homepage is reserved for website editing. | High | Slice A complete: desktop staging and generated 390px/320px mobile navigation passed. |
| Homepage editor shows a product strip and module toggles, but pins Hero, Product strip and Shop by collection and only moves two modules. | Owner cannot compose the page despite visible reorder controls. | Homepage owns ordered, enabled modules with accessible ↑ ↓ and versioned draft/Preview/Publish. Retain genuine design constraints only when explained. | High | Slice B.1 deployed #52: all five controls and unsaved reorder work; browser QA #59 passed. Live publish/restore and phone acceptance open |
| Shop by collection and Local favourites card content was largely fixed in static content. | Replacing destinations such as Romney's, Ice Cream or Hawkshead Relish required code. | Homepage owns card selection/order referring to canonical Website sections/pages; it does not copy collection or Product truth. Show current card image/title beside controls. | High | Slice B.2 complete: `0026`/Admin/storefront controls and `0027` null-only image backfill; Commerce CI 36690358702 and staging deploy 36691299996 passed. Read-only staging Admin on 30 September showed all three local images loaded with natural widths 1400/1400/1600px. Existing draft was not saved/published. |
| Homepage and Appearance Publish saved a draft before asking for confirmation; Preview also saved while its button simply said “Preview”. | Cancelling Publish still changed the private draft, and Preview's write was surprising. | Confirm before any draft write and label the Preview action “Save & preview”; preserve the existing versioned draft/publish APIs. | High | Slice B.3 complete in `6e1cb72`: Commerce CI 36722610891, Staging deploy 36727016636 and read-only Admin recheck passed. Owner independently deployed it to Production in run 36727844601. |
| Appearance hero asks for `/all-products.html`; Section image overrides previously sat far below theme colours. | The remaining path requires technical knowledge. | Show a named destination picker with Advanced custom link; put current content and image beside each contextual Website control. | High | Section override removed in B.4; named destination picker remains Slice D. |
| Website Structure and Appearance both edited Section images. Production has different published Local Treats URLs in the two domains; Lake District Souvenirs has only an Appearance image. Homepage omits Lake District's `<img>` while the Local Treats collection displays the Section image. | Two published owners and an Appearance DOM override cause inconsistent cards and collection pages; the override cannot add a missing `<img>` to a card. | Published Storefront node `image_url` owns Section images. Move Appearance-only values forward into node versions without replacing an existing Section image; remove Appearance's Section editor/override and keep Shared Media/history protection. | Critical | Slice B.4 code/staging complete: `2200d23`, `a764e80`, Commerce CI 36756838519 and Staging deploy 36758195802 passed; migration `0030` applied on Staging. Production remains at `0029` with live conflict until explicitly approved promotion. |
| Media Library is a top-level editing destination, upload has “Use” choices, and cards can say “0 tracked uses” despite a contextual title. | Classification looks like placement; zero use conflicts with metadata and is hard to trust. | Direct Upload/Replace, Choose existing and Remove beside content; Image Library is for browse/reuse, real usage, archive/restore and duplicate decisions. Infer context on direct upload. | High | Slice A gave it a Website child home; Slice C.2 deployed #53 and verified optional classification/disclosure. Usage and duplicate handling open; current `usageCount` combines active references with historical Product/Section/Appearance versions, so it is not a count of current places |
| Product images have a separate Manage images sheet; other editing surfaces use different layouts. | Owner must learn several image and save patterns. | Preserve one Shared Media backend and Product media lifecycle; make direct controls visually consistent, with immediate preview and clear draft/publication feedback. | Medium | Slice C.3 adds direct Upload/Choose/Remove to Website Structure's Section editor; Product and remaining patterns are open. Commerce CI 36760331772 and Staging deploy 36760821122 passed. |
| Existing draft/published statuses, long forms, mobile tabs, sheets and feedback vary by area. | The owner must remember whether an action saved, previewed or published and may lose context on a phone. | Shared Admin tokens/primitives, clear action hierarchy, contextual empty/error states and mobile preview-first layout. Add only capabilities backed by existing version/history owners. | Medium | Slices D–F open |
| A Black Sheep illustration/logo appears with an unwanted black rectangle in some contexts. | Poor polish and uncertain asset provenance. | The tracked `assets/sheep-icon.png`, `logo-primary.png` and `logo-compact.png` are opaque indexed PNGs (colour type 3, no `tRNS` transparency chunk); visual inspection shows a black rectangle in the artwork file itself. `commerce/src/http/image-upload.ts` validates bytes, and `commerce/src/data/media-upload.ts` writes those bytes unchanged to R2. The simpler transparent `sheep-icon.svg` is different artwork and must not replace the detailed illustration. Obtain a true transparent export of the original detailed illustration/wordmark, then check it on light/dark backgrounds and in upload/preview/storefront. | Medium | Root cause verified; original transparent artwork replacement required |

## Intended information architecture

| Primary owner job | Home | Subsections / contextual shortcuts |
| --- | --- | --- |
| See what needs attention | Overview | Order, stock and catalogue summaries link to their owners. |
| Process orders and reservations | Orders | Existing review, payment, communication and fulfilment actions. |
| Manage items for sale | Products | Full edit is canonical; quick edit is a contextual action on the same Product. |
| Count and adjust stock | Stock | Inventory adjustments, Stocktake and valuation remain one ledger-backed workflow. |
| Edit the public site | Website | Homepage; Sections & collections; Appearance & themes; Image Library. |
| Understand performance | Reports | Read-only business/operational projections; links lead to owning workflows. |

No new Admin application, generic CMS or second media/product source is proposed. Phase 7 staging gates and production approval are separate from this UX implementation.
