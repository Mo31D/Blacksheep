import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium, webkit } from "playwright";

const BASE =
  "https://black-sheep-commerce-api-staging.ky6vfb55p9.workers.dev";
const DB = "black-sheep-commerce-staging";
const RUN_ID = String(process.env.GITHUB_RUN_ID || Date.now());
const ORDER_ID = "admin-browser-" + RUN_ID;
const REF = "E2E-ADMIN-UI-" + RUN_ID;
const NOW = new Date().toISOString();
const ARTIFACT_DIR = path.resolve("admin-browser-qa-artifacts");
const CATEGORY_NAME = "QA Category " + RUN_ID;
const CATEGORY_RENAMED = "QA Seasonal " + RUN_ID;
const CATEGORY_SLUG = "qa-category-" + RUN_ID;

let sessionToken = "";
let sessionHash = "";
let completed = false;

function assert(value, message) {
  if (!value) throw new Error(message);
}

function q(value) {
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function d1(sql) {
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

function cleanupSql() {
  const id = q(ORDER_ID);
  return [
    "DELETE FROM order_messages WHERE order_id=" + id,
    "DELETE FROM customer_review_tokens WHERE order_id=" + id,
    "DELETE FROM refunds WHERE order_id=" + id,
    "DELETE FROM order_adjustments WHERE revision_id IN (SELECT id FROM order_revisions WHERE order_id=" +
      id +
      ")",
    "DELETE FROM order_revision_items WHERE revision_id IN (SELECT id FROM order_revisions WHERE order_id=" +
      id +
      ")",
    "DELETE FROM order_revisions WHERE order_id=" + id,
    "DELETE FROM order_events WHERE order_id=" + id,
    "DELETE FROM order_items WHERE order_id=" + id,
    "DELETE FROM orders WHERE id=" + id,
  ].join(";");
}

function cleanupCategorySql() {
  const slug = q(CATEGORY_SLUG);
  return [
    "DELETE FROM product_version_categories WHERE category_id IN (SELECT id FROM categories WHERE slug=" + slug + ")",
    "DELETE FROM categories WHERE slug=" + slug,
  ].join(";");
}

function findOwnerEmail() {
  let rows = d1(
    "SELECT email FROM admin_sessions ORDER BY created_at DESC LIMIT 1",
  );

  if (!rows.length) {
    rows = d1(
      "SELECT email FROM admin_login_codes ORDER BY created_at DESC LIMIT 1",
    );
  }

  assert(
    rows.length && rows[0].email,
    "No existing staging owner identity is available for browser QA.",
  );

  return String(rows[0].email);
}

function seedSession() {
  const ownerEmail = findOwnerEmail();
  sessionToken = randomBytes(32).toString("base64url");
  sessionHash = sha256(sessionToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  d1(
    "INSERT INTO admin_sessions (token_hash,email,expires_at,created_at) VALUES (" +
      [
        q(sessionHash),
        q(ownerEmail),
        q(expiresAt),
        q(NOW),
      ].join(",") +
      ")",
  );
}

function seedOrder() {
  d1(cleanupSql());

  d1(
    "INSERT INTO orders (" +
      "id,public_reference,idempotency_key,data_class,status,currency,fulfilment_method," +
      "customer_name,customer_email,items_subtotal_minor,delivery_amount_minor," +
      "final_total_minor,payment_status,created_at,updated_at" +
      ") VALUES (" +
      [
        q(ORDER_ID),
        q(REF),
        q("admin-browser-idem-" + RUN_ID),
        "'E2E'",
        "'SUBMITTED'",
        "'GBP'",
        "'collection'",
        "'Admin Browser QA'",
        "'orders@theblacksheepshop.co.uk'",
        "1200",
        "0",
        "NULL",
        "'UNPAID'",
        q(NOW),
        q(NOW),
      ].join(",") +
      ");" +
      "INSERT INTO order_items (" +
      "order_id,line_number,catalog_product_id,sku,slug,product_name," +
      "unit_price_minor,quantity,line_total_minor,options_json,created_at" +
      ") VALUES (" +
      [
        q(ORDER_ID),
        "1",
        "'admin-ui-item-a'",
        "'UI-A'",
        "'admin-ui-item-a'",
        "'Admin UI Test Item A'",
        "500",
        "1",
        "500",
        "'{}'",
        q(NOW),
      ].join(",") +
      "),(" +
      [
        q(ORDER_ID),
        "2",
        "'admin-ui-item-b'",
        "'UI-B'",
        "'admin-ui-item-b'",
        "'Admin UI Test Item B'",
        "700",
        "1",
        "700",
        "'{}'",
        q(NOW),
      ].join(",") +
      ");" +
      "INSERT INTO order_events (" +
      "order_id,event_type,from_status,to_status,actor_type,actor_id,note,metadata_json,created_at" +
      ") VALUES (" +
      [
        q(ORDER_ID),
        "'ORDER_SUBMITTED'",
        "NULL",
        "'SUBMITTED'",
        "'system'",
        "NULL",
        "'Synthetic staging Admin UI browser QA'",
        "'{}'",
        q(NOW),
      ].join(",") +
      ")",
  );
}

async function verifyInjectedSessionAndOrder() {
  const response = await fetch(BASE + "/admin/api/orders?dataClass=TEST", {
    headers: {
      cookie: "bs_admin_session=" + sessionToken,
    },
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}

  assert(
    response.ok,
    "Injected staging admin session failed API verification: HTTP " +
      response.status +
      " " +
      text.slice(0, 500),
  );
  assert(
    Array.isArray(data?.orders) &&
      data.orders.some((order) => order.publicReference === REF),
    "Synthetic Admin UI order is not visible through the authenticated staging orders API.",
  );
}

async function addAdminCookie(context) {
  const hostname = new URL(BASE).hostname;
  await context.addCookies([
    {
      name: "bs_admin_session",
      value: sessionToken,
      domain: hostname,
      path: "/admin",
      secure: true,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
}

async function waitForOrderList(page, label) {
  const apiResponses = [];
  page.on("response", (response) => {
    if (response.url().includes("/admin/api/orders")) {
      apiResponses.push({
        url: response.url(),
        status: response.status(),
      });
    }
  });

  await page.goto(BASE + "/admin", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  await page.waitForSelector("#orders", { timeout: 20_000 });
  await page.waitForSelector('[data-order-class="TEST"]', { timeout: 20_000 });
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/admin/api/orders?dataClass=TEST") &&
        response.status() === 200,
      { timeout: 20_000 },
    ),
    page.locator('[data-order-class="TEST"]').click(),
  ]);

  const row = page.locator('#orders [data-ref="' + REF + '"]');

  try {
    await row.waitFor({ state: "visible", timeout: 20_000 });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      url: location.href,
      ordersText: document.getElementById("orders")?.textContent || "",
      bodyText: document.body?.innerText?.slice(0, 1600) || "",
    }));

    console.error(
      "ADMIN UI ORDER LIST DIAGNOSTIC:",
      JSON.stringify({ label, apiResponses, diagnostic }),
    );

    await page.screenshot({
      path: path.join(
        ARTIFACT_DIR,
        label.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-order-list-failure.png",
      ),
      fullPage: true,
    });

    throw error;
  }

  const heading = await page.locator("#view-orders h1").textContent();
  assert(
    heading?.trim() === "Orders",
    "Authenticated Admin Orders view did not load.",
  );
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));

  assert(
    dimensions.documentWidth <= dimensions.viewport + 2 &&
      dimensions.bodyWidth <= dimensions.viewport + 2,
    label +
      " has horizontal overflow: viewport=" +
      dimensions.viewport +
      ", document=" +
      dimensions.documentWidth +
      ", body=" +
      dimensions.bodyWidth,
  );
}

async function desktopQa() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();

  try {
    await addAdminCookie(context);
    await waitForOrderList(page, "desktop");
    await assertNoHorizontalOverflow(page, "Desktop order list");

    await page.locator('#orders [data-ref="' + REF + '"]').click();

    await page.waitForFunction(
      (reference) =>
        document.getElementById("detail")?.textContent?.includes(reference),
      REF,
      { timeout: 20_000 },
    );

    await page.waitForSelector('#detail [data-action="start_review"]', {
      timeout: 10_000,
    });

    await page.locator('#detail [data-action="start_review"]').click();

    await page.waitForSelector("#createRevision", { timeout: 20_000 });
    await page.locator("#createRevision").click();

    await page.waitForSelector("#saveRevision", { timeout: 20_000 });
    await page.waitForSelector("#addRevisionAdjustment", { timeout: 20_000 });
    await page.waitForSelector("#revisionFulfilment", { timeout: 20_000 });

    await page.locator("#revisionAdjustmentKind").selectOption("DISCOUNT");
    await page.locator("#revisionAdjustmentAmount").fill("1.00");
    await page
      .locator("#revisionAdjustmentLabel")
      .fill("Browser QA discount");
    await page
      .locator("#revisionAdjustmentReason")
      .fill("Synthetic staging browser QA adjustment.");
    await page.locator("#addRevisionAdjustment").click();

    await page.waitForFunction(
      () => document.getElementById("detail")?.textContent?.includes("Browser QA discount"),
      null,
      { timeout: 20_000 },
    );

    await page.locator("#revisionFulfilment").selectOption("delivery");

    await page.waitForFunction(
      () => {
        const fields = document.getElementById("revisionAddressFields");
        const delivery = document.getElementById("revisionDelivery");
        return (
          fields &&
          getComputedStyle(fields).display !== "none" &&
          delivery &&
          delivery.readOnly === false
        );
      },
      null,
      { timeout: 10_000 },
    );

    await page.locator("#revisionFulfilment").selectOption("collection");

    await page.waitForFunction(
      () => {
        const fields = document.getElementById("revisionAddressFields");
        const delivery = document.getElementById("revisionDelivery");
        return (
          fields &&
          getComputedStyle(fields).display === "none" &&
          delivery &&
          delivery.readOnly === true &&
          Number(delivery.value) === 0
        );
      },
      null,
      { timeout: 10_000 },
    );

    await assertNoHorizontalOverflow(page, "Desktop order detail");

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "desktop-admin-order.png"),
      fullPage: true,
    });
  } finally {
    await context.close();
    await browser.close();
  }
}

async function mobileWebkitQa() {
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  try {
    await addAdminCookie(context);
    await waitForOrderList(page, "mobile-webkit");
    await assertNoHorizontalOverflow(page, "Mobile order list");

    await page.locator('#orders [data-ref="' + REF + '"]').click();

    await page.waitForFunction(
      (reference) =>
        document.body.classList.contains("detail-open") &&
        document.getElementById("detail")?.textContent?.includes(reference),
      REF,
      { timeout: 20_000 },
    );

    await page.waitForSelector("#addRevisionAdjustment", { timeout: 20_000 });
    await page.waitForSelector("#revisionFulfilment", { timeout: 20_000 });

    const controls = await page.evaluate(() => {
      const ids = [
        "revisionFulfilment",
        "revisionAdjustmentKind",
        "revisionAdjustmentAmount",
        "addRevisionAdjustment",
      ];

      return ids.map((id) => {
        const el = document.getElementById(id);
        const rect = el?.getBoundingClientRect();
        return {
          id,
          exists: Boolean(el),
          left: rect?.left ?? -9999,
          right: rect?.right ?? 9999,
          width: rect?.width ?? 0,
        };
      });
    });

    for (const control of controls) {
      assert(control.exists, "Missing mobile revision control: " + control.id);
      assert(
        control.left >= -1 && control.right <= 391,
        "Mobile control is clipped horizontally: " +
          control.id +
          " left=" +
          control.left +
          " right=" +
          control.right,
      );
      assert(control.width > 20, "Mobile control has invalid width: " + control.id);
    }

    await assertNoHorizontalOverflow(page, "Mobile order detail");

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "mobile-webkit-admin-order.png"),
      fullPage: true,
    });

    await page.locator("#closeDetail").click();

    await page.waitForFunction(
      () => !document.body.classList.contains("detail-open"),
      null,
      { timeout: 10_000 },
    );
  } finally {
    await context.close();
    await browser.close();
  }
}


async function ownerPolishViewsQa(viewport, label) {
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  async function openView(name) {
    await page.locator('[data-nav="' + name + '"]:visible').first().click();
    await page.waitForFunction(
      (viewName) => {
        const view = document.getElementById("view-" + viewName);
        return Boolean(view && !view.classList.contains("hidden"));
      },
      name,
      { timeout: 20_000 },
    );
  }

  try {
    await addAdminCookie(context);
    await page.goto(BASE + "/admin", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForSelector("#view-orders h1", { timeout: 20_000 });

    const ownerCopy = await page.locator("body").innerText();
    for (const forbidden of [
      "Phase 2 · Editing",
      "Phase 4 · Staging",
      "Staging Product Core",
      "before storefront cutover",
      "dedicated Media phase",
    ]) {
      assert(
        !ownerCopy.includes(forbidden),
        label + " still exposes implementation copy: " + forbidden,
      );
    }

    await openView("dashboard");
    await page.waitForSelector("#dashboardMetrics .metric", { timeout: 20_000 });
    await assertNoHorizontalOverflow(page, label + " dashboard");
    if (viewport.width <= 720) {
      const cards = await page.locator("#dashboardMetrics .metric").evaluateAll((nodes) =>
        nodes.slice(0, 4).map((node) => {
          const rect = node.getBoundingClientRect();
          return { left: rect.left, top: rect.top, width: rect.width };
        }),
      );
      assert(cards.length === 4, label + " dashboard did not render four KPI cards.");
      assert(
        Math.abs(cards[0].top - cards[1].top) < 3 &&
          Math.abs(cards[2].top - cards[3].top) < 3 &&
          cards[2].top > cards[0].top + 20 &&
          cards[1].left > cards[0].left,
        label + " dashboard KPI layout is not 2x2.",
      );
    }

    await openView("products");
    await page.waitForFunction(
      () => document.querySelectorAll("#productList .product-row").length > 0,
      null,
      { timeout: 20_000 },
    );
    await page.locator("#addProduct").click();
    await page.waitForSelector("#newProductTitle", { timeout: 10_000 });
    assert(
      (await page.locator("#newProductType").evaluate((el) => el.tagName)) === "SELECT",
      label + " Add Product type is not a controlled select.",
    );
    await page.locator("#newProductCategorySearch").fill("highland");
    const visibleCategories = await page
      .locator("#newProductCategories .category-choice:not(.hidden)")
      .count();
    assert(visibleCategories > 0, label + " category search returned no visible matches.");
    await assertNoHorizontalOverflow(page, label + " Add Product");
    await page.locator("[data-close-product-sheet]:visible").first().click();

    if (label === "iPhone WebKit") {
      await page.locator("#manageCategories").click();
      await page.waitForSelector("#newCategoryName", { timeout: 10_000 });
      await assertNoHorizontalOverflow(page, label + " Category Manager");

      await page.locator("#newCategoryName").fill(CATEGORY_NAME);
      await page.locator("#newCategoryType").selectOption("COLLECTION_THEME");
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/admin/api/categories") &&
            response.request().method() === "POST" &&
            response.status() === 201,
          { timeout: 20_000 },
        ),
        page.locator("#createCategory").click(),
      ]);

      const categoryId = await page.waitForFunction(
        (name) => {
          const input = Array.from(
            document.querySelectorAll("input[data-category-name]"),
          ).find((element) => element.value === name);
          return input?.getAttribute("data-category-name") || "";
        },
        CATEGORY_NAME,
        { timeout: 20_000 },
      ).then((handle) => handle.jsonValue());

      assert(categoryId, "Category Manager did not render the new category.");
      let categoryRow = page.locator(
        '[data-category-row="' + categoryId + '"]',
      );
      await categoryRow.waitFor({ state: "visible", timeout: 10_000 });
      assert(
        (await categoryRow.innerText()).includes("0 products"),
        "New category did not report zero product usage.",
      );
      assert(
        (await categoryRow.locator("[data-category-type-select]").inputValue()) ===
          "COLLECTION_THEME",
        "New category group was not persisted.",
      );

      await categoryRow.locator("[data-category-name]").fill(CATEGORY_RENAMED);
      await categoryRow
        .locator("[data-category-type-select]")
        .selectOption("PRODUCT_CATEGORY");
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/admin/api/categories/") &&
            response.request().method() === "PATCH" &&
            response.status() === 200,
          { timeout: 20_000 },
        ),
        categoryRow.locator("[data-category-save]").click(),
      ]);

      await page.waitForFunction(
        ({ id, name }) => {
          const row = document.querySelector(
            '[data-category-row="' + id + '"]',
          );
          const input = row?.querySelector("[data-category-name]");
          const select = row?.querySelector("[data-category-type-select]");
          return (
            input?.value === name &&
            select?.value === "PRODUCT_CATEGORY"
          );
        },
        { id: categoryId, name: CATEGORY_RENAMED },
        { timeout: 20_000 },
      );

      categoryRow = page.locator(
        '[data-category-row="' + categoryId + '"]',
      );
      const moveUp = categoryRow.locator('[data-category-move="UP"]');
      if (await moveUp.isEnabled()) {
        await Promise.all([
          page.waitForResponse(
            (response) =>
              response.url().includes("/move") &&
              response.request().method() === "POST" &&
              response.status() === 200,
            { timeout: 20_000 },
          ),
          moveUp.click(),
        ]);
      }

      categoryRow = page.locator(
        '[data-category-row="' + categoryId + '"]',
      );
      page.once("dialog", async (dialog) => {
        await dialog.accept();
      });
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/archive") &&
            response.request().method() === "POST" &&
            response.status() === 200,
          { timeout: 20_000 },
        ),
        categoryRow.locator("[data-category-archive]").click(),
      ]);

      categoryRow = page.locator(
        '[data-category-row="' + categoryId + '"]',
      );
      await categoryRow.locator("[data-category-restore]").waitFor({
        state: "visible",
        timeout: 10_000,
      });

      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/restore") &&
            response.request().method() === "POST" &&
            response.status() === 200,
          { timeout: 20_000 },
        ),
        categoryRow.locator("[data-category-restore]").click(),
      ]);

      await page.locator("[data-close-product-sheet]:visible").first().click();

      await page.locator("#addProduct").click();
      await page.waitForSelector("#newProductCategorySearch", {
        timeout: 10_000,
      });
      await page.locator("#newProductCategorySearch").fill(CATEGORY_RENAMED);
      const managedChoice = page
        .locator("#newProductCategories .category-choice:not(.hidden)")
        .filter({ hasText: CATEGORY_RENAMED });
      await managedChoice.waitFor({ state: "visible", timeout: 10_000 });
      await managedChoice.locator("input").check();
      assert(
        (await page.locator("#newProductCategorySelected").innerText()).includes(
          CATEGORY_RENAMED,
        ),
        "Selected category summary did not update.",
      );
      await assertNoHorizontalOverflow(page, label + " compact category picker");
      await page.locator("[data-close-product-sheet]:visible").first().click();
    }

    await openView("stock");
    await page.waitForFunction(
      () => document.querySelectorAll("#stockList .product-row").length > 0,
      null,
      { timeout: 20_000 },
    );
    const stockText = await page.locator("#view-stock").innerText();
    assert(
      stockText.includes("Count, adjust and review stock for the shop."),
      label + " stock owner copy is missing.",
    );
    await page.locator("#startBulkCount").click();
    await page.waitForSelector("#stocktakeQty", { timeout: 10_000 });
    await assertNoHorizontalOverflow(page, label + " Stocktake");
    const stocktakeActions = await page.locator(".editor-actions:visible").first().boundingBox();
    assert(
      stocktakeActions && stocktakeActions.width <= viewport.width + 2,
      label + " Stocktake actions are clipped.",
    );
    await page.locator("[data-close-product-sheet]:visible").first().click();

    await openView("reports");
    await page.waitForSelector("#reportMetrics .metric", { timeout: 20_000 });
    assert(
      (await page.locator("#view-reports").innerText()).includes(
        "Current payment & fulfilment status",
      ),
      label + " Reports payment status label is stale.",
    );
    await assertNoHorizontalOverflow(page, label + " Reports");

    await page.screenshot({
      path: path.join(
        ARTIFACT_DIR,
        label.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-owner-polish.png",
      ),
      fullPage: true,
    });
  } finally {
    await context.close();
    await browser.close();
  }
}

fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

try {
  seedOrder();
  seedSession();
  await verifyInjectedSessionAndOrder();

  await desktopQa();
  await mobileWebkitQa();
  await ownerPolishViewsQa({ width: 390, height: 844 }, "iPhone WebKit");
  await ownerPolishViewsQa({ width: 820, height: 1180 }, "iPad portrait WebKit");

  completed = true;

  console.log(
    JSON.stringify(
      {
        ok: true,
        reference: REF,
        checks: [
          "authenticated-admin-orders-view",
          "desktop-order-list-no-horizontal-overflow",
          "desktop-order-detail",
          "start-review-ui-action",
          "create-reviewed-version-ui-action",
          "adjustment-controls-render-and-submit",
          "collection-delivery-collection-ui-toggle",
          "desktop-order-detail-no-horizontal-overflow",
          "webkit-mobile-order-list",
          "webkit-mobile-detail-open-close",
          "webkit-mobile-revision-controls-not-clipped",
          "webkit-mobile-no-horizontal-overflow",
          "iphone-dashboard-2x2-kpis",
          "iphone-products-add-product-controlled-type",
          "iphone-category-search",
          "iphone-category-manager-create-rename-group-move-archive-restore",
          "iphone-category-picker-selected-summary",
          "iphone-stocktake-no-horizontal-overflow",
          "iphone-reports-owner-copy",
          "ipad-portrait-products-stock-reports",
          "owner-facing-dev-copy-removed",
        ],
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    "ADMIN BROWSER QA FAILED:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
} finally {
  try {
    try {
      d1(cleanupCategorySql());
      console.log("Synthetic Category Manager QA data cleaned up.");
    } catch (categoryCleanupError) {
      console.error(
        "Category cleanup warning:",
        categoryCleanupError instanceof Error
          ? categoryCleanupError.message
          : categoryCleanupError,
      );
      if (completed) process.exitCode = 1;
    }
    if (sessionHash) {
      d1("DELETE FROM admin_sessions WHERE token_hash=" + q(sessionHash));
    }
    if (completed) {
      d1(cleanupSql());
      console.log("Synthetic Admin UI browser QA data cleaned up.");
    } else {
      console.error("Synthetic order preserved for failure investigation:", REF);
    }
  } catch (cleanupError) {
    console.error(
      "Cleanup warning:",
      cleanupError instanceof Error ? cleanupError.message : cleanupError,
    );
    if (completed) process.exitCode = 1;
  }
}
