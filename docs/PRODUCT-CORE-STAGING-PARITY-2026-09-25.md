# Black Sheep — Product Core Staging Parity Report

**Date:** 25 September 2026  
**Phase:** Product & Inventory Admin — Phase 1 / Product Core Read Only  
**Environment:** Staging only  
**Result:** **PASS — 0 mismatches**  
**Production Product/Inventory migration:** **NOT APPLIED**

---

## 1. Release evidence

- Source commit that triggered the staging release: `cd6c5c2f528ad105115e893c02a0e0c7b7c04b9d`
- Workflow: `Product Core Staging Phase 1`
- Workflow run: `36169256499`
- Job: `108184497969`
- Workflow conclusion: **SUCCESS**
- Frozen source catalogue blob: `b382d8e161f165f7291da34b1cb23bef06c2742d`
- Parity artifact ID: `10879232734`
- Artifact digest: `sha256:838d3daba0c0aa92565f60f22f9d789e1fde686701a35b9aac77a86b60b24f7d`

The workflow ran the full Commerce validation before touching staging, then applied the Product Core migration, imported the frozen catalogue, verified parity, deployed the read-only Admin workspace to staging, and passed health/Admin-shell checks.

---

## 2. Staging database state

Staging D1:
- database ID: `d442b45d-93b6-4535-b76a-4b72e62dc271`
- migrations: `0000–0009`
- Product Core migration: `0009_product_inventory_foundation.sql`

Direct Cloudflare verification after deployment:

| Object / check | Staging value |
|---|---:|
| Products | 146 |
| Default variants | 146 |
| Categories | 22 |
| Media records | 136 |
| Product attributes | 499 |
| Legacy provenance records | 146 |
| Official provenance records | 86 |
| Import audit events | 146 |
| Inventory-tracked variants | 0 |
| Missing numeric price | 14 |
| Missing image/media | 14 |

Selling-state parity:

| State | Count |
|---|---:|
| AUTO | 128 |
| OUT_OF_STOCK | 4 |
| ARRIVING_SOON | 14 |

No stock quantity was invented. All 146 imported variants remain inventory-untracked exactly as designed.

---

## 3. Deterministic import result

Importer output:

- environment: staging
- previous Product Core product count: 0
- imported products: 146
- imported variants: 146
- PRODUCT_IMPORTED audit events: 146
- source catalogue blob matched the frozen Phase 0 baseline.

The importer is guarded:
- it refuses non-staging execution,
- it checks the exact frozen Git blob,
- it validates product count and ID/slug/SKU/barcode uniqueness,
- it refuses destructive re-import when non-import Product Core events are present.

---

## 4. Parity verification result

The parity verifier returned:

```json
{
  "ok": true,
  "environment": "staging",
  "sourceBlob": "b382d8e161f165f7291da34b1cb23bef06c2742d",
  "products": 146,
  "categories": 22,
  "mediaRecords": 136,
  "attributes": 499,
  "legacySourceRecords": 146,
  "officialSourceRecords": 86,
  "outOfStock": 4,
  "arrivingSoon": 14,
  "missingPrice": 14,
  "missingImage": 14,
  "inventoryTracked": 0,
  "mismatches": []
}
```

Parity coverage includes:
- immutable legacy identity mapping,
- slug,
- title / description / brand / type / collection label,
- SKU and barcode,
- exact price in integer minor units,
- explicit selling status,
- Ice Cream online-ordering migration rule,
- category memberships and primary category,
- legacy media paths, order, primary image, alt text and fit,
- structured product attributes,
- provenance record counts,
- source-warning product set,
- inventory-untracked rule.

---

## 5. Read-only Product Admin delivered to staging

Staging Worker:
- worker: `black-sheep-commerce-api-staging`
- deployment: `64c113d8-8ef7-4178-a772-eb25899641a5`
- version: `ca47249a-b70a-46f6-8c13-147ed5a8c174`

The Admin now includes a read-only **Products** workspace on staging with:

- Today / Orders / Products / Reports navigation,
- product metrics,
- product search by title / SKU / barcode / legacy code,
- filters for Out of stock, Arriving, Untracked, Missing image, Missing price and Data warnings,
- A–Z / recently updated / price sorting,
- product thumbnails,
- selling-state badges,
- price,
- SKU / legacy code,
- read-only product detail,
- categories,
- description,
- media gallery,
- structured product information,
- provenance/data-quality warnings,
- explicit **Phase 1 · Read only** state.

API endpoints:
- `GET /admin/api/products`
- `GET /admin/api/products/:productId`

There is deliberately **no Product POST/PATCH write endpoint** in Phase 1.

---

## 6. Automated quality gates

Passed in the staging workflow:

- frozen catalogue validation,
- Commerce catalogue snapshot check,
- cart tests,
- legal/customer-information tests,
- TypeScript typecheck,
- local migrations through 0009,
- upgrade test from 0000–0008 to 0009,
- Vitest suite,
- generated Admin JavaScript compile checks,
- Product Admin read-only route/UI contract tests,
- Wrangler staging dry run,
- staging D1 migration,
- staging deterministic import,
- staging parity verifier,
- staging Worker deploy,
- staging health check,
- staging Admin sign-in shell check.

An intermediate Product Core commit briefly failed TypeScript because escaped backticks were written literally into `products.ts`; the defect was corrected before staging release. The successful staging workflow includes the corrected source.

---

## 7. Production safety verification

Production was deliberately left unchanged by Phase 1.

Direct Cloudflare verification after the staging release:

- Production D1 ID: `c1afdb87-47a8-4f6b-bf4b-0ce9b5b41e52`
- Production migration ledger remains **0000–0008**
- `0009_product_inventory_foundation.sql` is **not applied to Production**
- Production order count remains **3**
- no Product/Inventory Production write path exists,
- storefront and checkout still use the current existing catalogue authority,
- `assets/catalog.js` has not been removed,
- no inventory quantities or reservations are active.

---

## 8. Remaining Phase 1 gate

The technical/data gate is complete.

The only Phase 1 sign-off still intentionally open is **manual visual QA of the newly added authenticated Products workspace** on:
- iPhone Safari,
- desktop.

Automated responsive rules, route contracts and generated-script compilation pass, but those do not replace a real owner visual inspection of the authenticated Product workspace.

Until that sign-off:
- do not enable Product editing,
- do not apply 0009 to Production,
- do not enable numeric stock,
- do not cut checkout/storefront over to D1 Product Core.

---

## 9. Next phase after visual sign-off

**Phase 2 — Product Editing**

Planned first write capabilities:
1. create Draft product,
2. edit product basics,
3. price/SKU/barcode operational edits,
4. categories,
5. selling/publication state,
6. optimistic concurrency,
7. audit before/after values,
8. Quick Edit,
9. full premium editor,
10. completeness warnings.

Media upload and numeric inventory remain separately gated phases after Product Editing.
