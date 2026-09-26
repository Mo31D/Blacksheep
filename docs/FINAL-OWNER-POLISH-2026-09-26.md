# Black Sheep Admin — Final Owner Polish Completion Report

Date: 26 September 2026  
Repository: `Mo31D/Blacksheep`  
Branch: `main`

## Outcome

The Final Owner Polish implementation is complete at code, staging and Production deployment level.

The remaining acceptance is intentionally manual: one owner real-device Production smoke using the live Admin/storefront and real notification path.

## Clean order start

The owner confirmed that there were no genuine customer orders before this reset and that all existing orders were coding/testing activity.

Migration `0013_order_data_class.sql` adds:

- `BUSINESS`
- `TEST`
- `E2E`

as explicit order data classes, plus `admin_hidden_at`.

The migration preserves existing order history rather than deleting it.

### Production cutover result

Guarded Production workflow: `36245568191` — SUCCESS.

Before migration, a read-only safety preflight found:

- 6 pre-existing orders
- 0 ACTIVE/COMMITTED reservations
- Production health OK

The guarded deploy verified that the order snapshot had not changed before applying the migration.

After migration:

- total historical orders: 6
- visible BUSINESS orders: 0
- hidden TEST orders: 6
- active/committed reservations: 0

Future Production customer submissions default to `BUSINESS`.

Staging customer submissions default to `TEST`; synthetic QA seeds use `E2E`.

The Staging Admin exposes a guarded Test data view and Reset test orders control. The reset clears TEST/E2E orders from normal owner-facing state while preserving their audit history. Production does not expose this reset control.

## Admin owner-facing polish

Completed:

- removed Phase/cutover/Product Core/D1 implementation copy from normal owner workflows
- added a small STAGING environment indicator only where appropriate
- Dashboard mobile KPI layout changed to balanced 2×2
- Orders KPI layout changed to balanced 2×2
- Orders Refresh compacted
- horizontal filter discoverability improved
- bottom navigation converted from generic symbols to a consistent inline SVG icon system
- Product prices no longer visually compete with interactive product titles
- repetitive untracked Product badges de-emphasized
- Add Product uses controlled Product type selection
- Add Product categories are searchable and visually grouped
- Product editor sticky footer/safe-area overlap corrected
- Stock terminology changed to owner-facing language
- Stock KPIs prioritize Tracked / Low stock / Out of stock / Incoming
- Stocktake result states changed to Updated / No change / Needs review
- Stocktake conflicts can be reviewed/recounted without repeating the full count
- Reports now use BUSINESS-only data by default
- payment/status report naming clarified
- active email delivery exceptions are distinguished from historical events
- report exception rows and What to act on entries link back to the order

## Regression evidence

### Code-level

Final owner-polish code Commerce CI:

- workflow `36245167048` — SUCCESS

This includes the existing Product, Inventory, Reservation, Orders, Reports, migration-upgrade, TypeScript, cart/legal and Worker dry-run gates.

Business-only reports received a dedicated regression guard.

### Staging

Final staging deploy:

- workflow `36245227443` — SUCCESS
- staging Worker version: `30cac36f-516f-4902-b733-60c4eb7b6ec5`
- migration `0013_order_data_class.sql`: applied
- health: PASS

Final expanded Admin browser QA:

- workflow `36245380428` — SUCCESS

Verified:

- authenticated Admin Orders
- desktop order list/detail and no horizontal overflow
- order review controls
- WebKit mobile order list/detail
- mobile controls not clipped
- iPhone Dashboard 2×2 KPI layout
- iPhone Products/Add Product controlled Product type
- category search
- iPhone Stocktake no horizontal overflow
- Reports owner-facing wording
- iPad portrait Products / Stock / Reports
- owner-facing development copy removed
- synthetic QA data cleaned after the test

### Production

Guarded Production deploy:

- workflow `36245568191` — SUCCESS
- Production Worker version: `4b600893-2a71-40e0-8fea-9d7f4cad34dd`
- latest migration: `0013_order_data_class.sql`
- Production health: PASS
- public catalogue: 146 products
- visible BUSINESS orders immediately after clean start: 0
- hidden TEST history: 6
- active/committed reservations: 0

The temporary Production preflight/deploy workflows were removed after successful execution.

Search Readiness on the cleaned tree:

- workflow `36245693923` — SUCCESS

## Remaining owner acceptance

Only the real-device/live-operation smoke remains:

1. Open the live Production Admin on the owner's normal phone/iPad.
2. Open Products and Stock.
3. Submit one ordinary live customer order from the Production storefront.
4. Confirm it appears under normal Business Orders.
5. Confirm the customer acknowledgement email arrives.
6. Confirm the owner new-order email arrives.
7. Confirm an untracked baseline product creates no unexpected numeric stock/reservation movement.
8. Confirm the live layout remains comfortable on the owner's device.

Do not create another test-data reset or re-run migration `0013` for this smoke. The next genuine Production order should remain BUSINESS data.
