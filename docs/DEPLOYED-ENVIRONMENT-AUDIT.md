# Configured versus deployed environment audit

Read-only Cloudflare API inspection, 29 September 2026. Compared `commerce/wrangler.jsonc` with the settings of `black-sheep-commerce-api` and `black-sheep-commerce-api-staging`. Only binding names/types, approved nonsecret policy values, resource identities and deployment timestamps were inspected. No secret values, database rows or R2 objects were read or changed.

| Boundary | Production | Staging | Result |
| --- | --- | --- | --- |
| Worker / latest deployment | `black-sheep-commerce-api`, 27 Sep 2026 15:54 UTC | `black-sheep-commerce-api-staging`, 27 Sep 2026 15:31 UTC | Both predate the 29 Sep source fixes; GitHub main is not deployed Worker code. |
| D1 `DB` | `black-sheep-commerce-prod` (`c1afdb87…`) | `black-sheep-commerce-staging` (`d442b45d…`) | Distinct IDs match committed config; both databases exist. |
| R2 `PRODUCT_MEDIA` | `black-sheep-product-media-prod` | `black-sheep-product-media-staging` | Distinct bucket names match committed config; both exist. |
| Admin base | `https://admin.theblacksheepshop.co.uk` | staging workers.dev `/admin` | Match committed config. Production API/Admin custom domains point to production Worker; staging has workers.dev enabled. |
| Origins / Turnstile | storefront hosts | storefront hosts plus local origins | Exact deployed `ALLOWED_ORIGINS`, Turnstile hostname list and action match committed config. Both have a Turnstile secret binding; its value was not inspected. |
| Catalogue / reservation / clean routes | catalogue and reservations on, clean collection on, clean Product off | catalogue and reservations on, clean collection and Product on | Match committed config. Distinct rate-limit namespace IDs also match. |
| Admin, Resend and webhook secrets | bindings present | bindings present | Presence verified by settings and secret-name list; values, validity and whether staging shares provider credentials cannot be confirmed by the API. |
| Mail sender / owner recipient | sender configured; owner recipient configured | same sender and same owner recipient as production | **Staging mail is not recipient-isolated.** Actual recipient values were compared in memory and not displayed or recorded. |

The deployed `D1_COMMERCE_AUTHORITY_ENABLED=true` plain-text variable remains in both Workers because `keep_vars` retains dashboard variables. Current source does not read this obsolete switch; do not treat it as a current feature gate. Remove it during a deliberate environment cleanup, not as a prerequisite to unrelated code work.

## Confirmed email risk and release action

`ORDER_OWNER_EMAIL` is identical in deployed staging and production. Staging order acknowledgement and Admin/customer messages also target the submitted customer's email. Staging can therefore send real transactional mail. Add a source-level staging recipient guard and tests before the next Worker deployment. A designated safe test mailbox/allowlist must then be configured for staging by an authorized operator; no address should be invented. Until that policy is deployed and verified, do not use real customer addresses for staging email exercises. The Resend secret being present does not prove its validity, or that the provider account is separate.

The deployed Worker builds are from 27 September. Source commits through the email retry fix on 29 September have passed GitHub checks but are **not** live in either Worker. Production promotion and any data/secret changes remain a separate approved release action.
