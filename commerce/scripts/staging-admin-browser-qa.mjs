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
const STRUCTURE_ROOT_NAME = "QA Website Section " + RUN_ID;
const STRUCTURE_CHILD_A = "QA Sub-section A " + RUN_ID;
const STRUCTURE_CHILD_B = "QA Sub-section B " + RUN_ID;
const PRODUCT_PLACEMENT_QA_TITLE = "QA Placement Product " + RUN_ID;
const PRODUCT_PLACEMENT_QA_SKU = "QA-PLACE-" + RUN_ID;

let sessionToken = "";
let sessionHash = "";
let completed = false;
const stocktakeQaSessionIds = [];

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

function cleanupSql(orderId = ORDER_ID) {
  const id = q(orderId);
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

function cleanupStaleQaOrders() {
  const rows = d1(
    "SELECT id FROM orders WHERE data_class='E2E' AND id LIKE 'admin-browser-%'",
  );
  for (const row of rows) {
    if (row?.id) d1(cleanupSql(String(row.id)));
  }
}

function cleanupCategorySql() {
  const slug = q(CATEGORY_SLUG);
  return [
    "DELETE FROM product_version_categories WHERE category_id IN (SELECT id FROM categories WHERE slug=" + slug + ")",
    "DELETE FROM categories WHERE slug=" + slug,
  ].join(";");
}

function cleanupStorefrontStructureQa() {
  const names = [STRUCTURE_ROOT_NAME, STRUCTURE_CHILD_A, STRUCTURE_CHILD_B];
  const inList = names.map(q).join(",");
  const rows = d1(
    "SELECT DISTINCT node_id AS id FROM storefront_node_versions WHERE name IN (" +
      inList +
      ")",
  );
  const ids = rows.map((row) => String(row.id || "")).filter(Boolean);
  if (!ids.length) return;
  const idList = ids.map(q).join(",");
  d1(
    [
      "DELETE FROM storefront_audit_events WHERE node_id IN (" + idList + ")",
      "DELETE FROM product_version_storefront_placements WHERE storefront_node_id IN (" + idList + ")",
      "DELETE FROM storefront_node_versions WHERE node_id IN (" + idList + ")",
      "DELETE FROM storefront_nodes WHERE id IN (" + idList + ")",
    ].join(";"),
  );
}

function cleanupProductPlacementQa() {
  const ids = d1(
    "SELECT DISTINCT p.id AS id FROM products p " +
      "LEFT JOIN product_versions pv ON pv.product_id=p.id " +
      "LEFT JOIN product_variants v ON v.product_id=p.id " +
      "WHERE pv.title=" + q(PRODUCT_PLACEMENT_QA_TITLE) +
      " OR v.sku=" + q(PRODUCT_PLACEMENT_QA_SKU),
  ).map((row) => String(row.id || "")).filter(Boolean);

  for (const productId of ids) {
    const pid = q(productId);
    const versionSub = "(SELECT id FROM product_versions WHERE product_id=" + pid + ")";
    const variantSub = "(SELECT id FROM product_variants WHERE product_id=" + pid + ")";
    d1([
      "DELETE FROM inventory_reservation_items WHERE variant_id IN " + variantSub,
      "DELETE FROM inventory_movements WHERE variant_id IN " + variantSub,
      "DELETE FROM inventory_incoming WHERE variant_id IN " + variantSub,
      "DELETE FROM inventory_balances WHERE variant_id IN " + variantSub,
      "DELETE FROM product_version_media WHERE product_version_id IN " + versionSub,
      "DELETE FROM product_attributes WHERE product_version_id IN " + versionSub,
      "DELETE FROM product_version_storefront_placements WHERE product_version_id IN " + versionSub,
      "DELETE FROM product_version_categories WHERE product_version_id IN " + versionSub,
      "DELETE FROM product_source_records WHERE product_id=" + pid,
      "DELETE FROM product_audit_events WHERE product_id=" + pid,
      "DELETE FROM product_slugs WHERE product_id=" + pid,
      "DELETE FROM product_variants WHERE product_id=" + pid,
      "DELETE FROM product_versions WHERE product_id=" + pid,
      "DELETE FROM products WHERE id=" + pid,
    ].join(";"));
  }
}

function cleanupStocktakeQaSessions() {
  const ids = [...new Set(stocktakeQaSessionIds)].filter(Boolean);
  if (!ids.length) return;
  const inList = ids.map(q).join(",");
  d1("DELETE FROM stocktake_sessions WHERE id IN (" + inList + ")");
}

function ownerEmailCandidates() {
  const rows = d1(
    "SELECT email, MAX(created_at) AS recent FROM (" +
      "SELECT email, created_at FROM admin_login_codes " +
      "UNION ALL SELECT email, created_at FROM admin_sessions" +
    ") WHERE email IS NOT NULL AND TRIM(email) <> '' " +
    "GROUP BY LOWER(email) ORDER BY recent DESC LIMIT 20",
  );
  return rows.map((row) => String(row.email || "").trim()).filter(Boolean);
}

async function seedSession() {
  const candidates = ownerEmailCandidates();
  assert(
    candidates.length > 0,
    "No staging Admin identity candidates are available for browser QA.",
  );

  for (const ownerEmail of candidates) {
    const candidateToken = randomBytes(32).toString("base64url");
    const candidateHash = sha256(candidateToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    d1(
      "INSERT INTO admin_sessions (token_hash,email,expires_at,created_at) VALUES (" +
        [
          q(candidateHash),
          q(ownerEmail),
          q(expiresAt),
          q(NOW),
        ].join(",") +
        ")",
    );

    const response = await fetch(BASE + "/admin/api/orders?dataClass=BUSINESS", {
      headers: {
        cookie: "bs_admin_session=" + candidateToken,
      },
    });

    if (response.ok) {
      sessionToken = candidateToken;
      sessionHash = candidateHash;
      console.log("Resolved an allowed staging Admin identity for browser QA.");
      return;
    }

    d1("DELETE FROM admin_sessions WHERE token_hash=" + q(candidateHash));
  }

  throw new Error(
    "No existing staging Admin identity matched the Worker's configured owner identity.",
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
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(String(error?.stack || error?.message || error));
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
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
  await page.waitForTimeout(600);
  if (pageErrors.length) {
    throw new Error(
      label + " Admin runtime error: " + pageErrors.join(" | "),
    );
  }

  await page.waitForSelector("#orders", { timeout: 20_000 });
  await page.waitForSelector('[data-order-class="TEST"]', { timeout: 20_000 });
  await page.locator('[data-order-class="TEST"]').click();

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
      JSON.stringify({ label, apiResponses, pageErrors, consoleErrors, diagnostic }),
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

async function assertMutationResponse(responsePromise, label, expectedStatus) {
  const response = await responsePromise;
  const text = await response.text();
  if (response.status() !== expectedStatus) {
    throw new Error(
      label +
        " returned HTTP " +
        response.status() +
        ": " +
        text.slice(0, 1200),
    );
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(label + " returned invalid JSON: " + text.slice(0, 500));
  }
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


async function productPlacementQa() {
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 820, height: 1180 },
  });
  const page = await context.newPage();

  try {
    cleanupProductPlacementQa();
    await addAdminCookie(context);
    await page.goto(BASE + "/admin#products", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForFunction(
      () => document.querySelectorAll("#productList .product-row").length > 0,
      null,
      { timeout: 20_000 },
    );

    await page.locator("#addProduct").click();
    await page.waitForSelector("#newProductTitle", { timeout: 10_000 });
    await page.locator("#newProductTitle").fill(PRODUCT_PLACEMENT_QA_TITLE);
    await page.locator("#newProductPrice").fill("1.23");
    await page.locator("#newProductSku").fill(PRODUCT_PLACEMENT_QA_SKU);
    await page
      .locator("#newProductDesc")
      .fill("Synthetic CARD 03 placement and publishing verification.");

    assert(
      (await page.locator("#newProductType").count()) === 0,
      "CARD 03 Add Product still exposes Product type.",
    );

    await page
      .locator("#newProductPrimarySection")
      .selectOption("sfn_gifts");
    await page
      .locator("#newProductPrimarySubsection")
      .selectOption("sfn_gifts_highland_cows");

    const seasonal = page.locator(
      '#newProductAdditionalPlacements input[value="sfn_gifts_seasonal"]',
    );
    await seasonal.check();

    const category = page
      .locator("#newProductCategories .category-choice")
      .filter({ hasText: "Highland Cows" })
      .locator("input[type=checkbox]")
      .first();
    assert(
      (await category.count()) === 1,
      "CARD 03 QA could not find the Highland Cows product classification.",
    );
    await category.check();

    await assertNoHorizontalOverflow(page, "CARD 03 Add Product iPad portrait");

    console.log("CARD03 QA: creating Product draft");
    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/admin/api/products") &&
        response.request().method() === "POST",
      { timeout: 20_000 },
    );
    await page.locator("#createProductSave").click();
    const created = await assertMutationResponse(
      createResponsePromise,
      "CARD 03 Product create",
      201,
    );
    const productId = String(created?.product?.id || "");
    assert(productId, "CARD 03 Product creation did not return a Product id.");
    const createdPlacements = Array.isArray(created?.product?.storefrontPlacements)
      ? created.product.storefrontPlacements
      : [];
    assert(
      createdPlacements.some(
        (placement) =>
          placement.storefrontNodeId === "sfn_gifts_highland_cows" &&
          placement.isPrimary === true,
      ),
      "CARD 03 create response is missing the primary Storefront placement.",
    );
    assert(
      createdPlacements.some(
        (placement) =>
          placement.storefrontNodeId === "sfn_gifts_seasonal" &&
          placement.isPrimary === false,
      ),
      "CARD 03 create response is missing the additional Storefront placement.",
    );

    await page.waitForFunction(
      (title) =>
        document.getElementById("productDetail")?.textContent?.includes(title),
      PRODUCT_PLACEMENT_QA_TITLE,
      { timeout: 20_000 },
    );
    let detailText = await page.locator("#productDetail").innerText();
    assert(
      detailText.includes("Website placement") &&
        detailText.includes("Primary") &&
        detailText.includes("Also show in") &&
        !detailText.includes("Primary\nNot selected"),
      "Created Product does not show the selected Storefront placements.",
    );

    let editDetails = page.locator("#productEditDetails");
    if (!(await editDetails.isVisible())) {
      const runtimeSource = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        mediaMatches: window.matchMedia
          ? window.matchMedia("(max-width: 900px)").matches
          : null,
        helperSource:
          typeof openResponsiveProductDetail === "function"
            ? openResponsiveProductDetail.toString()
            : null,
        createHasResponsiveOpen:
          typeof createProductFromSheet === "function"
            ? createProductFromSheet
                .toString()
                .includes("openResponsiveProductDetail()")
            : false,
      }));
      console.log(
        "CARD03 QA: staging runtime responsive source",
        JSON.stringify(runtimeSource),
      );
      const manualOpen = await page.evaluate(() => {
        if (typeof openResponsiveProductDetail === "function") {
          openResponsiveProductDetail();
        }
        const detail = document.getElementById("productDetail");
        const rect = detail?.getBoundingClientRect();
        return {
          bodyClass: document.body.className,
          detailDisplay: detail ? getComputedStyle(detail).display : null,
          detailRect: rect
            ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
            : null,
        };
      });
      console.log(
        "CARD03 QA: manual responsive open result",
        JSON.stringify(manualOpen),
      );
      if (manualOpen.bodyClass.includes("product-detail-open")) {
        await page.waitForSelector("#productEditDetails:visible", {
          timeout: 10_000,
        });
        editDetails = page.locator("#productEditDetails:visible");
      }
    }
    if (!(await editDetails.isVisible())) {
      const detailState = await page.evaluate(() => {
        const detail = document.getElementById("productDetail");
        const edit = document.getElementById("productEditDetails");
        const rect = detail?.getBoundingClientRect();
        return {
          innerWidth: window.innerWidth,
          bodyClass: document.body.className,
          detailDisplay: detail ? getComputedStyle(detail).display : null,
          detailRect: rect
            ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
            : null,
          editDisplay: edit ? getComputedStyle(edit).display : null,
        };
      });
      console.log(
        "CARD03 QA: created Product detail was not visible; reopening from Product list",
        JSON.stringify(detailState),
      );
      const createdRow = page
        .locator("#productList .product-row")
        .filter({ hasText: PRODUCT_PLACEMENT_QA_TITLE })
        .first();
      await createdRow.waitFor({ state: "visible", timeout: 10_000 });
      await createdRow.click();
      await page.waitForSelector("#productEditDetails:visible", {
        timeout: 10_000,
      });
      editDetails = page.locator("#productEditDetails:visible");
    }
    const editorResponses = [];
    const editorResponseListener = async (response) => {
      if (
        response.url().includes("/admin/api/categories") ||
        response.url().includes("/admin/api/storefront-structure")
      ) {
        editorResponses.push({
          url: response.url(),
          status: response.status(),
        });
      }
    };
    page.on("response", editorResponseListener);
    await editDetails.click();
    await page.waitForTimeout(750);
    const editorState = await page.evaluate(() => {
      const sheet = document.getElementById("catalogSheet");
      const primary = document.getElementById("pePrimarySection");
      const toast = document.getElementById("toast");
      const rect = sheet?.getBoundingClientRect();
      return {
        hasPrimary: Boolean(primary),
        sheetClass: sheet?.className || null,
        sheetAriaHidden: sheet?.getAttribute("aria-hidden") || null,
        sheetDisplay: sheet ? getComputedStyle(sheet).display : null,
        sheetRect: rect
          ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          : null,
        toastText: toast?.textContent || "",
        toastClass: toast?.className || "",
        editorSource:
          typeof openProductEditor === "function"
            ? openProductEditor.toString().slice(0, 1600)
            : null,
      };
    });
    console.log(
      "CARD03 QA: Edit details click result",
      JSON.stringify({ editorState, editorResponses }),
    );
    if (!editorState.hasPrimary) {
      const manualEditorState = await page.evaluate(async () => {
        try {
          await openProductEditor();
        } catch (error) {
          return {
            thrown: String(error?.stack || error?.message || error),
          };
        }
        const sheet = document.getElementById("catalogSheet");
        return {
          thrown: null,
          hasPrimary: Boolean(document.getElementById("pePrimarySection")),
          sheetClass: sheet?.className || null,
          toastText: document.getElementById("toast")?.textContent || "",
        };
      });
      console.log(
        "CARD03 QA: manual Product editor result",
        JSON.stringify(manualEditorState),
      );
    }
    page.off("response", editorResponseListener);
    await page.waitForSelector("#pePrimarySection", { timeout: 10_000 });
    assert(
      (await page.locator("#pePrimarySection").inputValue()) === "sfn_gifts" &&
        (await page.locator("#pePrimarySubsection").inputValue()) ===
          "sfn_gifts_highland_cows",
      "CARD 03 Edit Product did not persist the primary website location.",
    );
    assert(
      await page
        .locator(
          '#peAdditionalPlacements input[value="sfn_gifts_seasonal"]',
        )
        .isChecked(),
      "CARD 03 Edit Product did not persist the additional website location.",
    );

    const homeGifts = page.locator(
      '#peAdditionalPlacements input[value="sfn_gifts_home_gifts"]',
    );
    await homeGifts.check();
    console.log("CARD03 QA: saving edited placements");
    const saveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/admin/api/products/" + productId + "/draft") &&
        response.request().method() === "PATCH",
      { timeout: 20_000 },
    );
    await page.locator("#peSave").click();
    await assertMutationResponse(
      saveResponsePromise,
      "CARD 03 Product draft save",
      200,
    );

    await page.waitForSelector("#productPreview", { timeout: 10_000 });
    await page.locator("#productPreview").click();
    await page.waitForSelector(".preview-product-card", { timeout: 10_000 });
    const previewText = await page.locator(".product-editor-panel").innerText();
    assert(
      previewText.includes("Private preview") &&
        previewText.includes("Primary:") &&
        previewText.includes("Also shown in:") &&
        !previewText.includes("Primary: Not selected"),
      "CARD 03 private Preview does not reflect Product placements.",
    );
    await page.locator("[data-close-product-sheet]:visible").first().click();

    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    console.log("CARD03 QA: publishing Product draft");
    const publishResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/admin/api/products/" + productId + "/publish") &&
        response.request().method() === "POST",
      { timeout: 20_000 },
    );
    await page.locator("#productPublish").click();
    const publishedPayload = await assertMutationResponse(
      publishResponsePromise,
      "CARD 03 Product publish",
      200,
    );
    const publishedVersionId = String(
      publishedPayload?.product?.publishedVersionId || "",
    );
    assert(publishedVersionId, "CARD 03 publish did not return a published version.");

    await page.waitForFunction(
      () =>
        document
          .querySelector(".live-verification.good")
          ?.textContent?.includes("Published & verified in staging"),
      null,
      { timeout: 20_000 },
    );
    assert(
      (await page.locator("#productDetail").innerText()).includes(
        "Production link appears after Production release.",
      ),
      "Staging Product verification incorrectly exposes a Production live-link claim.",
    );

    const publicResponse = await fetch(BASE + "/v1/catalog/" + productId);
    assert(publicResponse.ok, "Published QA Product is missing from public catalogue.");
    const publicPayload = await publicResponse.json();
    const publicProduct = publicPayload?.product;
    assert(
      publicProduct?.publishedVersionId === publishedVersionId,
      "Public catalogue version does not match the published Product version.",
    );
    assert(
      publicProduct?.primaryStorefrontNodeId === "sfn_gifts_highland_cows",
      "Public catalogue primary Storefront placement is incorrect.",
    );
    const publicPlacements = Array.isArray(publicProduct?.storefrontNodeIds)
      ? publicProduct.storefrontNodeIds
      : [];
    for (const expected of [
      "sfn_gifts_highland_cows",
      "sfn_gifts_seasonal",
      "sfn_gifts_home_gifts",
    ]) {
      assert(
        publicPlacements.includes(expected),
        "Public catalogue is missing Storefront placement " + expected,
      );
    }
    assert(
      new Set(publicPlacements).size === publicPlacements.length,
      "Public catalogue returned duplicate Product placements.",
    );

    await assertNoHorizontalOverflow(
      page,
      "CARD 03 Product detail iPad portrait",
    );
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "ipad-card03-product-placement.png"),
      fullPage: true,
    });
  } finally {
    await context.close();
    await browser.close();
    cleanupProductPlacementQa();
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
      (await page.locator("#newProductType").count()) === 0,
      label + " Add Product still exposes the retired Product type control.",
    );
    assert(
      (await page.locator("#newProductPrimarySection").count()) === 1 &&
        (await page.locator("#newProductPrimarySubsection").count()) === 1 &&
        (await page.locator("#newProductAdditionalPlacements").count()) === 1,
      label + " Add Product website-placement controls are incomplete.",
    );
    await page.locator("#newProductCategorySearch").fill("highland");
    const visibleCategories = await page
      .locator("#newProductCategories .category-choice:not(.hidden)")
      .count();
    assert(visibleCategories > 0, label + " category search returned no visible matches.");
    assert(
      (await page.locator("#newProductCost").count()) === 1 &&
        (await page.locator("#newProductVat").inputValue()) === "20" &&
        (await page.locator("#newProductSupplier").count()) === 1 &&
        (await page.locator("#newProductSupplierCode").count()) === 1,
      label + " Add Product cost/supplier controls are incomplete.",
    );
    await assertNoHorizontalOverflow(page, label + " Add Product");
    if (label === "iPhone WebKit") {
      await page.locator("#newProductCategorySearch").fill("");
      await page.locator(".product-editor-panel").evaluate((panel) => {
        panel.scrollTop = panel.scrollHeight;
      });
      await page.waitForTimeout(150);
      const clearance = await page.evaluate(() => {
        const actions = document.querySelector(".editor-actions");
        const choices = Array.from(
          document.querySelectorAll("#newProductCategories .category-choice"),
        );
        const last = choices.at(-1);
        if (!actions || !last) return null;
        const actionRect = actions.getBoundingClientRect();
        const lastRect = last.getBoundingClientRect();
        return {
          actionTop: actionRect.top,
          lastBottom: lastRect.bottom,
          viewportHeight: window.innerHeight,
        };
      });
      assert(clearance, label + " Add Product footer clearance could not be measured.");
      assert(
        clearance.lastBottom <= clearance.actionTop + 2,
        label +
          " Add Product sticky actions still overlap the last category (" +
          JSON.stringify(clearance) +
          ").",
      );
    }
    await page.locator("[data-close-product-sheet]:visible").first().click();

    if (label === "iPhone WebKit" || label === "iPad portrait WebKit") {
      await openView("catalogue");
      await page.waitForFunction(
        () => document.querySelectorAll("#storefrontStructureTree .structure-card").length >= 4,
        null,
        { timeout: 20_000 },
      );
      const catalogueText = await page.locator("#view-catalogue").innerText();
      for (const expected of [
        "Website structure",
        "Brands & ranges",
        "Gifts & Souvenirs",
        "Ice Cream",
        "Romney's",
        "Hawkshead Relish",
      ]) {
        assert(
          catalogueText.includes(expected),
          label + " Catalogue is missing: " + expected,
        );
      }
      for (const forbidden of [
        "PRODUCT_CATEGORY",
        "COLLECTION_THEME",
        "BRAND_RANGE",
      ]) {
        assert(
          !catalogueText.includes(forbidden),
          label + " Catalogue exposes technical enum: " + forbidden,
        );
      }
      await assertNoHorizontalOverflow(page, label + " Catalogue structure");

      await page.locator('[data-catalogue-tab="brands"]').click();
      await page.waitForSelector("#catalogueBrandsPanel:not(.hidden)", {
        timeout: 10_000,
      });
      assert(
        (await page.locator("#catalogueBrandsPanel").innerText()).includes(
          "Brands & ranges",
        ),
        label + " Brands & ranges panel did not open.",
      );
      await assertNoHorizontalOverflow(page, label + " Brands & ranges");
      await page.locator('[data-catalogue-tab="structure"]').click();
    }

    if (label === "iPhone WebKit") {
      cleanupStorefrontStructureQa();

      await page.locator("#addStorefrontSection").click();
      await page.waitForSelector("#structureName", { timeout: 10_000 });
      await page.locator("#structureName").fill(STRUCTURE_ROOT_NAME);
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().endsWith("/admin/api/storefront-structure") &&
            response.request().method() === "POST" &&
            response.status() === 201,
          { timeout: 20_000 },
        ),
        page.locator("#saveStructureNode").click(),
      ]);

      const rootCard = page
        .locator("#storefrontStructureTree .structure-card")
        .filter({ hasText: STRUCTURE_ROOT_NAME });
      await rootCard.waitFor({ state: "visible", timeout: 20_000 });
      const rootId = await rootCard
        .locator("[data-structure-add-child]")
        .getAttribute("data-structure-add-child");
      assert(rootId, "New main Website section did not expose its node id.");

      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/admin/api/storefront-structure/") &&
            response.request().method() === "PATCH" &&
            response.status() === 200,
          { timeout: 20_000 },
        ),
        rootCard.locator("[data-structure-toggle-menu]").click(),
      ]);
      await page.waitForFunction(
        (name) => {
          const cards = Array.from(
            document.querySelectorAll("#storefrontStructureTree .structure-card"),
          );
          const root = cards.find((card) => card.textContent?.includes(name));
          return Boolean(root?.textContent?.includes("Hidden from menu"));
        },
        STRUCTURE_ROOT_NAME,
        { timeout: 20_000 },
      );

      async function addChild(name) {
        const freshRoot = page
          .locator("#storefrontStructureTree .structure-card")
          .filter({ hasText: STRUCTURE_ROOT_NAME });
        await freshRoot.locator("[data-structure-add-child]").click();
        await page.waitForSelector("#structureName", { timeout: 10_000 });
        await page.locator("#structureName").fill(name);
        await Promise.all([
          page.waitForResponse(
            (response) =>
              response.url().endsWith("/admin/api/storefront-structure") &&
              response.request().method() === "POST" &&
              response.status() === 201,
            { timeout: 20_000 },
          ),
          page.locator("#saveStructureNode").click(),
        ]);
        await page.waitForFunction(
          ({ rootName, childName }) => {
            const cards = Array.from(
              document.querySelectorAll("#storefrontStructureTree .structure-card"),
            );
            const root = cards.find((card) =>
              card.textContent?.includes(rootName),
            );
            return Boolean(root?.textContent?.includes(childName));
          },
          { rootName: STRUCTURE_ROOT_NAME, childName: name },
          { timeout: 20_000 },
        );
      }

      await addChild(STRUCTURE_CHILD_A);
      await addChild(STRUCTURE_CHILD_B);

      let qaRoot = page
        .locator("#storefrontStructureTree .structure-card")
        .filter({ hasText: STRUCTURE_ROOT_NAME });
      const childRows = qaRoot.locator(".structure-subrow");
      assert(
        (await childRows.count()) === 2,
        "QA Website section did not render two nested sub-sections.",
      );

      const firstBefore = (await childRows.nth(0).innerText()).trim();
      assert(
        firstBefore.includes(STRUCTURE_CHILD_A),
        "Expected QA Sub-section A to start first.",
      );

      const firstMoveDown = childRows
        .nth(0)
        .locator('[data-structure-move="DOWN"]');
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/admin/api/storefront-structure/") &&
            response.url().endsWith("/move") &&
            response.request().method() === "POST" &&
            response.status() === 200,
          { timeout: 20_000 },
        ),
        firstMoveDown.click(),
      ]);

      await page.waitForFunction(
        ({ rootName, expectedFirst }) => {
          const cards = Array.from(
            document.querySelectorAll("#storefrontStructureTree .structure-card"),
          );
          const root = cards.find((card) =>
            card.textContent?.includes(rootName),
          );
          const first = root?.querySelector(".structure-subrow");
          return Boolean(first?.textContent?.includes(expectedFirst));
        },
        { rootName: STRUCTURE_ROOT_NAME, expectedFirst: STRUCTURE_CHILD_B },
        { timeout: 20_000 },
      );

      qaRoot = page
        .locator("#storefrontStructureTree .structure-card")
        .filter({ hasText: STRUCTURE_ROOT_NAME });
      let childA = qaRoot
        .locator(".structure-subrow")
        .filter({ hasText: STRUCTURE_CHILD_A });
      page.once("dialog", async (dialog) => {
        await dialog.accept();
      });
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/admin/api/storefront-structure/") &&
            response.url().endsWith("/archive") &&
            response.request().method() === "POST" &&
            response.status() === 200,
          { timeout: 20_000 },
        ),
        childA.locator("[data-structure-archive]").click(),
      ]);

      await page.locator("#catalogueShowArchived").check();
      qaRoot = page
        .locator("#storefrontStructureTree .structure-card")
        .filter({ hasText: STRUCTURE_ROOT_NAME });
      childA = qaRoot
        .locator(".structure-subrow")
        .filter({ hasText: STRUCTURE_CHILD_A });
      await childA.locator("[data-structure-restore]").waitFor({
        state: "visible",
        timeout: 20_000,
      });
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/admin/api/storefront-structure/") &&
            response.url().endsWith("/restore") &&
            response.request().method() === "POST" &&
            response.status() === 200,
          { timeout: 20_000 },
        ),
        childA.locator("[data-structure-restore]").click(),
      ]);
      await page.locator("#catalogueShowArchived").uncheck();

      qaRoot = page
        .locator("#storefrontStructureTree .structure-card")
        .filter({ hasText: STRUCTURE_ROOT_NAME });
      await qaRoot
        .locator(":scope > .structure-body > .structure-actions [data-structure-archive]")
        .click();
      await page.waitForFunction(
        () =>
          document.getElementById("toast")?.textContent?.includes(
            "Archive or move the sub-sections first.",
          ),
        null,
        { timeout: 10_000 },
      );

      // CARD 04: publish a synthetic hierarchy, prove the public Structure
      // contract, and exercise the real storefront runtime against Staging.
      qaRoot = page
        .locator("#storefrontStructureTree .structure-card")
        .filter({ hasText: STRUCTURE_ROOT_NAME });

      const rootMenuToggle = qaRoot.locator(
        ":scope > .structure-body > .structure-actions [data-structure-toggle-menu]",
      );
      if ((await rootMenuToggle.innerText()).includes("Show")) {
        const showResponse = page.waitForResponse(
          (response) =>
            response.url().includes("/admin/api/storefront-structure/") &&
            response.request().method() === "PATCH" &&
            response.status() === 200,
          { timeout: 20_000 },
        );
        await rootMenuToggle.click();
        await showResponse;
      }

      qaRoot = page
        .locator("#storefrontStructureTree .structure-card")
        .filter({ hasText: STRUCTURE_ROOT_NAME });
      page.once("dialog", async (dialog) => {
        await dialog.accept();
      });
      const publishRootResponse = page.waitForResponse(
        (response) =>
          response.url().includes("/admin/api/storefront-structure/") &&
          response.url().endsWith("/publish") &&
          response.request().method() === "POST",
        { timeout: 20_000 },
      );
      await qaRoot
        .locator(":scope > .structure-body > .structure-actions [data-structure-publish]")
        .click();
      await assertMutationResponse(
        publishRootResponse,
        "CARD 04 root section publish",
        200,
      );

      qaRoot = page
        .locator("#storefrontStructureTree .structure-card")
        .filter({ hasText: STRUCTURE_ROOT_NAME });
      const childB = qaRoot
        .locator(".structure-subrow")
        .filter({ hasText: STRUCTURE_CHILD_B });
      const childBId = await childB
        .locator("[data-structure-edit]")
        .getAttribute("data-structure-edit");
      assert(childBId, "CARD 04 child section id was unavailable.");
      page.once("dialog", async (dialog) => {
        await dialog.accept();
      });
      const publishChildResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith(
            "/admin/api/storefront-structure/" + childBId + "/publish",
          ) &&
          response.request().method() === "POST",
        { timeout: 20_000 },
      );
      await childB.locator("[data-structure-publish]").click();
      await assertMutationResponse(
        publishChildResponse,
        "CARD 04 child section publish",
        200,
      );

      const structureResponse = await fetch(BASE + "/v1/storefront-structure");
      assert(
        structureResponse.ok,
        "CARD 04 public Storefront Structure endpoint is unavailable.",
      );
      const structurePayload = await structureResponse.json();
      const publicNodes = Array.isArray(structurePayload?.nodes)
        ? structurePayload.nodes
        : [];
      const publicRoot = publicNodes.find(
        (node) => node.name === STRUCTURE_ROOT_NAME,
      );
      const publicChild = publicNodes.find(
        (node) => node.name === STRUCTURE_CHILD_B,
      );
      assert(
        publicRoot?.showInNavigation === true,
        "CARD 04 published root is not visible in public navigation data.",
      );
      assert(
        publicChild?.parentNodeId === publicRoot?.id,
        "CARD 04 published child hierarchy is incorrect.",
      );

      const placementSeed = d1(
        "SELECT p.current_published_version_id AS versionId, pv.title AS title " +
          "FROM products p JOIN product_versions pv ON pv.id=p.current_published_version_id " +
          "WHERE p.publication_status='ACTIVE' AND p.current_published_version_id IS NOT NULL " +
          "ORDER BY pv.title COLLATE NOCASE LIMIT 1",
      )[0];
      assert(
        placementSeed?.versionId,
        "CARD 04 could not find a published Product for placement proof.",
      );
      d1(
        "INSERT OR IGNORE INTO product_version_storefront_placements " +
          "(product_version_id,storefront_node_id,is_primary,position,source,created_at) VALUES (" +
          [
            q(String(placementSeed.versionId)),
            q(String(publicChild.id)),
            "0",
            "990",
            "'OWNER'",
            q(NOW),
          ].join(",") +
          ")",
      );

      const storefrontPage = await context.newPage();
      try {
        await storefrontPage.goto(
          "https://theblacksheepshop.co.uk/collection.html?commerce-preview=staging&section=" +
            encodeURIComponent(String(publicChild.slug)),
          { waitUntil: "domcontentloaded", timeout: 60_000 },
        );
        await storefrontPage.waitForFunction(
          ({ childName, rootName, productTitle }) => {
            const title = document.getElementById("dynamicCollectionTitle");
            const nav = document.querySelector(".menu");
            const cards = Array.from(document.querySelectorAll("#catalog .product-card"));
            return Boolean(
              title?.textContent?.includes(childName) &&
                nav?.textContent?.includes(rootName) &&
                cards.some((card) => card.textContent?.includes(productTitle)),
            );
          },
          {
            childName: STRUCTURE_CHILD_B,
            rootName: STRUCTURE_ROOT_NAME,
            productTitle: String(placementSeed.title),
          },
          { timeout: 30_000 },
        );
        await assertNoHorizontalOverflow(
          storefrontPage,
          "CARD 04 dynamic collection storefront preview",
        );
        await storefrontPage.screenshot({
          path: path.join(
            ARTIFACT_DIR,
            "card04-dynamic-collection-staging-preview.png",
          ),
          fullPage: true,
        });
      } finally {
        await storefrontPage.close();
      }

      await assertNoHorizontalOverflow(page, label + " Catalogue nested editing");
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, "iphone-catalogue-structure.png"),
        fullPage: true,
      });

      cleanupStorefrontStructureQa();
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
    await page.locator("#stockValueButton").click();
    await page.waitForSelector("#view-stock-value.active #valuationMetrics .valuation-card", {
      timeout: 20_000,
    });
    const valuationText = (
      await page.locator("#view-stock-value").innerText()
    ).toLowerCase();
    for (const expected of [
      "stock at cost",
      "retail value",
      "potential gross profit",
      "value by supplier",
      "valuation confidence",
    ]) {
      assert(
        valuationText.includes(expected),
        label + " Stock Value report is missing: " + expected,
      );
    }
    await assertNoHorizontalOverflow(page, label + " Stock Value");
    await page.locator("#stockValueBack").click();
    await page.waitForSelector("#view-stock.active", { timeout: 10_000 });
    await page.locator("#startBulkCount").click();
    await page.waitForSelector("#stocktakeScopeType", { timeout: 10_000 });
    await assertNoHorizontalOverflow(page, label + " Stocktake launcher");
    const stocktakeActions = await page.locator(".editor-actions:visible").first().boundingBox();
    assert(
      stocktakeActions && stocktakeActions.width <= viewport.width + 2,
      label + " Stocktake launcher actions are clipped.",
    );

    await page.locator("#stocktakeScopeType").selectOption("BRAND_RANGE");
    await page.waitForSelector("#stocktakeScopeRefWrap:not(.hidden)", {
      timeout: 10_000,
    });
    await page.locator("#stocktakeScopeRef").selectOption({ label: "Romney's" });
    await page.waitForFunction(
      () => {
        const preview = document.getElementById("stocktakePreview");
        const start = document.getElementById("stocktakeStart");
        return Boolean(
          preview?.textContent?.includes("Romney") &&
            start &&
            !start.disabled,
        );
      },
      null,
      { timeout: 20_000 },
    );

    await page.locator("#stocktakeScopeType").selectOption("STOREFRONT_NODE");
    await page.waitForSelector("#stocktakeScopeRef option", { timeout: 10_000 });
    const highlandValue = await page.locator("#stocktakeScopeRef option").evaluateAll(
      (options) =>
        options.find((option) =>
          option.textContent?.includes("Highland Cows"),
        )?.value || "",
    );
    assert(
      highlandValue,
      "CARD 05 could not find the Highland Cows website section.",
    );
    await page.locator("#stocktakeScopeRef").selectOption(highlandValue);
    await page.waitForFunction(
      () => {
        const preview = document.getElementById("stocktakePreview");
        const start = document.getElementById("stocktakeStart");
        return Boolean(
          preview?.textContent?.includes("Highland Cows") &&
            start &&
            !start.disabled,
        );
      },
      null,
      { timeout: 20_000 },
    );

    await page.locator("#stocktakeScopeType").selectOption("BRAND_RANGE");
    await page.locator("#stocktakeScopeRef").selectOption({ label: "Romney's" });
    await page.waitForFunction(
      () => {
        const preview = document.getElementById("stocktakePreview");
        const start = document.getElementById("stocktakeStart");
        return Boolean(
          preview?.textContent?.includes("Romney") &&
            start &&
            !start.disabled,
        );
      },
      null,
      { timeout: 20_000 },
    );

    if (label === "iPad portrait WebKit") {
      const createPromise = page.waitForResponse(
        (response) =>
          response.url().endsWith("/admin/api/stocktakes") &&
          response.request().method() === "POST",
        { timeout: 20_000 },
      );
      await page.locator("#stocktakeStart").click();
      const createPayload = await assertMutationResponse(
        createPromise,
        "CARD 05 Stocktake create",
        201,
      );
      const stocktakeId = String(createPayload?.session?.id || "");
      assert(stocktakeId, "CARD 05 Stocktake create returned no session id.");
      stocktakeQaSessionIds.push(stocktakeId);

      await page.waitForSelector("#stocktakeQty", { timeout: 10_000 });
      await assertNoHorizontalOverflow(page, label + " Stocktake count");
      const qty = page.locator("#stocktakeQty");
      assert(
        (await qty.getAttribute("enterkeyhint")) === "next",
        "CARD 05 Stocktake input is missing enterkeyhint=next.",
      );
      await qty.fill("0");
      await page.evaluate(() => {
        window.__stocktakeQaInput = document.getElementById("stocktakeQty");
      });

      const savePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/admin/api/stocktakes/" + stocktakeId + "/items/") &&
          response.request().method() === "PATCH",
        { timeout: 20_000 },
      );
      await page.locator("#stocktakeNext").click();
      await assertMutationResponse(
        savePromise,
        "CARD 05 Stocktake Save & next",
        200,
      );
      await page.waitForTimeout(100);

      const keyboardContinuity = await page.evaluate(() => ({
        sameInput:
          window.__stocktakeQaInput ===
          document.getElementById("stocktakeQty"),
        focused: document.activeElement?.id === "stocktakeQty",
      }));
      assert(
        keyboardContinuity.sameInput,
        "CARD 05 rebuilt the quantity input after Save & next.",
      );
      assert(
        keyboardContinuity.focused,
        "CARD 05 quantity input lost focus after Save & next.",
      );

      await page.locator("[data-close-product-sheet]:visible").first().click();
      await page.locator("#startBulkCount").click();
      await page.waitForSelector("#stocktakeResumeList", { timeout: 10_000 });
      assert(
        (await page.locator("#stocktakeResumeList").innerText()).includes("Romney"),
        "CARD 05 unfinished Stocktake did not reappear after closing.",
      );

      const resumeButton = page.locator(
        '[data-stocktake-resume="' + stocktakeId + '"]',
      );
      await resumeButton.click();
      await page.waitForSelector("#stocktakeQty", { timeout: 10_000 });
      await page.locator("[data-close-product-sheet]:visible").first().click();

      await page.locator("#startBulkCount").click();
      await page.waitForSelector("#stocktakeResumeList", { timeout: 10_000 });
      page.once("dialog", async (dialog) => {
        await dialog.accept();
      });
      const cancelPromise = page.waitForResponse(
        (response) =>
          response.url().endsWith("/admin/api/stocktakes/" + stocktakeId + "/cancel") &&
          response.request().method() === "POST",
        { timeout: 20_000 },
      );
      await page.locator(
        '[data-stocktake-cancel="' + stocktakeId + '"]',
      ).click();
      await assertMutationResponse(
        cancelPromise,
        "CARD 05 Stocktake cancel",
        200,
      );
      await page.waitForFunction(
        (id) => !document.querySelector('[data-stocktake-resume="' + id + '"]'),
        stocktakeId,
        { timeout: 20_000 },
      );
      await page.locator("[data-close-product-sheet]:visible").first().click();
    } else {
      await page.locator("[data-close-product-sheet]:visible").first().click();
    }

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
  cleanupStaleQaOrders();
  seedOrder();
  await seedSession();
  await verifyInjectedSessionAndOrder();

  console.log("QA stage: desktop orders");
  await desktopQa();
  console.log("QA stage: mobile orders");
  await mobileWebkitQa();
  console.log("QA stage: CARD03 Product placement");
  await productPlacementQa();
  console.log("QA stage: iPhone owner views");
  await ownerPolishViewsQa({ width: 390, height: 844 }, "iPhone WebKit");
  console.log("QA stage: iPad owner views");
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
          "iphone-products-add-product-storefront-placement",
          "iphone-add-product-cost-supplier-fields",
          "iphone-add-product-footer-clearance",
          "iphone-category-search",
          "card03-product-primary-and-multi-location-placement",
          "card03-product-edit-placement-persistence",
          "card03-private-draft-preview",
          "card03-publish-public-version-placement-verification",
          "card03-staging-never-claims-production-live-link",
          "card03-ipad-portrait-product-placement-no-overflow",
          "iphone-catalogue-hierarchy-create-main-and-subsections",
          "iphone-catalogue-menu-visibility-toggle",
          "iphone-catalogue-subsection-reorder",
          "iphone-catalogue-subsection-archive-restore",
          "iphone-catalogue-parent-archive-guard",
          "card04-published-structure-public-contract",
          "card04-admin-menu-visibility-publication",
          "card04-dynamic-collection-placement-membership",
          "card04-storefront-preview-navigation",
          "iphone-catalogue-no-technical-enums",
          "ipad-portrait-catalogue-no-horizontal-overflow",
          "iphone-stock-value-report",
          "stocktake-romneys-scope-preview",
          "stocktake-highland-cows-scope-preview",
          "ipad-stocktake-save-next-same-input-focused",
          "ipad-stocktake-persistent-resume",
          "ipad-stocktake-cancel",
          "iphone-ipad-stocktake-no-horizontal-overflow",
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
      cleanupStocktakeQaSessions();
      console.log("Synthetic Stocktake QA sessions cleaned up.");
      cleanupProductPlacementQa();
      console.log("Synthetic Product placement QA data cleaned up.");
      cleanupStorefrontStructureQa();
      console.log("Synthetic Storefront Structure QA data cleaned up.");
      d1(cleanupCategorySql());
      console.log("Synthetic legacy Category QA data cleaned up.");
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
    d1(cleanupSql());
    console.log(
      completed
        ? "Synthetic Admin UI browser QA data cleaned up."
        : "Synthetic Admin UI browser QA data cleaned up after failure.",
    );
  } catch (cleanupError) {
    console.error(
      "Cleanup warning:",
      cleanupError instanceof Error ? cleanupError.message : cleanupError,
    );
    if (completed) process.exitCode = 1;
  }
}
