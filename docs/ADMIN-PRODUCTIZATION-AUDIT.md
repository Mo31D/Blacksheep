# Admin productization audit

Initial owner-job review: 30 September 2026, against remote `main` through `53bf362` and deployed staging Admin #50. Scope is the existing Worker Admin only. Closed backend/domain phases remain closed. Status below is an implementation queue, not a claim that the final UX already exists.

| Current UX | Why it slows a first-time owner | Canonical responsibility and proposed experience | Priority | Status |
| --- | --- | --- | --- | --- |
| Sidebar promoted Homepage, Themes & appearance and Media Library while Website tabs repeated Homepage, Appearance and Media. Sections & brands sat apart from Website. | The same task had two apparent homes and implementation areas looked like separate products. | Website is one primary destination with subordinate Homepage, Sections & collections, Appearance & themes, Image Library. Sections keeps its existing deep link as a Website child page with a return control; existing `#catalogue`, `#appearance` and `#media` links still resolve. | High | `b43c23e` deployed to staging #51; desktop route review passed; real phone-width More review open |
| Dashboard was called Home in compact navigation while Homepage meant editing the public site. | “Home” could mean shop overview or public Homepage. | Admin landing view and mobile label are Overview; Homepage is reserved for website editing. | High | `b43c23e` deployed to staging #51; desktop label passed; phone-width review open |
| Homepage editor shows a product strip and module toggles, but pins Hero, Product strip and Shop by collection and only moves two modules. | Owner cannot compose the page despite visible reorder controls. | Homepage owns ordered, enabled modules with accessible ↑ ↓ and versioned draft/Preview/Publish. Retain genuine design constraints only when explained. | High | Slice B.1 source implemented for all five modules; deployed and phone acceptance open |
| Shop by collection and Local favourites card content is largely fixed in static content. | Replacing destinations such as Romney's, Ice Cream or Hawkshead Relish requires code. | Homepage owns card selection/order referring to canonical Website sections/pages; it does not copy collection or Product truth. Show current card image/title beside controls. | High | Slice B open |
| Appearance hero asks for `/all-products.html`; Section image overrides sit far below theme colours. | Paths and scattered context require technical knowledge. | Show a named destination picker with Advanced custom link; put current content and image beside each contextual Website control. | High | Slices B–D open |
| Media Library is a top-level editing destination, upload has “Use” choices, and cards can say “0 tracked uses” despite a contextual title. | Classification looks like placement; zero use conflicts with metadata and is hard to trust. | Direct Upload/Replace, Choose existing and Remove beside content; Image Library is for browse/reuse, real usage, archive/restore and duplicate decisions. Infer context on direct upload. | High | Slice C open |
| Product images have a separate Manage images sheet; other editing surfaces use different layouts. | Owner must learn several image and save patterns. | Preserve one Shared Media backend and Product media lifecycle; make direct controls visually consistent, with immediate preview and clear draft/publication feedback. | Medium | Slice C open |
| Existing draft/published statuses, long forms, mobile tabs, sheets and feedback vary by area. | The owner must remember whether an action saved, previewed or published and may lose context on a phone. | Shared Admin tokens/primitives, clear action hierarchy, contextual empty/error states and mobile preview-first layout. Add only capabilities backed by existing version/history owners. | Medium | Slices D–F open |
| A Black Sheep illustration/logo appears with an unwanted black rectangle in some contexts. | Poor polish and uncertain asset provenance. | Inspect the referenced project asset and transparency through upload/rendering; use an existing transparent canonical original if present, otherwise record precise replacement need. | Medium | Slice C open |

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
