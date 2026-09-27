import { chromium, webkit } from "playwright";

const API = "https://api.theblacksheepshop.co.uk";
const SHOP = "https://theblacksheepshop.co.uk";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    redirect: "manual",
  });
  assert(response.ok, url + " returned HTTP " + response.status);
  return response.json();
}

async function publishedProducts() {
  const products = [];
  let cursor = 0;
  for (let page = 0; page < 50; page += 1) {
    const payload = await getJson(
      API + "/v1/catalog?limit=200&cursor=" + cursor,
    );
    products.push(...(payload.products || []));
    if (payload.nextCursor == null) break;
    cursor = Number(payload.nextCursor);
  }
  return products;
}

function staticProductUrls(html) {
  const urls = new Set();
  for (const match of html.matchAll(/data-url="([^"]+)"/g)) {
    if (/^\/products\/[^?]+\.html$/.test(match[1])) urls.add(match[1]);
  }
  return urls;
}

async function browserSmoke(browserType, label, staleStaticUrls) {
  const browser = await browserType.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: label.includes("WebKit")
        ? { width: 820, height: 1180 }
        : { width: 1280, height: 900 },
    });

    await page.goto(SHOP + "/?card14=" + Date.now(), {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForFunction(
      () => {
        const state = document.documentElement.dataset.commerceLive;
        return state === "ready" || state === "fallback";
      },
      undefined,
      { timeout: 30_000 },
    );

    const state = await page.evaluate(
      () => ({
        commerceLive: document.documentElement.dataset.commerceLive || null,
        liveState: window.BLACK_SHEEP_LIVE_COMMERCE_STATE || null,
      }),
    );
    assert(
      state.commerceLive === "ready",
      label + " storefront live UI did not become ready: " +
        JSON.stringify(state.liveState),
    );
    assert(
      state.liveState?.authoritative === true,
      label + " storefront is not authoritative: " +
        JSON.stringify(state.liveState),
    );

    const order = await page.evaluate(() => {
      const hero = document.querySelector('[data-home-module="HERO"]');
      const rail = document.querySelector('[data-home-module="PRODUCT_RAIL"]');
      const collections = document.querySelector('[data-home-module="COLLECTIONS"]');
      if (!hero || !rail || !collections) return [];
      const children = [...hero.parentElement.children];
      return [hero, rail, collections].map((node) => children.indexOf(node));
    });
    assert(
      order.length === 3 && order[0] < order[1] && order[1] < order[2],
      label + " Homepage order is not Hero -> Product strip -> Collections: " +
        JSON.stringify(order),
    );

    const viewport = page.locator(".home-product-rail-viewport");
    if (await viewport.count()) {
      await viewport.waitFor({ state: "visible", timeout: 10_000 });
      const before = await viewport.evaluate((el) => el.scrollLeft);
      await page.waitForTimeout(1400);
      const after = await viewport.evaluate((el) => el.scrollLeft);
      assert(
        after > before + 2,
        label + " Homepage marquee did not move continuously",
      );
    }

    await page.goto(SHOP + "/all-products.html?card14=" + Date.now(), {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForFunction(
      () => {
        const state = document.documentElement.dataset.commerceLive;
        return state === "ready" || state === "fallback";
      },
      undefined,
      { timeout: 30_000 },
    );
    const fullRangeState = await page.evaluate(
      () => ({
        commerceLive: document.documentElement.dataset.commerceLive || null,
        liveState: window.BLACK_SHEEP_LIVE_COMMERCE_STATE || null,
      }),
    );
    assert(
      fullRangeState.commerceLive === "ready",
      label + " Full range live UI did not become ready: " +
        JSON.stringify(fullRangeState.liveState),
    );

    for (const url of staleStaticUrls.slice(0, 25)) {
      const count = await page.locator(
        'article.product-card[data-url="' +
          url.replaceAll('"', '\\"') +
          '"]',
      ).count();
      assert(
        count === 0,
        label + " archived/stale legacy Product remained visible: " + url,
      );
    }

    const liveState = fullRangeState.liveState;
    assert(
      liveState?.authoritative === true && liveState?.fallback !== true,
      label + " Full range fell back from D1 authority",
    );
  } finally {
    await browser.close();
  }
}

async function main() {
  const health = await getJson(API + "/health");
  assert(health.status === "ok", "Production health is not ok");
  assert(health.environment === "production", "Wrong Production environment marker");
  assert(health.database === "bound", "Production D1 is not bound");
  assert(health.features?.publicCatalog === true, "Public D1 catalogue is disabled");
  assert(
    health.features?.cleanCollectionRoutes === true,
    "Clean collection routes are not enabled in Production",
  );
  assert(
    health.features?.cleanProductRoutes === false,
    "Clean Product routes must remain disabled until legacy static /products routing is isolated",
  );

  const admin = await fetch("https://admin.theblacksheepshop.co.uk/", {
    redirect: "manual",
  });
  assert(admin.status === 200, "Production Admin returned HTTP " + admin.status);
  const adminHtml = await admin.text();
  assert(adminHtml.includes("Black Sheep"), "Production Admin shell is invalid");

  const legacyCollection = await fetch(SHOP + "/collections/gifts", {
    redirect: "manual",
  });
  assert(
    legacyCollection.status === 301 &&
      (legacyCollection.headers.get("location") || "").endsWith("/gifts.html"),
    "Legacy collection clean URL did not 301 to established canonical",
  );

  const sitemap = await fetch(SHOP + "/sitemap.xml", {
    redirect: "manual",
    headers: { accept: "application/xml,text/xml" },
  });
  assert(sitemap.status === 200, "Production sitemap returned HTTP " + sitemap.status);
  assert(
    (sitemap.headers.get("content-type") || "").includes("xml"),
    "Production sitemap is not XML",
  );
  const sitemapXml = await sitemap.text();
  assert(sitemapXml.includes(SHOP + "/gifts.html"), "Sitemap lost legacy collection canonical");
  assert(!sitemapXml.includes("/collections/gifts</loc>"), "Sitemap duplicated legacy collection");
  assert(!sitemapXml.includes("product.html?"), "Sitemap contains query-string Product URLs");

  const products = await publishedProducts();
  assert(products.length > 0, "Published Production catalogue is empty");

  const authoritativeLegacyUrls = new Set(
    products
      .filter((product) => product.id !== product.productId)
      .map((product) => "/products/" + encodeURIComponent(product.slug) + ".html"),
  );

  const staticResponse = await fetch(SHOP + "/all-products.html", {
    redirect: "manual",
  });
  assert(staticResponse.ok, "Static Full range page is unavailable");
  const staticHtml = await staticResponse.text();
  const staticUrls = staticProductUrls(staticHtml);
  const staleStaticUrls = [...staticUrls].filter(
    (url) => !authoritativeLegacyUrls.has(url),
  );

  for (const url of authoritativeLegacyUrls) {
    assert(
      sitemapXml.includes(SHOP + url),
      "Published legacy Product missing from sitemap: " + url,
    );
  }
  for (const url of staleStaticUrls) {
    assert(
      !sitemapXml.includes(SHOP + url),
      "Archived/stale legacy Product remained in sitemap: " + url,
    );
  }

  await browserSmoke(chromium, "Chromium", staleStaticUrls);
  await browserSmoke(webkit, "iPad WebKit", staleStaticUrls);

  console.log(
    JSON.stringify(
      {
        status: "PASS",
        publishedProducts: products.length,
        staticLegacyCards: staticUrls.size,
        staleStaticCandidatesChecked: staleStaticUrls.length,
        cleanCollectionRoutes: health.features.cleanCollectionRoutes,
        cleanProductRoutes: health.features.cleanProductRoutes,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("CARD 14 PRODUCTION READ-ONLY SMOKE FAILED:", error);
  process.exit(1);
});
