# Historical asset reference audit — 29 September 2026

Scope: seven `assets/*.b64` gzip/base64 archives, `assets/loader.js`, and two `assets/sprites/core-*.restore.svg` files. This is a read-only inventory; no route or asset was removed.

| Candidate | Current evidence | Decision |
| --- | --- | --- |
| `catalog.b64`, `site.b64`, `style.b64` | Decode successfully but differ from tracked `catalog.js`, `site.js`, `style.css`. `loader.js` fetches and executes these archives, but no tracked HTML, generator or workflow references the loader. | Historical transport, not current source. Retain until external/cached consumers are checked. |
| `router.b64` | Decodes to 41,690 bytes; no `router.js` replacement exists. Its only repository caller is `loader.js`. Current deployed sample pages do not call that loader. | Do not delete on name-based assumptions; trace historical router behaviour and external usage before removal. |
| `site.restore.b64`, `site.restore2.b64`, `style.restore.b64` | No repository caller. `site.restore.b64` fails gzip decode; the other two differ from current direct assets. | Recovery remnants; keep pending a verified retention/removal decision. |
| `sprites/core-1.restore.svg`, `core-2.restore.svg` | Neither matches current `sprites/core.svg`; no tracked HTML/CSS/JS or workflow reference found, including `core.svg`. | No active dependency found; verify deployed/external references before deleting. |

Reference evidence: a search across 181 repository HTML files and tracked JavaScript, CSS, generators and GitHub workflows found no use of `loader.js`, `.b64` or restore SVG paths outside the loader's own archive fetches. Current live homepage, Full range and one static Product page were inspected read-only: their scripts load `commerce-live.js`, direct `catalog.js` and direct `site.js`; styles load direct `style.css`; none loads `loader.js`. The deployed pages are samples, not proof that stale caches, bookmarked direct asset URLs or outside integrations have no dependency. The current static source and Pages workflow are not a reason to assume an external caller is absent.

Next cleanup gate: determine whether historical router behaviour is represented by current routes, review deployed request/reference evidence for the candidate paths and any retained old HTML, then remove only proven-unused files in one coherent commit. Preserve canonical Product/collection URLs. No production business data or Worker deployment is needed for this audit.
