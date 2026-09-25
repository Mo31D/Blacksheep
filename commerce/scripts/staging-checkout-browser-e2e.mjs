import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";

const SHOP = "https://theblacksheepshop.co.uk";
const STAGING_API =
  "https://black-sheep-commerce-api-staging.ky6vfb55p9.workers.dev";
const DB = "black-sheep-commerce-staging";
const RUN_ID = String(process.env.GITHUB_RUN_ID || Date.now());

const REPLAY_ORDER_ID = "browser-replay-" + RUN_ID;
const REPLAY_REFERENCE = "E2E-BROWSER-REPLAY-" + RUN_ID;
const REPLAY_KEY = randomUUID();
const NOW = new Date().toISOString();

let replaySeeded = false;
let completed = false;

function assert(value, message) {
  if (!value) throw new Error(message);
}

function sqlQuote(value) {
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function wranglerD1(sql) {
  const result = spawnSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      DB,
      "--remote",
      "--env",
      "staging",
      "--command",
      sql,
      "--json",
    ],
    {
      encoding: "utf8",
      env: process.env,
      maxBuffer: 16 * 1024 * 1024,
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      "Wrangler D1 command failed:\n" +
        String(result.stderr || result.stdout || "").slice(-5000),
    );
  }

  const parsed = JSON.parse(result.stdout.trim());
  const batches = Array.isArray(parsed) ? parsed : [parsed];
  return batches.flatMap((part) => part.results || []);
}

function seedIdempotentReplayOrder() {
  wranglerD1(
    "DELETE FROM orders WHERE id=" +
      sqlQuote(REPLAY_ORDER_ID) +
      " OR public_reference=" +
      sqlQuote(REPLAY_REFERENCE) +
      ";" +
      "INSERT INTO orders (" +
      "id,public_reference,idempotency_key,status,currency,fulfilment_method," +
      "customer_name,customer_email,delivery_address_line1,delivery_town," +
      "delivery_postcode,delivery_country,items_subtotal_minor,created_at,updated_at" +
      ") VALUES (" +
      [
        sqlQuote(REPLAY_ORDER_ID),
        sqlQuote(REPLAY_REFERENCE),
        sqlQuote(REPLAY_KEY),
        "'SUBMITTED'",
        "'GBP'",
        "'delivery'",
        "'Browser Replay E2E'",
        "'orders@theblacksheepshop.co.uk'",
        "'1 Staging Test Street'",
        "'Ambleside'",
        "'LA22 9ZZ'",
        "'GB'",
        "500",
        sqlQuote(NOW),
        sqlQuote(NOW),
      ].join(",") +
      ")",
  );
  replaySeeded = true;
}

function cleanupReplayOrder() {
  if (!replaySeeded) return;
  wranglerD1(
    "DELETE FROM order_events WHERE order_id=" +
      sqlQuote(REPLAY_ORDER_ID) +
      ";" +
      "DELETE FROM order_items WHERE order_id=" +
      sqlQuote(REPLAY_ORDER_ID) +
      ";" +
      "DELETE FROM orders WHERE id=" +
      sqlQuote(REPLAY_ORDER_ID),
  );
}

async function openWithSeededBasket(page) {
  await page.goto(SHOP + "/checkout.html", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  const selected = await page.evaluate(() => {
    let choice = null;

    for (const [type, items] of Object.entries(window.CATALOG || {})) {
      const item = (items || []).find(
        (candidate) =>
          typeof candidate.price === "number" &&
          Number.isFinite(candidate.price) &&
          candidate.availabilityStatus !== "arriving-soon" &&
          candidate.stockStatus !== "out-of-stock" &&
          candidate.placeholder !== true,
      );

      if (item) {
        choice = {
          productId: item.id,
          type,
          slug: item.slug,
          name: item.name,
        };
        break;
      }
    }

    if (!choice) return null;

    localStorage.setItem(
      "black-sheep-cart-v1",
      JSON.stringify({
        version: 1,
        items: [
          {
            productId: choice.productId,
            type: choice.type,
            slug: choice.slug,
            quantity: 1,
          },
        ],
      }),
    );

    localStorage.removeItem("black-sheep-checkout-draft-v1");
    sessionStorage.removeItem("black-sheep-order-idempotency-v1");
    sessionStorage.removeItem("black-sheep-order-result-v1");

    return choice;
  });

  assert(selected, "No purchasable catalogue item was found for browser QA.");

  await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });

  await page.waitForFunction(
    () =>
      document.getElementById("checkoutFlow") &&
      document.getElementById("checkoutFlow").hidden === false,
    null,
    { timeout: 20_000 },
  );

  return selected;
}

async function moveToReview(page) {
  await page.locator('#checkoutForm button[type="submit"]').click();

  await page.waitForFunction(
    () =>
      document.getElementById("checkoutReviewStep") &&
      document.getElementById("checkoutReviewStep").hidden === false,
    null,
    { timeout: 10_000 },
  );
}

async function verifyDeliveryReviewUi(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();

  try {
    const selected = await openWithSeededBasket(page);

    await page
      .locator('input[name="fulfilmentMethod"][value="delivery"]')
      .check();
    await page
      .locator('input[name="customerName"]')
      .fill("Browser Delivery Review Test");
    await page
      .locator('input[name="customerEmail"]')
      .fill("orders@theblacksheepshop.co.uk");
    await page.locator('input[name="customerPhone"]').fill("07700000000");
    await page.locator('input[name="line1"]').fill("1 Staging Test Street");
    await page.locator('input[name="town"]').fill("Ambleside");
    await page.locator('input[name="postcode"]').fill("LA22 9ZZ");

    await moveToReview(page);

    const review = await page.evaluate(() => ({
      fulfilment:
        document.getElementById("checkoutReviewFulfilment")?.textContent || "",
      items: document.getElementById("checkoutReviewItems")?.textContent || "",
      siteKey:
        document.getElementById("checkoutTurnstile")?.dataset.sitekey || "",
      rendered:
        document.getElementById("checkoutTurnstile")?.dataset.rendered || "",
    }));

    assert(
      review.fulfilment.includes("Delivery") &&
        review.fulfilment.includes("1 Staging Test Street") &&
        review.fulfilment.includes("Ambleside") &&
        review.fulfilment.includes("LA22 9ZZ"),
      "Delivery address was not rendered correctly in the checkout review step.",
    );
    assert(
      review.items.includes(selected.name),
      "Selected basket product was not rendered in checkout review.",
    );
    assert(
      review.siteKey === "0x4AAAAAAFCyMDurtExV8uI0",
      "Checkout is not using the expected Turnstile site key.",
    );

    await page.waitForFunction(
      () =>
        document.getElementById("checkoutTurnstile")?.dataset.rendered === "1",
      null,
      { timeout: 15_000 },
    );
  } finally {
    await context.close();
  }
}

async function verifyRealApiIdempotentReplay(browser) {
  seedIdempotentReplayOrder();

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    await page.goto(SHOP + "/checkout.html", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    const result = await page.evaluate(
      async ({ apiBase, key }) => {
        const response = await fetch(apiBase + "/v1/orders", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": key,
          },
          body: JSON.stringify({
            turnstileToken: "not-used-for-idempotent-replay",
          }),
        });

        return {
          status: response.status,
          payload: await response.json(),
        };
      },
      { apiBase: STAGING_API, key: REPLAY_KEY },
    );

    assert(
      result.status === 200,
      "Real staging API idempotent replay did not return HTTP 200.",
    );
    assert(
      result.payload?.idempotentReplay === true,
      "Real staging API response was not marked as idempotent replay.",
    );
    assert(
      result.payload?.order?.reference === REPLAY_REFERENCE,
      "Real staging API idempotent replay returned the wrong order reference.",
    );

    const rows = wranglerD1(
      "SELECT COUNT(*) AS count FROM orders WHERE idempotency_key=" +
        sqlQuote(REPLAY_KEY),
    );

    assert(
      Number(rows[0]?.count || 0) === 1,
      "Idempotent replay produced more than one staging order.",
    );
  } finally {
    await context.close();
  }
}

async function verifyNetworkFailurePreservesBasket(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();

  try {
    await openWithSeededBasket(page);

    await page
      .locator('input[name="fulfilmentMethod"][value="collection"]')
      .check();
    await page
      .locator('input[name="customerName"]')
      .fill("Browser Network Failure Test");
    await page
      .locator('input[name="customerEmail"]')
      .fill("orders@theblacksheepshop.co.uk");

    await moveToReview(page);

    await page.evaluate((apiBase) => {
      window.BLACK_SHEEP_COMMERCE_CONFIG.apiBase = apiBase;

      const root = document.getElementById("checkoutTurnstile");
      let input = root.querySelector(
        'input[name="cf-turnstile-response"]',
      );

      if (!input) {
        input = document.createElement("input");
        input.type = "hidden";
        input.name = "cf-turnstile-response";
        root.appendChild(input);
      }

      // This synthetic token is used only to enable the client button.
      // The request is aborted in the browser before it reaches any server.
      input.value = "synthetic-network-failure-token";
      checkoutTurnstileChanged();
    }, STAGING_API);

    await page.route(STAGING_API + "/v1/orders", (route) => route.abort());

    await page.locator("#checkoutSubmitRequest").click();

    await page.waitForFunction(
      () =>
        document.getElementById("checkoutSubmitError")?.textContent?.includes(
          "basket is safe",
        ),
      null,
      { timeout: 15_000 },
    );

    const state = await page.evaluate(() => {
      const cart = JSON.parse(
        localStorage.getItem("black-sheep-cart-v1") || '{"items":[]}',
      );

      return {
        itemCount: Array.isArray(cart.items) ? cart.items.length : 0,
        idempotency:
          sessionStorage.getItem("black-sheep-order-idempotency-v1"),
        error:
          document.getElementById("checkoutSubmitError")?.textContent || "",
      };
    });

    assert(state.itemCount === 1, "Basket was lost after a network failure.");
    assert(
      Boolean(state.idempotency),
      "Idempotency key was not retained after a network failure.",
    );
    assert(
      state.error.includes("basket is safe"),
      "Network failure did not show the basket-preservation message.",
    );
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true });

try {
  await verifyDeliveryReviewUi(browser);
  await verifyRealApiIdempotentReplay(browser);
  await verifyNetworkFailurePreservesBasket(browser);

  completed = true;

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          "production-static-checkout-page",
          "delivery-review-ui",
          "turnstile-widget-rendered-with-production-site-key",
          "production-origin-to-staging-cors",
          "real-staging-api-idempotent-replay",
          "idempotent-replay-single-order-in-d1",
          "network-failure-preserves-basket",
          "network-failure-preserves-idempotency-key",
        ],
        manualGate:
          "Real Turnstile token issuance is not automated in headless CI and remains a browser/device verification gate.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    "PUBLIC CHECKOUT BROWSER QA FAILED:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
} finally {
  await browser.close();

  try {
    cleanupReplayOrder();
    if (replaySeeded) {
      console.log("Synthetic idempotent-replay staging row cleaned up.");
    }
  } catch (cleanupError) {
    console.error(
      "Cleanup warning:",
      cleanupError instanceof Error ? cleanupError.message : cleanupError,
    );
    if (completed) process.exitCode = 1;
  }
}
