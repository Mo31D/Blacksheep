# Admin information architecture audit

29 September 2026 · Phase 5A, slice 1. Source: `commerce/src/admin/ui.ts`, `commerce/src/admin/shared-media.ts`, and the existing Admin route/browser tests. This maps the **current** control panel, not a proposed second application.

| Home | Business object and actions | Existing view / owner | Relationship |
| --- | --- | --- | --- |
| Dashboard | Attention queue and revenue overview | `#dashboard`; order/report reads | Read-only summary; Orders owns order actions. |
| Orders & reservations | Order review, quote, payment, fulfilment, revisions, refunds, customer messages and reservation state | `#orders`; order APIs/services | One operational home. `?order=` remains a direct link to a specific order. |
| Products | Create, full draft edit, live quick edit, publish/archive, price/codes, media references and website placement | `#products`; Product APIs/services | Quick edit and full edit are distinct actions on the same Product record. Stock and cost actions link to their operational editors instead of adding another Product copy. |
| Inventory & stocktake | Counts, adjustments, thresholds, stocktake and stock history | `#stock`; inventory/stocktake APIs/services | Product's stock shortcut opens this same editor. `#stock-value` remains the stock valuation subview. |
| Sections & brands | Website section tree, sub-sections, publish/archive; brand/range labels | `#catalogue`; structure/category APIs | Two tabs, two distinct objects. Product placement points to the same structure; Product maker is a separate field. |
| Homepage | Product strip, section order, draft/preview/publish | `#website`; homepage merchandising API | Existing Website workspace, Homepage tab. |
| Themes & appearance | Theme preset, approved colours, hero and section imagery, draft/preview/publish/history | `#appearance`; Appearance API | Existing Website workspace, Appearance tab. No duplicate theme configuration. |
| Media Library | Upload, reuse, edit details, archive/restore/delete; Product/Hero/Section picker | `#media`; shared Media API/R2 | Existing Website workspace, Media tab and shared picker. Product and Appearance store only references. |
| Reports | Sales, customers, refunds, ageing, email delivery and stock value shortcut | `#reports`, `#stock-value`; report APIs | Read-only insights; stock valuation stays linked from Inventory. |

Before this slice, seven ungrouped desktop/mobile buttons mixed business objects with a generic “Website” utility. Media and Appearance were reachable only after discovering Website tabs. The Product page also links to Catalogue, Stock and Media, which can look like duplicate editing until their owners are explained. The Product quick editor changes live operational fields; its full editor saves draft content. They must stay on the same Product service. `shared-media.ts` shows the picker writes an Appearance draft reference or calls Product media attachment, not a second image store.

This slice groups desktop navigation by Overview, Operations, Storefront and Insights, names the object being managed, and gives Appearance and Media direct destinations. Existing view IDs, Website tabs, service calls and `#website` links remain. New `#appearance` and `#media` links select the existing tabs, including on reload. Mobile keeps seven broad destinations, with the Website tabs exposing Homepage, Appearance and Media; its visual/navigation treatment belongs to slice 2. Settings is **not** shown as a false destination: there is no general settings object or API today. The authenticated owner identity and Log out remain in the sidebar. A future settings area needs a real business owner before adding a screen.

Validation: generated Admin script compilation and navigation contract tests, TypeScript, full Commerce suite and GitHub checks. No database, route or production state changes.
