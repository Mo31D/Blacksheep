# Black Sheep Commerce — Manual Cloudflare Setup

Updated: 24 September 2026

This file lists the Cloudflare actions that require owner/account access. Do not put secret values into GitHub files or chat.

## Important rollout rule

Do not change the live domain nameservers/DNS blindly.

The current public site is on GitHub Pages. If `theblacksheepshop.co.uk` is not already an active Cloudflare zone, first copy/audit the current DNS records required by GitHub Pages. Only then move DNS management to Cloudflare.

The Commerce API can use a staging `workers.dev` address while DNS is being prepared.

## Manual setup — minimum required

### 1. Cloudflare account / zone

- [ ] Sign in to the Cloudflare account that should own Black Sheep Commerce.
- [ ] Check whether `theblacksheepshop.co.uk` is already an **Active** Cloudflare zone.
- [ ] If it is not:
  - add the domain to Cloudflare
  - do **not** change nameservers until the existing GitHub Pages DNS records are documented and reproduced
  - preserve the live website and current `CNAME` behaviour

A Worker Custom Domain such as `api.theblacksheepshop.co.uk` requires an active Cloudflare zone.

### 2. Create two D1 databases

Recommended names:

- [ ] `black-sheep-commerce-staging`
- [ ] `black-sheep-commerce-prod`

Do not put real customer orders into staging.

Record privately for each:

- Database ID
- Database name

Location: use a suitable European/Western-Europe location hint for the shop unless there is a separate legal/data-location requirement.

### 3. Create Turnstile widget

Cloudflare Dashboard -> Turnstile -> Add widget.

Recommended:

- name: `Black Sheep Checkout`
- mode: Managed
- production hostnames:
  - `theblacksheepshop.co.uk`
  - `www.theblacksheepshop.co.uk` only if that hostname is actually used

Keep:

- **Site key** — public; safe for frontend configuration
- **Secret key** — private; Worker secret only

Do not commit the secret key.

Server-side Siteverify validation is mandatory; frontend Turnstile alone is not considered protection.

### 4. Cloudflare API token for GitHub deployment

Create a dedicated CI/CD token, not a Global API Key.

Cloudflare currently recommends the Workers edit/custom token flow for Wrangler CI.

Scope it to the Black Sheep Cloudflare account/zone only.

For the initial creation/deployment workflow it needs enough permission to create/deploy the Commerce Worker. After the Worker exists, reduce the token to the minimum practical deployment scope.

If deployment manages the custom domain, the token also needs the appropriate **Zone > Workers Routes > Write** permission for the Black Sheep zone.

Never store this token in repository files.

### 5. Copy the Cloudflare Account ID

Record the account ID for the account containing the Worker/D1 resources.

It will be added to GitHub Actions as:

`CLOUDFLARE_ACCOUNT_ID`

The API token will be added as:

`CLOUDFLARE_API_TOKEN`

These belong in GitHub repository **Actions secrets**, not in code.

## Manual setup — required before admin goes live

### 6. Enable Cloudflare Zero Trust / Access

Needed for the private owner order dashboard.

- [ ] Enable Zero Trust for the account.
- [ ] Later create a self-hosted Access application for:
  - `admin.theblacksheepshop.co.uk`, or
  - a protected admin path/hostname agreed during implementation
- [ ] Add an Allow policy only for the owner/admin identity or explicitly approved users.

Do not expose the admin API merely because the admin page is hidden from navigation.

## Manual setup — email decision

There are two supported architecture choices. Do not lock business logic to either one.

### Option A — Cloudflare Email Service

Good integration with Workers.

For automatic customer emails to arbitrary recipients, Cloudflare currently requires Workers Paid. Email Sending also requires the domain to use Cloudflare DNS.

If selected later:

- [ ] onboard the sending domain under Cloudflare Email Service
- [ ] let Cloudflare add/verify required SPF/DKIM/bounce/DMARC-related DNS records
- [ ] configure the Worker email binding
- [ ] choose a sender such as `orders@theblacksheepshop.co.uk`

### Option B — external transactional email provider

The Worker calls the provider through the `OrderNotifier` adapter.

This can be selected later without changing checkout/order architecture.

Owner notification only can initially use a verified destination while customer transactional email is added in the next milestone.

## Custom domains — later, after staging works

Preferred:

- public API: `api.theblacksheepshop.co.uk`
- owner admin: `admin.theblacksheepshop.co.uk`

Cloudflare can attach a Custom Domain to a Worker and create the associated DNS record/certificate automatically when the zone is active.

Do this only after:

- staging Worker works
- D1 migrations work
- existing site DNS is known safe

## Worker secrets/variables expected

Private Worker secrets:

- `TURNSTILE_SECRET_KEY`
- email-provider secret if/when used
- any future payment webhook/API secrets

Non-secret configuration:

- storefront origin
- environment name
- public Turnstile site key can be supplied to frontend/build configuration
- sender names/addresses where appropriate

Never place payment, Turnstile or Cloudflare API secrets in `assets/*.js`, HTML, GitHub source or D1.

## GitHub manual setup after Cloudflare values exist

GitHub repository -> Settings -> Secrets and variables -> Actions.

Add secrets:

- [ ] `CLOUDFLARE_API_TOKEN`
- [ ] `CLOUDFLARE_ACCOUNT_ID`

Later we will add other production secrets through the Worker/Cloudflare secret mechanism rather than exposing them to the static frontend.

## Information to return to the implementation session

It is safe to provide:

- whether the domain is already on Cloudflare DNS
- Cloudflare account ID if you are comfortable sharing it in the project workflow
- staging D1 database name + ID
- production D1 database name + ID
- Turnstile **site key**

Do **not** paste into chat/repository unless specifically using a secure secret UI:

- Cloudflare API token
- Turnstile secret key
- payment secrets
- email-provider API secrets

## Stop condition

Do not start production DNS cutover merely to unblock coding.

Implementation can begin with:

- staging D1
- staging Worker
- test Turnstile keys / staging widget
- `workers.dev`

The live domain should be touched only when Commerce staging has passed its tests.
