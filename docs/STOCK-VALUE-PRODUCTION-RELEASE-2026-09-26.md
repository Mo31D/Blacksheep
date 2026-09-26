# Black Sheep — Stock Value Production Release

Date: 26 September 2026  
Repository: `Mo31D/Blacksheep`  
Branch: `main`

## Owner request

This release delivered two linked changes:

1. fix the mobile Add Product sheet so the sticky **Cancel / Create draft** bar does not prevent the owner reaching the final form/category controls;
2. add a production Stock Value / inventory valuation workspace with cost, VAT, supplier and historical-value support.

## Cost policy

- `product_variants.cost_minor` is the **actual unit cost ex VAT** when the owner knows it.
- Product VAT defaults to **20%**, stored per variant and editable.
- If actual cost is missing but a retail price exists, valuation uses the clearly-labelled fallback:
  - estimated cost inc VAT = retail inc VAT / 2;
  - estimated cost ex VAT = estimated cost inc VAT / (1 + VAT rate).
- At the default VAT rate, a £10.00 retail item estimates to £5.00 cost inc VAT / £4.17 cost ex VAT.
- Missing retail + missing actual cost is never guessed; it is reported as missing valuation data.
- Potential gross profit is retail ex VAT minus cost ex VAT. It is **not net profit** and does not deduct rent, wages, card fees, utilities or other overheads.

## Product Admin

Add Product now includes an optional **Cost & supplier** section:

- Item cost ex VAT;
- VAT rate;
- Supplier;
- Supplier product code;
- live fallback estimate copy.

Product detail now includes a **Cost & supplier** card and an **Edit cost** action. Supplier names are normalised into supplier records and reused through the supplier picker.

## Stock Value workspace

Stock now has a **£ Stock value** button opening a separate Admin view.

The report includes:

- physical stock at cost inc VAT;
- retail value inc VAT;
- potential gross profit ex VAT;
- on-hand / sellable / reserved units;
- stock-tracking coverage;
- valuation coverage;
- actual-cost coverage;
- actual / estimated / missing-cost counts;
- value by supplier;
- value by primary category;
- high-value stock;
- low-stock / out-of-stock / untracked / missing-data attention items;
- 7 / 30 / 90 / 365-day cost-vs-retail history.

Daily history is persisted in `inventory_valuation_snapshots`. The existing 30-minute Worker cron performs an idempotent upsert for the current day, so the graph builds automatically without changing inventory quantities. Opening/refreshing Stock Value also refreshes today's snapshot.

## Schema

Migration `0015_stock_valuation.sql` adds:

- `suppliers`;
- `product_variants.supplier_id`;
- `product_variants.supplier_product_code`;
- `product_variants.vat_rate_basis_points`;
- `inventory_valuation_snapshots`;
- supporting indexes.

Production also received previously staging-validated migration `0014_category_management.sql` because Production was still on `0013` before this release.

## Verification evidence

### Staging

- migration `0015_stock_valuation.sql`: applied successfully.
- Staging deploy `36253829542`: **SUCCESS**.
- Full pre-deploy validation: **36 test files / 210 tests PASS**.
- staging migration ledger after deploy: **no migrations pending**.
- Staging Worker version: `88f9833d-b1bb-4609-b0a5-43505aabb074`.
- health: **PASS**.
- post-deploy Admin browser QA `36253997892`: **SUCCESS**.
- browser QA explicitly covered:
  - iPhone Add Product cost/supplier fields;
  - iPhone sticky-footer clearance;
  - iPhone Stock Value report;
  - iPad portrait Products / Stock / Reports;
  - no supported horizontal overflow.

### Production

Guarded Production deploy `36254188859`: **SUCCESS**.

The deployment:

- ran full `npm run check`: **36 test files / 210 tests PASS**;
- found Production pending `0014_category_management.sql` + `0015_stock_valuation.sql`;
- applied both successfully;
- verified **no migrations pending** afterward;
- verified valuation schema and indexes against Production D1;
- deployed Worker version `1b8948d2-228c-4ec6-8803-8b45191930a2`;
- verified Production health, bound D1 and D1 commerce authority;
- verified the public catalogue still responds.

Live Production mobile Admin smoke `36254525389`: **SUCCESS**.

It verified without creating/editing a Product, submitting an order, or changing inventory quantities:

- Cost / VAT / Supplier / Supplier code fields are live in Add Product;
- final category controls can be scrolled clear of the sticky action bar;
- Stock Value page renders on Production;
- Stock Value API responds;
- mobile page has no horizontal overflow;
- temporary QA Admin session was removed after the run.

Production report state at smoke time:

- 146 non-archived active/default variants included by valuation;
- 146 tracked variants;
- 1,460 recorded on-hand units;
- 132 variants can currently be valued from the fallback estimate;
- 14 tracked variants have missing valuation data;
- 0 variants currently have an actual supplier cost entered;
- stock tracking coverage: 100%;
- valuation coverage: 90.4%;
- actual-cost coverage: 0%.

These figures prove the report is operational; they should **not** be treated as an audited physical stock valuation until the owner has confirmed the on-hand quantities and entered real supplier costs. As actual costs are entered, the report automatically replaces estimates with actual cost data.

## Production status

**LIVE AND VERIFIED.**

Current Production D1 migration: `0015_stock_valuation.sql`.  
Current Production Worker: `1b8948d2-228c-4ec6-8803-8b45191930a2`.
