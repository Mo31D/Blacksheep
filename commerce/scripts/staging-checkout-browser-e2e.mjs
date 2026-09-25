import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SHOP = "https://theblacksheepshop.co.uk";
const STAGING_API =
  "https://black-sheep-commerce-api-staging.ky6vfb55p9.workers.dev";
const DB = "black-sheep-commerce-staging";
const RUN_ID = String(process.env.GITHUB_RUN_ID || Date.now());
const ARTIFACT_DIR = path.resolve("browser-e2e-artifacts");

let createdReference = "";
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

function cleanupReference(reference) {
  if (!reference) return;
  const ref = sqlQuote(reference);
  const orderIds = "(SELECT id FROM orders WHERE public_reference=" + ref + ")";
  const revisionIds =
    "(SELECT id FROM order_revisions WHERE order_id IN " + orderIds + ")";

  wranglerD1(
    [
      "DELETE FROM order_messages WHERE order_id IN " + orderIds,
      "DELETE FROM customer_review_tokens WHERE order_id IN " + orderIds,
      "DELETE FROM refunds WHERE order_id IN " + orderIds,
      "DELETE FROM order_adjustments WHERE revision_id IN " + revisionIds,
      "DELETE FROM order_revision_items WHERE revision_id IN " + revisionIds,
      "DELETE FROM order_revisions WHERE order_id IN " + orderIds,
      "DELETE FROM order_events WHERE order_id IN " + orderIds,
      "DELETE FROM order_items WHERE order_id IN " + orderIds,
      "DELETE FROM orders WHERE public_reference=" + ref,
    ].join(";"),
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

  assert(selected, "No purchasable catalogue item was found for checkout E2E.");

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

async function fillDeliveryCheckout(page) {
  await page.locator('input[name="fulfilmentMethod"][value="delivery"]').check();
  await page.locator('input[name="customerName"]').fill("Browser E2E Staging Test");
  await page
    .locator('input[name="customerEmail"]')
    .fill("orders@theblacksheepshop.co.uk");
  await page.locator('input[name="customerPhone"]').fill("07700000000");
  await page.locator('input[name="line1"]').fill("1 Staging Test Street");
  await page.locator('input[name="town"]').fill("Ambleside");
  await page.locator('input[name="postcode"]').fill("LA22 9ZZ");
  await page
    .locator('textarea[name="note"]')
    .fill("Synthetic browser E2E order — no action required.");
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

async function successfulDeliveryCheckout(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();

  try {
    await openWithSeededBasket(page);
    await fillDeliveryCheckout(page);
    await moveToReview(page);

    await page.evaluate((apiBase) => {
      window.BLACK_SHEEP_COMMERCE_CONFIG.apiBase = apiBase;
    }, STAGING_API);

    await page.waitForFunction(
      () => {
        const token = document.querySelector(
          '#checkoutTurnstile input[name="cf-turnstile-response"]',
        )?.value;
        return Boolean(token && token.length > 20);
      },
      null,
      { timeout: 60_000 },
    );

    await page.waitForFunction(
      () => !document.getElementById("checkoutSubmitRequest")?.disabled,
      null,
      { timeout: 10_000 },
    );

    let captured = null;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url() === STAGING_API + "/v1/orders"
      ) {
        captured = {
          key: request.headers()["idempotency-key"] || "",
          body: request.postData() || "",
        };
      }
    });

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url() === STAGING_API + "/v1/orders" &&
        response.request().method() === "POST",
      { timeout: 60_000 },
    );

    await page.locator("#checkoutSubmitRequest").click();

    const response = await responsePromise;
    const result = await response.json();

    assert(
      response.status() === 201,
      "First browser checkout should create a new staging order with HTTP 201.",
    );
    assert(result?.order?.reference, "Created order response has no reference.");
    assert(
      result?.order?.fulfilmentMethod === "delivery",
      "Browser delivery checkout did not persist delivery fulfilment.",
    );

    createdReference = result.order.reference;

    await page.waitForURL(/order-requested\.html\?ref=/, {
      timeout: 30_000,
    });

    assert(captured?.key, "Browser checkout did not send an idempotency key.");
    assert(captured?.body, "Browser checkout request body was not captured.");

    const duplicate = await page.evaluate(
      async ({ apiBase, key, body }) => {
        const response = await fetch(apiBase + "/v1/orders", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": key,
          },
          body,
        });
        return {
          status: response.status,
          payload: await response.json(),
        };
      },
      {
        apiBase: STAGING_API,
        key: captured.key,
        body: captured.body,
      },
    );

    assert(
      duplicate.status === 200,
      "Idempotent retry should return HTTP 200.",
    );
    assert(
      duplicate.payload?.idempotentReplay === true,
      "Idempotent retry was not marked as a replay.",
    );
    assert(
      duplicate.payload?.order?.reference === createdReference,
      "Idempotent retry returned a different order reference.",
    );

    const dbRows = wranglerD1(
      "SELECT public_reference AS reference,status,fulfilment_method AS fulfilmentMethod,payment_status AS paymentStatus " +
        "FROM orders WHERE public_reference=" +
        sqlQuote(createdReference) +
        " LIMIT 1",
    );

    assert(dbRows.length === 1, "Created browser order is missing from staging D1.");
    assert(
      dbRows[0].fulfilmentMethod === "delivery",
      "Staging D1 did not persist delivery fulfilment.",
    );

    const clientState = await page.evaluate(() => ({
      cart: localStorage.getItem("black-sheep-cart-v1"),
      draft: localStorage.getItem("black-sheep-checkout-draft-v1"),
      idempotency: sessionStorage.getItem("black-sheep-order-idempotency-v1"),
    }));

    const parsedCart = JSON.parse(clientState.cart || '{"items":[]}');
    assert(
      Array.isArray(parsedCart.items) && parsedCart.items.length === 0,
      "Basket was not cleared after successful submission.",
    );
    assert(clientState.draft === null, "Checkout draft was not cleared after success.");
    assert(
      clientState.idempotency === null,
      "Idempotency key was not cleared after successful submission.",
    );

    return {
      reference: createdReference,
      product: result.order.items?.[0]?.name || "selected product",
    };
  } finally {
    await context.close();
  }
}

async function networkFailurePreservesBasket(browser) {
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
        idempotency: sessionStorage.getItem("black-sheep-order-idempotency-v1"),
        error: document.getElementById("checkoutSubmitError")?.textContent || "",
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

fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });

try {
  const success = await successfulDeliveryCheckout(browser);
  await networkFailurePreservesBasket(browser);
  completed = true;

  console.log(
    JSON.stringify(
      {
        ok: true,
        reference: success.reference,
        checks: [
          "production-static-checkout-page",
          "real-turnstile-token",
          "production-origin-to-staging-cors",
          "real-staging-delivery-order",
          "server-side-delivery-persistence",
          "idempotent-retry-same-reference",
          "success-clears-basket-draft-and-idempotency-key",
          "network-failure-preserves-basket",
          "network-failure-preserves-idempotency-key",
        ],
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    "PUBLIC CHECKOUT E2E FAILED:",
    error instanceof Error ? error.message : error,
  );

  try {
    const pages = browser.contexts().flatMap((context) => context.pages());
    if (pages.length) {
      await pages[pages.length - 1].screenshot({
        path: path.join(ARTIFACT_DIR, "failure.png"),
        fullPage: true,
      });
    }
  } catch {}

  process.exitCode = 1;
} finally {
  await browser.close();

  if (createdReference) {
    try {
      cleanupReference(createdReference);
      console.log("Synthetic browser checkout order cleaned from staging D1.");
    } catch (cleanupError) {
      console.error(
        "Cleanup warning:",
        cleanupError instanceof Error ? cleanupError.message : cleanupError,
      );
      if (completed) process.exitCode = 1;
    }
  }
}
