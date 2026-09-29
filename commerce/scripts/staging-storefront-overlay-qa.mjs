import fs from "node:fs";
import path from "node:path";
import { chromium, webkit } from "playwright";

const SITE = "https://theblacksheepshop.co.uk";
const API =
  "https://black-sheep-commerce-api-staging.ky6vfb55p9.workers.dev";
const PRODUCT_ID = "HC-003";
const PRODUCT_SLUG =
  "hc-003-three-highland-cows-see-hear-speak-no-evil-ornament";
const PRODUCT_PATH = "/products/" + PRODUCT_SLUG + ".html";
const CARD_SELECTOR =
  '.product-card[data-url="' + PRODUCT_PATH + '"]';
const ARTIFACT_DIR = path.resolve("storefront-overlay-qa-artifacts");

function assert(value, message) {
  if (!value) throw new Error(message);
}

function money(minor) {
  return "£" + (Number(minor) / 100).toFixed(2);
}

function expectedDetailAvailability(product) {
  if (product.status === "arriving-soon") return "Arriving soon";
  if (
    product.status === "out-of-stock" ||
    product.nonPurchasableReason === "out_of_stock"
  ) {
    return "Out of stock";
  }
  if (
    product.nonPurchasableReason === "online_ordering_disabled" ||
    product.nonPurchasableReason === "not_for_sale"
  ) {
    return "Not available to order online";
  }
  if (
    product.inventory?.tracked === true &&
    Number.isFinite(product.inventory.available)
  ) {
    return product.inventory.available > 0
      ? "Available to order · " + product.inventory.available + " available"
      : "Out of stock";
  }
  return "Available to order";
}

async function getRealCatalogue() {
  const response = await fetch(API + "/v1/catalog?limit=200", {
    headers: { accept: "application/json" },
  });
  assert(response.ok, "Staging public catalogue request failed: " + response.status);
  const payload = await response.json();
  assert(Array.isArray(payload.products), "Staging catalogue payload is invalid");
  assert(payload.products.length > 0, "Staging public catalogue is unexpectedly empty");
  const target = payload.products.find((product) => product.id === PRODUCT_ID);
  assert(target, "HC-003 missing from staging public catalogue");
  return { payload, target };
}

async function getRealHomepageMerchandising() {
  const response = await fetch(API + "/v1/homepage-merchandising", {
    headers: { accept: "application/json" },
  });
  assert(
    response.ok,
    "Staging Homepage merchandising request failed: " + response.status,
  );
  const payload = await response.json();
  assert(
    payload?.contract === "homepage-merchandising-published-v1",
    "Staging Homepage merchandising contract is invalid",
  );
  assert(payload?.config, "Staging Homepage merchandising config is missing");
  assert(
    Array.isArray(payload?.config?.modules) &&
      payload.config.modules.length === 5,
    "Staging Homepage merchandising module contract is invalid",
  );
  assert(
    Array.isArray(payload?.products),
    "Staging Homepage merchandising products are invalid",
  );
  return payload;
}

async function waitForCommerce(page, expected) {
  await page.waitForFunction(
    (state) => document.documentElement.dataset.commerceLive === state,
    expected,
    { timeout: 30_000 },
  );
}

async function assertNoHorizontalOverflow(page, label) {
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert(
    result.scrollWidth <= result.clientWidth + 2,
    label +
      " has horizontal overflow: " +
      result.scrollWidth +
      " > " +
      result.clientWidth,
  );
}

async function assertCanonical(page, expectedPath, label) {
  const canonical = await page
    .locator('link[rel="canonical"]')
    .getAttribute("href");
  assert(
    canonical === SITE + expectedPath,
    label + " canonical drifted: " + canonical,
  );
  assert(!canonical.includes("commerce-preview"), label + " canonical leaked preview query");
}

async function verifyRealOverlay(browserType, label, viewport, expectedProductCount) {
  const browser = await browserType.launch();
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  try {
    await page.goto(
      SITE + "/all-products.html?commerce-preview=staging",
      { waitUntil: "domcontentloaded", timeout: 60_000 },
    );
    await waitForCommerce(page, "ready");

    const state = await page.evaluate(() => ({
      config: window.BLACK_SHEEP_LIVE_COMMERCE,
      live: window.BLACK_SHEEP_LIVE_COMMERCE_STATE,
    }));

    assert(state.config?.preview === true, label + " preview flag is not active");
    assert(state.config?.mode === "staging", label + " preview mode is not staging");
    const received = Number(state.live?.received ?? -1);
    const covered = Number(state.live?.covered ?? -1);
    assert(
      state.live?.authoritative === true && received > 0,
      label + " did not finish an authoritative complete D1 catalogue load",
    );
    assert(
      covered === received,
      label +
        " covered " +
        covered +
        " unique D1 products out of " +
        received +
        " received (initial staging snapshot was " +
        expectedProductCount +
        ")",
    );
    assert(
      Number(state.live?.applied ?? 0) >= covered,
      label +
        " applied fewer catalogue entries than unique D1 products: " +
        state.live?.applied +
        " < " +
        covered,
    );

    const banner = page.locator("#commercePreviewBanner");
    await banner.waitFor({ state: "visible", timeout: 10_000 });
    assert(
      (await banner.textContent()).includes("Live D1 price and availability"),
      label + " preview banner is not in ready state",
    );

    const card = page.locator(CARD_SELECTOR);
    await card.waitFor({ state: "visible", timeout: 15_000 });
    const cardPrice = (await card.locator(".product-price").textContent())?.trim();
    assert(
      cardPrice === money(globalThis.__phase6Target.priceMinor),
      label + " card price does not match D1: " + cardPrice,
    );

    const cardButton = card.locator(".list-add");
    assert(
      (await cardButton.isDisabled()) === !globalThis.__phase6Target.purchasable,
      label + " card orderability does not match D1",
    );

    await assertCanonical(page, "/all-products.html", label + " all-products");
    await assertNoHorizontalOverflow(page, label + " all-products");

    // Preview persists in the same tab without carrying the query string.
    await page.goto(SITE + PRODUCT_PATH, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await waitForCommerce(page, "ready");
    await page.locator("#commercePreviewBanner").waitFor({
      state: "visible",
      timeout: 10_000,
    });

    const detailPrice = await page.evaluate(() => {
      const row = [...document.querySelectorAll(".product-static .info-row")].find(
        (el) => {
          const label = el.querySelector("strong")?.textContent?.trim().toLowerCase();
          return label === "shop price" || label === "price";
        },
      );
      return row?.querySelector("span")?.textContent?.trim() || "";
    });
    assert(
      detailPrice === money(globalThis.__phase6Target.priceMinor),
      label + " Product detail price does not match D1: " + detailPrice,
    );

    const detailAvailability = await page.evaluate(() => {
      const row = [...document.querySelectorAll(".product-static .info-row")].find(
        (el) =>
          el.querySelector("strong")?.textContent?.trim().toLowerCase() ===
          "availability",
      );
      return row?.querySelector("span")?.textContent?.trim() || "";
    });
    const expectedAvailability = expectedDetailAvailability(
      globalThis.__phase6Target,
    );
    assert(
      detailAvailability === expectedAvailability,
      label +
        " live Product availability was not overlaid: " +
        detailAvailability +
        " (expected " +
        expectedAvailability +
        ")",
    );

    await assertCanonical(page, PRODUCT_PATH, label + " Product detail");
    await assertNoHorizontalOverflow(page, label + " Product detail");

    // Persist a real basket line and verify staging preview can never submit.
    await page.evaluate(({ id, slug }) => {
      localStorage.setItem(
        "black-sheep-cart-v1",
        JSON.stringify({
          version: 1,
          items: [
            {
              productId: id,
              type: "gifts",
              slug,
              quantity: 1,
            },
          ],
        }),
      );
    }, { id: PRODUCT_ID, slug: PRODUCT_SLUG });

    await page.goto(SITE + "/checkout.html", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await waitForCommerce(page, "ready");

    await page
      .locator('input[name="fulfilmentMethod"][value="collection"]')
      .check();
    await page.locator('input[name="customerName"]').fill("Phase 6 Preview QA");
    await page
      .locator('input[name="customerEmail"]')
      .fill("phase6-preview@example.com");
    await page.locator('#checkoutForm button[type="submit"]').click();
    await page.locator("#checkoutReviewStep").waitFor({
      state: "visible",
      timeout: 10_000,
    });

    const submit = page.locator("#checkoutSubmitRequest");
    await submit.waitFor({ state: "visible", timeout: 10_000 });
    assert(await submit.isDisabled(), label + " checkout submit is not disabled in preview");

    const submitError = page.locator("#checkoutSubmitError");
    await submitError.waitFor({ state: "visible", timeout: 10_000 });
    assert(
      (await submitError.textContent()).includes(
        "Order submission is disabled in preview mode",
      ),
      label + " checkout preview safety message is missing",
    );

    await assertNoHorizontalOverflow(page, label + " checkout review");

    await page.screenshot({
      path: path.join(
        ARTIFACT_DIR,
        label.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-checkout.png",
      ),
      fullPage: true,
    });
  } finally {
    await context.close();
    await browser.close();
  }
}

async function verifyMockedLiveChanges(realPayload) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();

  const trackedPayload = structuredClone(realPayload);
  const tracked = trackedPayload.products.find((p) => p.id === PRODUCT_ID);
  assert(tracked, "Mock target missing");
  tracked.priceMinor = 1234;
  tracked.status = "available";
  tracked.purchasable = true;
  tracked.nonPurchasableReason = null;
  tracked.inventory = { tracked: true, available: 1 };

  const dynamicImage = "/media/qa-dynamic-storefront-image";
  const dynamicProduct = {
    ...tracked,
    id: "prd-dynamic-storefront-qa",
    productId: "prd-dynamic-storefront-qa",
    slug: "qa-live-dynamic-product",
    name: "QA Live Dynamic Product",
    shortDescription: "Published directly from Product Core for dynamic storefront QA.",
    brand: "Hawkshead Relish Company",
    type: "hawkshead",
    primaryCategory: "hawkshead-relish",
    sku: "QA-LIVE-DYNAMIC",
    priceMinor: 321,
    status: "available",
    purchasable: true,
    nonPurchasableReason: null,
    inventory: { tracked: false, available: null },
    primaryImageUrl: dynamicImage,
    publishedVersionId: "pver-dynamic-storefront-qa",
    publishedVersionNumber: 1,
  };
  const archivedId = "HC-004";
  const archivedPath = "/products/hc-004-highland-cow-in-bath-ornament.html";
  const archivedIndex = trackedPayload.products.findIndex((product) => product.id === archivedId);
  assert(archivedIndex >= 0, "Archived Product test target missing from staging catalogue");
  trackedPayload.products.splice(archivedIndex, 1);
  trackedPayload.products.push(dynamicProduct);

  await page.route(API + "/v1/catalog?limit=200", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(trackedPayload),
    });
  });
  await page.route(API + "/media/qa-dynamic-storefront-image", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="white"/></svg>',
    });
  });

  try {
    await page.goto(
      SITE + "/all-products.html?commerce-preview=staging",
      { waitUntil: "domcontentloaded", timeout: 60_000 },
    );
    await waitForCommerce(page, "ready");

    assert(
      (await page.locator('.product-card[data-url="' + archivedPath + '"]').count()) === 0,
      "Archived D1 Product remained in Full range after authoritative catalogue load",
    );

    const card = page.locator(CARD_SELECTOR);
    await card.waitFor({ state: "visible", timeout: 15_000 });
    assert(
      (await card.locator(".product-price").textContent())?.trim() === "£12.34",
      "Mocked D1 price did not reach the card",
    );
    assert(!(await card.locator(".list-add").isDisabled()), "Tracked Available=1 card was disabled");

    await card.locator(".list-add").click();
    await card.locator(".list-add").click();

    const cartState = await page.evaluate(() => ({
      count: window.BlackSheepCart.count(),
      rows: window.BlackSheepCart.resolvedItems().map((row) => ({
        id: row.productId,
        quantity: row.quantity,
      })),
    }));
    assert(cartState.count === 1, "Second add exceeded live Available=1");
    assert(
      cartState.rows.find((row) => row.id === PRODUCT_ID)?.quantity === 1,
      "Tracked basket quantity exceeded Available",
    );
    await page.locator("#bsListToast").waitFor({ state: "visible", timeout: 5_000 });
    assert(
      (await page.locator("#bsListToast").textContent()).includes(
        "Currently out of stock",
      ),
      "Tracked quantity rejection did not surface a useful message",
    );

    const dynamicUrl =
      "/product.html?type=hawkshead&slug=qa-live-dynamic-product";
    const dynamicAllProducts = page.locator(
      '.product-card[data-url="' + dynamicUrl + '"]',
    );
    await dynamicAllProducts.waitFor({ state: "visible", timeout: 15_000 });
    assert(
      (await dynamicAllProducts.locator(".product-price").textContent())?.trim() ===
        "£3.21",
      "New D1-only product was not rendered in Full range",
    );

    await page.goto(SITE + "/gifts.html", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await waitForCommerce(page, "ready");
    assert(
      (await page.locator('.product-card[data-url="' + archivedPath + '"]').count()) === 0,
      "Archived D1 Product remained in Gifts range after authoritative catalogue load",
    );

    await page.goto(SITE + "/hawkshead-relish.html", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await waitForCommerce(page, "ready");
    const dynamicRangeCard = page.locator(
      '.product-card[data-url="' + dynamicUrl + '"]',
    );
    await dynamicRangeCard.waitFor({ state: "visible", timeout: 15_000 });
    assert(
      (await page.locator("#giftCount").textContent())?.includes("16 products"),
      "Hawkshead range count did not include the D1-only product",
    );
    assert(
      (await dynamicRangeCard.locator("img").getAttribute("src"))?.startsWith(API),
      "D1-only product image URL was not resolved against the commerce API",
    );

    await dynamicRangeCard.locator(".product-title").click();
    await page.waitForURL("**/product.html?type=hawkshead&slug=qa-live-dynamic-product", {
      timeout: 20_000,
    });
    await waitForCommerce(page, "ready");
    await page.locator("#detail h1").waitFor({ state: "visible", timeout: 15_000 });
    assert(
      (await page.locator("#detail h1").textContent())?.trim() ===
        "QA Live Dynamic Product",
      "D1-only Product detail did not render",
    );
    assert(
      (await page.locator("#detail .detail-price").textContent())?.trim() === "£3.21",
      "D1-only Product detail price is wrong",
    );
    assert(
      (await page.locator("#detail img").first().getAttribute("src"))?.startsWith(API),
      "D1-only Product detail image did not use the API media URL",
    );
    assert(
      !(await page.locator("#detail .list-detail-add").isDisabled()),
      "D1-only Product detail Add button is unexpectedly disabled",
    );
    await assertNoHorizontalOverflow(page, "Dynamic D1 Product detail");

    await page.goto(
      SITE + "/all-products.html?commerce-preview=staging",
      { waitUntil: "domcontentloaded", timeout: 60_000 },
    );
    await waitForCommerce(page, "ready");

    // Flip the same public response to an explicit unavailable state.
    tracked.status = "out-of-stock";
    tracked.purchasable = false;
    tracked.nonPurchasableReason = "out_of_stock";
    tracked.inventory = { tracked: true, available: 0 };

    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForCommerce(page, "ready");

    const blockedCard = page.locator(CARD_SELECTOR);
    assert(
      (await blockedCard.locator(".product-price").textContent())?.trim() ===
        "£12.34",
      "Out-of-stock overlay lost the live price",
    );
    assert(
      await blockedCard.locator(".list-add").isDisabled(),
      "Live out-of-stock card Add button is enabled",
    );
    assert(
      (await blockedCard.textContent()).includes("Out of stock"),
      "Live out-of-stock card label is missing",
    );

    await page.goto(SITE + PRODUCT_PATH, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await waitForCommerce(page, "ready");

    const detail = await page.evaluate(() => {
      const rows = [...document.querySelectorAll(".product-static .info-row")];
      const value = (label) =>
        rows
          .find(
            (row) =>
              row.querySelector("strong")?.textContent?.trim().toLowerCase() ===
              label,
          )
          ?.querySelector("span")
          ?.textContent?.trim() || "";
      return {
        price: value("shop price"),
        availability: value("availability"),
        disabled: document.querySelector(".list-detail-add")?.disabled === true,
      };
    });

    assert(detail.price === "£12.34", "Live Product detail price overlay failed");
    assert(detail.availability === "Out of stock", "Live Product detail stock overlay failed");
    assert(detail.disabled, "Live Product detail Add button is enabled while out of stock");
    await assertCanonical(page, PRODUCT_PATH, "Mocked Product detail");

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "mocked-live-out-of-stock.png"),
      fullPage: true,
    });
  } finally {
    await context.close();
    await browser.close();
  }
}

async function verifyHomepageRailModes(realCatalogPayload) {
  const browser = await webkit.launch();
  const context = await browser.newContext({
    viewport: { width: 820, height: 1180 },
  });
  const page = await context.newPage();

  const sample = realCatalogPayload.products.slice(0, 6).map((product, index) => ({
    productId: product.productId || product.id,
    title: product.name,
    slug: product.slug,
    legacyId: product.id === product.productId ? null : product.id,
    priceMinor: product.priceMinor,
    primaryImageUrl: product.primaryImageUrl,
    position: index * 10,
  }));

  let homepagePayload = null;

  await page.route(API + "/v1/homepage-merchandising", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(homepagePayload),
    });
  });

  try {
    for (const mode of [
      "NEW_ARRIVALS",
      "FEATURED_PRODUCTS",
      "SELECTED_COLLECTION",
    ]) {
      homepagePayload = {
        contract: "homepage-merchandising-published-v1",
        config: {
          id: "home_product_rail",
          publishedVersionId: "qa-" + mode,
          draftVersionId: null,
          enabled: true,
          mode,
          productLimit: sample.length,
          heading:
            mode === "NEW_ARRIVALS"
              ? "Just arrived"
              : mode === "FEATURED_PRODUCTS"
                ? "Popular picks"
                : "Highland Cow favourites",
          selectedStorefrontNodeId:
            mode === "SELECTED_COLLECTION"
              ? "sfn_gifts_highland_cows"
              : null,
          selectedStorefrontNodeName:
            mode === "SELECTED_COLLECTION" ? "Highland Cows" : null,
          modules: [
            { key: "HERO", enabled: true, position: 10 },
            { key: "COLLECTIONS", enabled: true, position: 20 },
            { key: "PRODUCT_RAIL", enabled: true, position: 30 },
            { key: "LOCAL_FAVOURITES", enabled: true, position: 40 },
            { key: "VISIT_SHOP", enabled: true, position: 50 },
          ],
        },
        products: sample,
      };

      await page.goto(SITE + "/index.html?commerce-preview=staging", {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await waitForCommerce(page, "ready");

      const section = page.locator("#homepageProductRail");
      await section.waitFor({ state: "visible", timeout: 15_000 });
      assert(
        (await page
          .locator('#homepageProductRailTrack .product-card:not([data-home-carousel-clone="1"])')
          .count()) === sample.length,
        mode + " Homepage rail did not render the published Product count",
      );
      assert(
        (await page.locator("#homepageProductRailHeading").textContent())?.trim() ===
          homepagePayload.config.heading,
        mode + " Homepage rail heading is wrong",
      );
      const railViewport = page.locator(".home-product-rail-viewport");
      await railViewport.waitFor({ state: "visible", timeout: 10_000 });
      assert(
        (await railViewport.evaluate((el) => getComputedStyle(el).overflowX)) ===
          "auto",
        mode + " Homepage rail is not horizontally swipeable",
      );
      assert(
        (await page.locator("#homepageProductRailTrack").getAttribute("data-native-marquee-ready")) ===
          "1",
        mode + " Homepage rail continuous marquee was not initialised",
      );
      const swipeProbe = await railViewport.evaluate(async (el) => {
        const before = el.scrollLeft;
        el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        el.scrollLeft = before + 45;
        const dragged = el.scrollLeft;
        await new Promise((resolve) => setTimeout(resolve, 180));
        const held = el.scrollLeft;
        el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
        return { before, dragged, held };
      });
      assert(
        swipeProbe.dragged > swipeProbe.before &&
          Math.abs(swipeProbe.held - swipeProbe.dragged) < 4,
        mode + " Homepage rail did not preserve native drag position",
      );
      const autoBefore = await railViewport.evaluate((el) => el.scrollLeft);
      await page.waitForTimeout(1300);
      const autoAfter = await railViewport.evaluate((el) => el.scrollLeft);
      assert(
        autoAfter > autoBefore + 2,
        mode + " Homepage rail did not resume continuous movement after touch",
      );
      await assertNoHorizontalOverflow(page, mode + " Homepage rail page");
    }

    homepagePayload = {
      contract: "homepage-merchandising-published-v1",
      config: {
        id: "home_product_rail",
        publishedVersionId: "qa-module-order",
        draftVersionId: null,
        enabled: true,
        mode: "FEATURED_PRODUCTS",
        productLimit: sample.length,
        heading: "Module layout QA",
        selectedStorefrontNodeId: null,
        selectedStorefrontNodeName: null,
        modules: [
          { key: "COLLECTIONS", enabled: true, position: 10 },
          { key: "HERO", enabled: true, position: 20 },
          { key: "PRODUCT_RAIL", enabled: true, position: 30 },
          { key: "VISIT_SHOP", enabled: true, position: 40 },
          { key: "LOCAL_FAVOURITES", enabled: false, position: 50 },
        ],
      },
      products: sample,
    };

    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForCommerce(page, "ready");
    const publishedModules = await page.evaluate(() =>
      [...document.querySelectorAll("main > [data-home-module]")].map((node) => ({
        key: node.dataset.homeModule,
        hidden: node.hidden,
      })),
    );
    assert(
      publishedModules.map((row) => row.key).join(",") ===
        "HERO,PRODUCT_RAIL,COLLECTIONS,VISIT_SHOP,LOCAL_FAVOURITES",
      "Homepage pinned Hero → Product rail → Collections order did not reach the DOM: " +
        JSON.stringify(publishedModules),
    );
    assert(
      publishedModules.find((row) => row.key === "LOCAL_FAVOURITES")?.hidden === true,
      "Published disabled Homepage module is still visible.",
    );
    assert(
      await page.locator("#homepageProductRail").isVisible(),
      "Published Product rail module should remain visible in module-layout QA.",
    );
    await assertNoHorizontalOverflow(page, "Homepage module composition");

    homepagePayload = {
      contract: "homepage-merchandising-published-v1",
      config: {
        id: "home_product_rail",
        publishedVersionId: "qa-disabled",
        draftVersionId: null,
        enabled: false,
        mode: "NEW_ARRIVALS",
        productLimit: 6,
        heading: "Hidden rail",
        selectedStorefrontNodeId: null,
        selectedStorefrontNodeName: null,
        modules: [
          { key: "HERO", enabled: true, position: 10 },
          { key: "COLLECTIONS", enabled: true, position: 20 },
          { key: "PRODUCT_RAIL", enabled: true, position: 30 },
          { key: "LOCAL_FAVOURITES", enabled: true, position: 40 },
          { key: "VISIT_SHOP", enabled: true, position: 50 },
        ],
      },
      products: [],
    };

    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForCommerce(page, "ready");
    assert(
      await page.locator("#homepageProductRail").isHidden(),
      "Disabled Homepage rail is visible",
    );

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "homepage-product-rail-webkit.png"),
      fullPage: true,
    });
  } finally {
    await context.close();
    await browser.close();
  }
}

async function verifyStaticFallback() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  await page.route(API + "/v1/catalog?limit=200", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "qa_unavailable" } }),
    });
  });

  try {
    await page.goto(
      SITE + "/all-products.html?commerce-preview=staging",
      { waitUntil: "domcontentloaded", timeout: 60_000 },
    );
    await waitForCommerce(page, "fallback");

    const state = await page.evaluate(() => window.BLACK_SHEEP_LIVE_COMMERCE_STATE);
    assert(state?.fallback === true, "Fallback state was not recorded");

    const banner = page.locator("#commercePreviewBanner");
    await banner.waitFor({ state: "visible", timeout: 10_000 });
    const text = await banner.textContent();
    assert(
      text.includes("Staging commerce preview unavailable") &&
        text.includes("Static catalogue fallback is being shown"),
      "Fallback banner does not clearly identify static fallback",
    );

    const card = page.locator(CARD_SELECTOR);
    await card.waitFor({ state: "visible", timeout: 15_000 });
    assert(
      (await card.locator(".product-price").textContent())?.trim().length > 0,
      "Static fallback lost the product price",
    );
    await assertCanonical(page, "/all-products.html", "Fallback all-products");
    await assertNoHorizontalOverflow(page, "Fallback all-products");

    await page.goto(SITE + "/all-products.html?commerce-preview=off", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const config = await page.evaluate(() => window.BLACK_SHEEP_LIVE_COMMERCE);
    assert(
      config?.mode === "live" &&
        config?.preview === false &&
        config?.apiBase === "https://api.theblacksheepshop.co.uk",
      "Preview exit did not restore Production live commerce",
    );
    assert(
      (await page.locator("#commercePreviewBanner").count()) === 0,
      "Preview banner remained after exit",
    );
  } finally {
    await context.close();
    await browser.close();
  }
}

fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

const { payload, target } = await getRealCatalogue();
const homepageMerchandising = await getRealHomepageMerchandising();
globalThis.__phase6Target = target;
globalThis.__homepageMerchandising = homepageMerchandising;

try {
  await verifyRealOverlay(
    chromium,
    "Desktop Chromium",
    { width: 1440, height: 1000 },
    payload.products.length,
  );
  await verifyRealOverlay(
    webkit,
    "Mobile WebKit",
    { width: 390, height: 844 },
    payload.products.length,
  );
  await verifyMockedLiveChanges(payload);
  await verifyHomepageRailModes(payload);
  await verifyStaticFallback();

  console.log(
    JSON.stringify(
      {
        ok: true,
        product: PRODUCT_ID,
        checks: [
          "real-staging-complete-unique-product-coverage",
          "preview-session-persistence",
          "card-price-orderability",
          "product-detail-price-availability",
          "canonical-query-isolation",
          "desktop-no-horizontal-overflow",
          "mobile-webkit-no-horizontal-overflow",
          "checkout-preview-submit-disabled",
          "mocked-live-price-change",
          "mocked-tracked-available-one-basket-cap",
          "mocked-d1-only-product-full-range",
          "mocked-d1-only-product-range-placement",
          "mocked-d1-only-product-dynamic-detail",
          "mocked-live-out-of-stock-card",
          "mocked-live-out-of-stock-product-detail",
          "api-failure-static-fallback",
          "preview-exit-restores-production-live-mode",
          "homepage-published-contract",
          "homepage-rail-three-modes",
          "homepage-rail-touch-swipe-no-page-overflow",
          "homepage-rail-disabled-hidden",
          "homepage-published-five-module-contract",
          "homepage-module-published-order",
          "homepage-module-published-visibility",
        ],
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    "PHASE 6 STOREFRONT OVERLAY BROWSER QA FAILED:",
    error instanceof Error ? error.stack || error.message : error,
  );
  process.exitCode = 1;
}
