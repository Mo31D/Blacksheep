# Black Sheep Commerce — Target Architecture

Updated: 24 September 2026  
Repository: `Mo31D/Blacksheep`  
Production source of truth: GitHub `main`

## Goal

Build the current website as the first version of a real ecommerce platform, not as an email-form workaround.

The storefront stays fast and mostly static. A small real backend creates and stores orders. For the first release, stock confirmation, delivery pricing and payment remain owner-assisted. Later, those manual steps can be replaced by live inventory, shipping calculation and an integrated payment gateway without rebuilding the basket or checkout.

## Customer flow — Commerce V1

```text
Product page
  -> Add to basket
  -> Basket
  -> Delivery or collection
  -> Checkout details
  -> Review
  -> Submit order request
  -> Backend validates products/prices
  -> Real order is created in D1
  -> Customer receives request reference
  -> Owner reviews order
  -> Owner confirms availability + delivery cost
  -> Customer receives final total + secure payment request
  -> Payment confirmed
  -> Preparing
  -> Shipped / ready for collection
  -> Completed
```

The customer must always understand that submitting the first request does not take payment and does not mean the order is finally accepted until availability and the final total are confirmed.

## Core architecture

### 1. Existing static storefront

Keep:

- canonical `/products/<slug>.html` product pages
- existing SEO/schema/sitemap architecture
- `assets/catalog.js` as the current catalogue source of truth
- static collection pages
- GitHub Pages for the public frontend during Commerce V1

Add:

- a proper cart engine
- mini basket
- `/basket.html`
- `/checkout.html`
- order-review state
- order confirmation/request-received view

### 2. Commerce API

Cloudflare Worker:

- project name: `black-sheep-commerce-api`
- production target: `api.theblacksheepshop.co.uk` once the domain is an active Cloudflare zone
- staging can use a `workers.dev` hostname until the custom domain is ready

Initial public endpoints:

- `GET /health`
- `POST /v1/orders`

Later endpoints can include:

- customer order-status endpoint using a signed/non-guessable token
- payment webhooks
- shipping quotes
- inventory checks

Admin endpoints are not public and must be protected by Cloudflare Access.

### 3. Database

Cloudflare D1.

Tables planned for V1:

#### orders

- internal order ID
- public reference
- idempotency key
- status
- currency
- fulfilment method
- customer name
- customer email
- customer phone
- delivery address fields when applicable
- customer note
- server-calculated items subtotal
- delivery amount, nullable until quoted
- final total, nullable until quoted
- payment method/status/reference fields
- timestamps

#### order_items

Immutable order snapshot:

- order ID
- catalogue product ID
- SKU
- slug
- product name snapshot
- unit price snapshot
- quantity
- line total
- relevant product option snapshot when options are introduced

#### order_events

Append-only operational history:

- order ID
- event type
- previous/new status when relevant
- actor
- note
- timestamp

This allows future admin/audit behaviour without redesigning the core order model.

## Server authority rule

The browser is never authoritative for:

- product price
- product identity
- availability
- totals

The client submits only the requested catalogue IDs/options/quantities plus customer/fulfilment data.

The Worker re-resolves every item against a server-side catalogue snapshot generated from the same source as `assets/catalog.js`, validates whether it is purchasable, and calculates all monetary values itself.

The submitted browser subtotal may be included for diagnostics but must never be trusted.

## Server-side catalogue strategy — V1

Do not introduce a second manually-maintained product database yet.

Build step:

`assets/catalog.js -> generated commerce catalogue snapshot -> Worker bundle`

Only the commerce fields required by the backend are exported:

- product ID
- SKU
- slug
- name
- price
- purchasability/status
- relevant option metadata

Later, when inventory/admin product management becomes necessary, the product source can move to the backend/database behind the same API contract.

## Cart architecture

UI must not know where cart persistence lives.

Interface:

- `getCart()`
- `addItem()`
- `setQuantity()`
- `removeItem()`
- `clearCart()`
- `getCartSummary()`

Commerce V1:

- `LocalCartStore` backed by localStorage

Future:

- `RemoteCartStore` backed by authenticated/session API

Migrate existing `black-sheep-previsit-list-v1` data once into the new cart so existing users do not silently lose saved items.

## Product eligibility

### Purchasable

- current product
- valid server price
- allowed order status

### Arriving soon

Not part of the normal checkout flow. May later support a notification/enquiry action.

### Out of stock

Cannot be ordered through normal checkout.

### No confirmed price

Cannot enter normal checkout. Use an enquiry treatment if required.

The server rechecks these rules at submission time even if the frontend already checked them.

## Order lifecycle

Initial state machine:

```text
DRAFT             client only
SUBMITTED          stored successfully
UNDER_REVIEW       owner checking stock/delivery
QUOTED             final amount calculated
AWAITING_PAYMENT   secure payment request sent
PAID               payment confirmed
PREPARING
SHIPPED
COMPLETED
CANCELLED
```

For collection, `READY_FOR_COLLECTION` may replace `SHIPPED`.

Every backend transition must be validated; arbitrary state jumps should not be accepted.

## Duplicate-submission protection

Every checkout submission gets an idempotency key.

The Worker must:

- reject/reuse duplicate submissions safely
- disable repeat order creation from double-clicks/retries
- return the existing order reference for an accepted duplicate request where appropriate

## Abuse/security

Required for V1:

- Cloudflare Turnstile on order submission
- mandatory server-side Turnstile verification
- strict request schema validation
- exact allowed CORS origins
- quantity and payload limits
- no secrets in frontend or repository
- no payment card data stored
- basic rate limiting/abuse controls
- structured backend errors without exposing internals
- privacy-minimised logging

Turnstile tokens are verified only by the Worker. The Turnstile secret never reaches the frontend.

## Owner operations

A real database means email is not the order system.

Build a lightweight private admin surface after the core order API is stable.

Target:

`admin.theblacksheepshop.co.uk`

Protected by Cloudflare Access.

V1 admin capabilities:

- list new/current orders
- open order detail
- view customer/delivery information
- enter/adjust delivery charge
- calculate final total
- change allowed order status
- record/send payment-request details
- mark payment confirmed
- add tracking/reference
- mark shipped/completed/cancelled
- show order event history

Email remains notification/communication, not the database.

## Email architecture

Use a provider adapter rather than embedding a provider directly in business logic.

Capabilities:

- owner notification when order is created
- customer acknowledgment
- quote/payment request message
- paid/shipped notifications later

Cloudflare Email Service can be used when appropriate; arbitrary-recipient outbound sending currently requires Workers Paid. The adapter allows changing provider later without rewriting order logic.

## Payment architecture

Commerce V1:

- no public reusable NatWest link on the storefront
- owner confirms the final total
- owner sends a secure payment request for that order
- payment is recorded/confirmed manually

Future payment integration:

```text
PaymentProvider
  -> Stripe / another gateway / future bank integration
  -> create payment session
  -> webhook
  -> server verifies payment
  -> order status -> PAID
```

The Basket, Checkout and Order model do not change.

## Shipping architecture

V1:

- delivery cost entered by owner after review

Future:

- ShippingProvider adapter
- automatic UK rates
- service selection
- labels/tracking
- webhook/status updates

Again, checkout/order data model remains stable.

## GitHub structure target

```text
/
  assets/
  products/
  docs/

  commerce/
    package.json
    wrangler.jsonc
    src/
      index.ts
      routes/
      domain/
      validation/
      security/
      generated/
      email/
    migrations/
    tests/

  scripts/
    build-commerce-catalog.mjs

  .github/workflows/
    search-readiness.yml
    commerce-ci.yml
    commerce-deploy.yml
```

No production secret is committed.

## Deployment model

### GitHub

- `main` remains production authority.
- Large Commerce work begins on a dedicated `commerce-v1` branch.
- Small validated commits.
- Pull/merge only after storefront and commerce CI pass.
- Worker deployment is automated from GitHub using Cloudflare Wrangler action/CLI.
- Cloudflare account ID and API token are stored as GitHub Actions secrets.

### Environments

At minimum:

- local development
- staging Worker
- production Worker

Production and staging must not share customer/order data.

## Definition of Commerce V1 complete

Commerce V1 is complete only when:

- normal purchasable products can be added to a proper basket
- basket survives page navigation/reload
- legacy My List migrates safely
- image-pending/out-of-stock/unpriced states cannot break basket UI
- delivery and collection paths work
- checkout validation works
- server independently validates all products/prices
- Turnstile is verified server-side
- duplicate submissions do not create duplicate orders
- a real order and item snapshot are stored in D1
- customer receives a real request reference
- owner has a reliable way to see/manage the order
- no email is the sole copy of an order
- current static SEO/product architecture remains valid
- existing search-readiness checks remain green
- future payment/shipping integrations can plug into defined provider interfaces
