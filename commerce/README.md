# Black Sheep Commerce API

Cloudflare Worker backend for The Black Sheep Shop Commerce V1.

## Current scope

Phase 1 only:

- TypeScript Worker
- `GET /health`
- structured JSON errors
- strict CORS allowlist
- staging + production Wrangler environments
- Worker Previews configuration
- unit tests
- dry-run validation

There is deliberately no D1, Turnstile, order endpoint, email or payment logic yet. Those are added milestone-by-milestone after the corresponding Cloudflare resources exist.

## Local validation

```sh
npm install
npm run check
```

## Local development

```sh
npm run dev
```

## Cloudflare Workers Builds — staging

When connecting the repository in the Cloudflare dashboard:

- Root directory: `/commerce`
- Build command: `npm run check`
- Deploy command: `npx wrangler deploy --env staging`
- Preview command: `npx wrangler preview --env staging`
- Preview builds: enabled
- Cloudflare Access: disabled for the public API

The staging environment publishes as the Wrangler staging Worker and can use `workers.dev` until a custom hostname is configured.

## Production

Production deployment remains intentionally inactive during Phase 1 setup. The top-level Wrangler configuration is reserved for production. Do not attach the live API hostname or production D1 database until the staging API, D1 migrations, Turnstile validation and order tests are complete.

## Secrets

Never commit:

- Cloudflare API tokens
- Turnstile secret keys
- email-provider secrets
- payment-provider secrets

See `../docs/CLOUDFLARE-COMMERCE-SETUP.md`.
