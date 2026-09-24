# Black Sheep Commerce — Legal / Customer Information Basis

Updated: 24 September 2026

Purpose: implementation notes for Phase 13. This is not a substitute for tailored legal advice. The goal is to keep the storefront wording aligned with the current order model and current UK official guidance.

## Current commerce model

- Basket and checkout collect an order request.
- No payment is taken when the request is submitted.
- The shop checks current availability and delivery cost.
- The shop sends the final total and an order-specific payment request.
- The owner confirms payment server-side/admin-side.
- Card data and online-banking credentials are never stored by the Black Sheep Commerce application.

## Official sources reviewed

- GOV.UK — Online and distance selling:
  https://www.gov.uk/online-and-distance-selling-for-businesses
- GOV.UK — Online selling:
  https://www.gov.uk/online-and-distance-selling-for-businesses/online-selling
- GOV.UK — Accepting returns and giving refunds:
  https://www.gov.uk/accepting-returns-and-giving-refunds
- ICO — How to write a privacy notice:
  https://ico.org.uk/for-organisations/advice-for-small-organisations/privacy-notices-and-cookies/how-to-write-a-privacy-notice-and-what-goes-in-it/
- ICO — Cookies and similar technologies:
  https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/
- ICO — Storage/access technologies:
  https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-storage-and-access-technologies/

## Implementation decisions

1. Public checkout links to Privacy, Delivery & returns and Terms before submission.
2. The order request is explicitly not a payment and not automatic acceptance.
3. Contract formation is stated to occur only when the shop confirms supply/final total and asks for payment.
4. Distance cancellation copy uses the 14-day notification period plus the further 14-day return period from current GOV.UK guidance.
5. Common exceptions are described rather than creating blanket “no returns” categories.
6. Faulty/not-as-described rights are explicitly preserved.
7. Browser localStorage is disclosed. Current storefront code contains no Google Analytics, Meta Pixel, Microsoft Clarity or equivalent advertising/analytics tracker.
8. Basket/security storage is treated as necessary to provide the requested shopping/checkout service; no consent banner is added while non-essential tracking remains absent.
9. Privacy retention uses necessity/legal-record criteria rather than inventing a fixed retention period before the owner/accountant confirms the business retention schedule.

## Pre-launch business confirmations still required

- Confirm the legal proprietor/registered business identity to display with “The Black Sheep Shop”.
- Activate and test `orders@theblacksheepshop.co.uk`, or replace it everywhere with the owner’s chosen working customer-service email.
- Re-review wording if the payment flow changes from manual payment requests to an integrated payment gateway.
