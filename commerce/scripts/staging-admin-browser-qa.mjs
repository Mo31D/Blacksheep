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
const HOMEPAGE_QA_HEADING = "QA Homepage Rail " + RUN_ID;
const APPEARANCE_QA_HEADING = "QA Appearance " + RUN_ID;
const MEDIA_QA_HEADING = "QA Shared Media " + RUN_ID;
const MEDIA_QA_TITLE = "QA Shared Asset " + RUN_ID;
let homepageQaSnapshot = null;
let appearanceQaSnapshot = null;

let sessionToken = "";
let sessionHash = "";
let sessionOwnerEmail = "";
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

function snapshotHomepageQaState() {
  const rows = d1(
    "SELECT id, current_published_version_id AS publishedVersionId, " +
      "current_draft_version_id AS draftVersionId, version, updated_at AS updatedAt " +
      "FROM homepage_merchandising WHERE id='home_product_rail' LIMIT 1",
  );
  const row = rows[0];
  assert(row, "Homepage merchandising state is unavailable on staging.");
  homepageQaSnapshot = {
    publishedVersionId: row.publishedVersionId == null ? null : String(row.publishedVersionId),
    draftVersionId: row.draftVersionId == null ? null : String(row.draftVersionId),
    version: Number(row.version),
    updatedAt: String(row.updatedAt || ""),
  };
  return homepageQaSnapshot;
}

function cleanupHomepageQa() {
  if (!homepageQaSnapshot) return;
  const versions = d1(
    "SELECT id FROM homepage_merchandising_versions WHERE heading=" + q(HOMEPAGE_QA_HEADING),
  ).map((row) => String(row.id || "")).filter(Boolean);
  if (versions.length) {
    const inList = versions.map(q).join(",");
    d1(
      "DELETE FROM homepage_merchandising_products WHERE version_id IN (" +
        inList +
        "); DELETE FROM homepage_merchandising_modules WHERE version_id IN (" +
        inList +
        "); DELETE FROM homepage_merchandising_versions WHERE id IN (" +
        inList +
        ")",
    );
  }
  d1(
    "DELETE FROM homepage_merchandising_audit_events WHERE after_json LIKE " +
      q("%" + HOMEPAGE_QA_HEADING + "%"),
  );
  d1(
    "UPDATE homepage_merchandising SET current_published_version_id=" +
      (homepageQaSnapshot.publishedVersionId == null
        ? "NULL"
        : q(homepageQaSnapshot.publishedVersionId)) +
      ", current_draft_version_id=" +
      (homepageQaSnapshot.draftVersionId == null
        ? "NULL"
        : q(homepageQaSnapshot.draftVersionId)) +
      ", version=" +
      Number(homepageQaSnapshot.version) +
      ", updated_at=" +
      q(homepageQaSnapshot.updatedAt) +
      " WHERE id='home_product_rail'",
  );
  homepageQaSnapshot = null;
}

function snapshotAppearanceQaState() {
  const rows = d1(
    "SELECT wa.current_published_version_id AS publishedVersionId, " +
      "wa.current_draft_version_id AS draftVersionId, wa.version, wa.updated_at AS updatedAt, " +
      "COALESCE((SELECT MAX(version_number) FROM website_appearance_versions WHERE appearance_id=wa.id),0) AS maxVersionNumber, " +
      "COALESCE((SELECT MAX(rowid) FROM website_appearance_audit_events WHERE appearance_id=wa.id),0) AS maxAuditRowid " +
      "FROM website_appearance wa WHERE wa.id='site_appearance' LIMIT 1",
  );
  const row = rows[0];
  assert(row, "Website Appearance state is unavailable on staging.");
  const published = row.publishedVersionId
    ? d1(
        "SELECT hero_heading AS heroHeading, accent_color AS accentColor, superseded_at AS supersededAt " +
          "FROM website_appearance_versions WHERE id=" + q(String(row.publishedVersionId)) + " LIMIT 1",
      )[0]
    : null;
  appearanceQaSnapshot = {
    publishedVersionId: row.publishedVersionId == null ? null : String(row.publishedVersionId),
    draftVersionId: row.draftVersionId == null ? null : String(row.draftVersionId),
    version: Number(row.version),
    updatedAt: String(row.updatedAt || ""),
    maxVersionNumber: Number(row.maxVersionNumber || 0),
    maxAuditRowid: Number(row.maxAuditRowid || 0),
    publishedHeroHeading: String(published?.heroHeading || ""),
    publishedAccentColor: String(published?.accentColor || ""),
    publishedSupersededAt:
      published?.supersededAt == null ? null : String(published.supersededAt),
  };
  return appearanceQaSnapshot;
}

function cleanupAppearanceQa() {
  if (!appearanceQaSnapshot) return;
  const owner = sessionOwnerEmail ? q(sessionOwnerEmail) : "NULL";
  d1(
    "DELETE FROM website_appearance_audit_events WHERE appearance_id='site_appearance' " +
      "AND rowid>" + Number(appearanceQaSnapshot.maxAuditRowid) +
      (sessionOwnerEmail ? " AND actor_id=" + owner : ""),
  );
  d1(
    "DELETE FROM website_appearance_versions WHERE appearance_id='site_appearance' " +
      "AND version_number>" + Number(appearanceQaSnapshot.maxVersionNumber) +
      (sessionOwnerEmail ? " AND created_by=" + owner : ""),
  );
  if (appearanceQaSnapshot.publishedVersionId) {
    d1(
      "UPDATE website_appearance_versions SET superseded_at=" +
        (appearanceQaSnapshot.publishedSupersededAt == null
          ? "NULL"
          : q(appearanceQaSnapshot.publishedSupersededAt)) +
        " WHERE id=" + q(appearanceQaSnapshot.publishedVersionId),
    );
  }
  d1(
    "UPDATE website_appearance SET current_published_version_id=" +
      (appearanceQaSnapshot.publishedVersionId == null
        ? "NULL"
        : q(appearanceQaSnapshot.publishedVersionId)) +
      ", current_draft_version_id=" +
      (appearanceQaSnapshot.draftVersionId == null
        ? "NULL"
        : q(appearanceQaSnapshot.draftVersionId)) +
      ", version=" + Number(appearanceQaSnapshot.version) +
      ", updated_at=" + q(appearanceQaSnapshot.updatedAt) +
      " WHERE id='site_appearance'",
  );
  appearanceQaSnapshot = null;
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
      sessionOwnerEmail = ownerEmail;
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
    let detailText =
      (await page.locator("#productDetail").textContent()) || "";
    assert(
      detailText.includes("Website placement") &&
        detailText.includes("Primary") &&
        detailText.includes("Also show in") &&
        !detailText.includes("Not selected"),
      "Created Product detail DOM does not contain the selected Storefront placements.",
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
          ?.textContent?.includes("Published and verified in staging"),
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

    const expectedCleanProductUrl =
      "/products/" + encodeURIComponent(String(publicProduct?.slug || ""));
    assert(
      publicProduct?.cleanUrl === expectedCleanProductUrl,
      "CARD 12 Admin-created published Product did not receive a clean URL.",
    );
    const cleanProductResponse = await fetch(
      BASE + expectedCleanProductUrl,
      { redirect: "manual" },
    );
    assert(
      cleanProductResponse.status === 200,
      "CARD 12 clean Product route returned HTTP " +
        cleanProductResponse.status,
    );
    const cleanProductHtml = await cleanProductResponse.text();
    const expectedProductCanonical =
      "https://theblacksheepshop.co.uk" + expectedCleanProductUrl;
    assert(
      cleanProductHtml.includes(
        '<link rel="canonical" href="' + expectedProductCanonical + '">',
      ) &&
        cleanProductHtml.includes("<h1>" + PRODUCT_PLACEMENT_QA_TITLE + "</h1>") &&
        cleanProductHtml.includes('"@type":"Product"'),
      "CARD 12 clean Product page is missing canonical/title/Product structured data.",
    );

    const productAudit = d1(
      "SELECT actor_id AS actorId, after_json AS afterJson, created_at AS createdAt " +
        "FROM product_audit_events WHERE product_id=" + q(productId) +
        " AND event_type='PRODUCT_PUBLISHED' ORDER BY created_at DESC LIMIT 1",
    )[0];
    assert(
      productAudit?.actorId === sessionOwnerEmail &&
        String(productAudit?.afterJson || "").includes(publishedVersionId) &&
        Boolean(productAudit?.createdAt),
      "CARD 10 Product publish audit is missing actor/time/version evidence.",
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

async function homepageMerchandisingQa() {
  snapshotHomepageQaState();
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 820, height: 1180 },
  });
  const page = await context.newPage();

  try {
    await addAdminCookie(context);
    await page.goto(BASE + "/admin#website", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForSelector("#homepageEnabled", { timeout: 20_000 });
    await page.waitForFunction(
      () => Boolean(window.homepageConfig || document.getElementById("homepageStatus")?.textContent),
      null,
      { timeout: 20_000 },
    );

    const publishedBefore = homepageQaSnapshot.publishedVersionId;

    const moduleRows = page.locator("#homepageModules [data-homepage-module]");
    assert(
      (await moduleRows.count()) === 5,
      "CARD 07 Homepage section composer did not render five protected modules.",
    );
    const moduleOrderBefore = await moduleRows.evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-homepage-module")),
    );
    assert(
      moduleOrderBefore.join(",") ===
        "HERO,PRODUCT_RAIL,COLLECTIONS,LOCAL_FAVOURITES,VISIT_SHOP",
      "CARD 07 initial Homepage module order is unexpected: " +
        moduleOrderBefore.join(","),
    );

    await page
      .locator(
        '#homepageModules [data-homepage-module="LOCAL_FAVOURITES"] [data-homepage-module-key="LOCAL_FAVOURITES"][data-homepage-module-move="1"]',
      )
      .click();

    const localToggle = page.locator(
      '[data-homepage-module-enabled="LOCAL_FAVOURITES"]',
    );
    await localToggle.uncheck();

    const moduleOrderAfter = await page
      .locator("#homepageModules [data-homepage-module]")
      .evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("data-homepage-module")),
      );
    assert(
      moduleOrderAfter.slice(0, 3).join(",") ===
        "HERO,PRODUCT_RAIL,COLLECTIONS" &&
        moduleOrderAfter[3] === "VISIT_SHOP" &&
        moduleOrderAfter[4] === "LOCAL_FAVOURITES",
      "CARD 13 Homepage protected order/tail reorder did not update the owner UI.",
    );

    const newArrivals = page.locator(
      'input[name="homepageMode"][value="NEW_ARRIVALS"]',
    );
    await newArrivals.check();
    assert(
      await page.locator("#homepageCollectionWrap").evaluate((el) =>
        el.classList.contains("homepage-hidden"),
      ),
      "CARD 06 New arrivals should not require a collection.",
    );

    const selectedCollection = page.locator(
      'input[name="homepageMode"][value="SELECTED_COLLECTION"]',
    );
    await selectedCollection.check();
    assert(
      !(await page.locator("#homepageCollectionWrap").evaluate((el) =>
        el.classList.contains("homepage-hidden"),
      )),
      "CARD 06 Selected collection controls did not open.",
    );
    assert(
      (await page.locator("#homepageCollection option").count()) > 1,
      "CARD 06 Selected collection has no Storefront choices.",
    );

    const featured = page.locator(
      'input[name="homepageMode"][value="FEATURED_PRODUCTS"]',
    );
    await featured.check();
    assert(
      !(await page.locator("#homepageFeaturedWrap").evaluate((el) =>
        el.classList.contains("homepage-hidden"),
      )),
      "CARD 06 Featured products controls did not open.",
    );

    await page.locator("#homepageHeading").fill(HOMEPAGE_QA_HEADING);
    await page.locator("#homepageEnabled").check();
    await page.locator("#homepageLimit").selectOption("6");
    await page.locator("#homepageProductSearch").fill("Highland");
    await page.waitForFunction(
      () => document.querySelectorAll("#homepageProductResults [data-homepage-add]").length >= 2,
      null,
      { timeout: 20_000 },
    );

    const addButtons = page.locator(
      "#homepageProductResults [data-homepage-add]",
    );
    await addButtons.nth(0).click();
    await page.locator("#homepageProductSearch").fill("Highland");
    await page.waitForFunction(
      () => document.querySelectorAll("#homepageProductResults [data-homepage-add]").length >= 1,
      null,
      { timeout: 20_000 },
    );
    await page
      .locator("#homepageProductResults [data-homepage-add]")
      .first()
      .click();

    const selectedRows = page.locator(
      "#homepageFeaturedProducts [data-homepage-featured]",
    );
    assert(
      (await selectedRows.count()) >= 2,
      "CARD 06 could not select two Featured products.",
    );
    const orderBefore = await selectedRows.evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-homepage-featured")),
    );
    await selectedRows
      .nth(0)
      .locator('[data-homepage-move="1"]')
      .click();
    const orderAfter = await page
      .locator("#homepageFeaturedProducts [data-homepage-featured]")
      .evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("data-homepage-featured")),
      );
    assert(
      orderBefore[0] === orderAfter[1] && orderBefore[1] === orderAfter[0],
      "CARD 06 Featured product reorder did not persist in the owner UI.",
    );

    const savePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/admin/api/homepage-merchandising/draft") &&
        response.request().method() === "PATCH",
      { timeout: 20_000 },
    );
    await page.locator("#homepageSaveDraft").click();
    await assertMutationResponse(
      savePromise,
      "CARD 06 Homepage draft save",
      200,
    );

    const stateAfterDraft = d1(
      "SELECT current_published_version_id AS publishedVersionId, " +
        "current_draft_version_id AS draftVersionId " +
        "FROM homepage_merchandising WHERE id='home_product_rail' LIMIT 1",
    )[0];
    assert(
      String(stateAfterDraft?.publishedVersionId || "") ===
        String(publishedBefore || ""),
      "CARD 06 saving a draft changed the published homepage version.",
    );
    assert(
      stateAfterDraft?.draftVersionId,
      "CARD 06 saving a draft did not create a private draft pointer.",
    );

    const draftModules = d1(
      "SELECT module_key AS moduleKey, enabled, position " +
        "FROM homepage_merchandising_modules WHERE version_id=" +
        q(String(stateAfterDraft.draftVersionId)) +
        " ORDER BY position",
    );
    assert(
      draftModules.length === 5 &&
        draftModules[0]?.moduleKey === "HERO" &&
        draftModules[1]?.moduleKey === "PRODUCT_RAIL" &&
        draftModules[2]?.moduleKey === "COLLECTIONS" &&
        draftModules[3]?.moduleKey === "VISIT_SHOP" &&
        draftModules[4]?.moduleKey === "LOCAL_FAVOURITES",
      "CARD 13 Homepage protected order/tail reorder was not persisted in the private draft.",
    );
    const localDraft = draftModules.find(
      (row) => row.moduleKey === "LOCAL_FAVOURITES",
    );
    assert(
      Number(localDraft?.enabled) === 0,
      "CARD 07 Homepage module visibility was not persisted in the private draft.",
    );

    if (publishedBefore) {
      const publishedModules = d1(
        "SELECT module_key AS moduleKey, enabled, position " +
          "FROM homepage_merchandising_modules WHERE version_id=" +
          q(String(publishedBefore)) +
          " ORDER BY position",
      );
      assert(
        publishedModules[0]?.moduleKey === "HERO" &&
          Number(
            publishedModules.find(
              (row) => row.moduleKey === "LOCAL_FAVOURITES",
            )?.enabled,
          ) === 1,
        "CARD 07 draft module edits leaked into the published Homepage version.",
      );
    }

    const previewPromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/admin/api/homepage-merchandising/preview") &&
        response.request().method() === "GET",
      { timeout: 20_000 },
    );
    await page.locator("#homepagePreview").click();
    await assertMutationResponse(
      previewPromise,
      "CARD 06 Homepage private preview",
      200,
    );
    await page.waitForSelector(".homepage-preview-grid", { timeout: 10_000 });
    const previewText = await page.locator(".product-editor-panel").innerText();
    assert(
      previewText.includes("Private preview") &&
        previewText.includes(HOMEPAGE_QA_HEADING),
      "CARD 06 Private Preview did not render the draft heading.",
    );
    const previewModules = await page
      .locator(".homepage-preview-modules .chip")
      .evaluateAll((chips) => chips.map((chip) => (chip.textContent || "").trim()));
    assert(
      previewModules.join(",") ===
        "Hero & quick links,Product strip,Shop by collection,Visit / shop story",
      "CARD 13 Private Preview did not reflect protected module order/visibility: " +
        previewModules.join(","),
    );
    await page.locator("[data-close-product-sheet]:visible").first().click();

    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    const publishPromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/admin/api/homepage-merchandising/publish") &&
        response.request().method() === "POST",
      { timeout: 20_000 },
    );
    await page.locator("#homepagePublish").click();
    const published = await assertMutationResponse(
      publishPromise,
      "CARD 10 Homepage publish",
      200,
    );
    const homepagePublishedVersion = String(
      published?.config?.publishedVersionId || "",
    );
    assert(
      homepagePublishedVersion,
      "CARD 10 Homepage publish returned no published version.",
    );
    await page.waitForFunction(
      () =>
        document
          .querySelector("#view-website [data-publication-status]")
          ?.textContent?.includes("Published and verified in staging."),
      null,
      { timeout: 20_000 },
    );
    const publicHomepageResponse = await fetch(BASE + "/v1/homepage-merchandising");
    assert(
      publicHomepageResponse.ok,
      "CARD 10 public Homepage endpoint failed after publish.",
    );
    const publicHomepage = await publicHomepageResponse.json();
    assert(
      publicHomepage?.config?.publishedVersionId === homepagePublishedVersion,
      "CARD 10 Homepage public version does not match the published version.",
    );
    const homepageAudit = d1(
      "SELECT actor_id AS actorId, after_json AS afterJson, created_at AS createdAt " +
        "FROM homepage_merchandising_audit_events " +
        "WHERE merchandising_id='home_product_rail' AND event_type='PUBLISHED' " +
        "ORDER BY created_at DESC LIMIT 1",
    )[0];
    assert(
      homepageAudit?.actorId === sessionOwnerEmail &&
        String(homepageAudit?.afterJson || "").includes(homepagePublishedVersion) &&
        Boolean(homepageAudit?.createdAt),
      "CARD 10 Homepage publish audit is missing actor/time/version evidence.",
    );

    await assertNoHorizontalOverflow(page, "CARD 06 Homepage iPad portrait");
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "ipad-card06-homepage-merchandising.png"),
      fullPage: true,
    });
  } finally {
    await context.close();
    await browser.close();
    cleanupHomepageQa();
  }
}

async function websiteAppearanceQa() {
  snapshotAppearanceQaState();
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 820, height: 1180 },
  });
  const page = await context.newPage();

  try {
    await addAdminCookie(context);
    await page.goto(BASE + "/admin#website", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForSelector('[data-website-tab="appearance"]', {
      timeout: 20_000,
    });
    await page.locator('[data-website-tab="appearance"]').click();
    await page.waitForSelector("#websiteAppearancePanel:not(.hidden)", {
      timeout: 20_000,
    });
    await page.waitForFunction(
      () => Boolean(window.appearanceConfig || document.getElementById("appearanceStatus")?.textContent),
      null,
      { timeout: 20_000 },
    );

    const appearanceText = await page.locator("#websiteAppearancePanel").innerText();
    for (const expected of ["Theme", "Homepage hero", "Colours", "Section images"]) {
      assert(
        appearanceText.includes(expected),
        "CARD 08 Appearance workspace is missing: " + expected,
      );
    }
    for (const presetName of [
      "Default",
      "Winter",
      "Christmas",
      "Summer",
      "Ice Cream",
    ]) {
      assert(
        appearanceText.includes(presetName),
        "CARD 09 Appearance preset is missing: " + presetName,
      );
    }
    assert(
      !appearanceText.includes("Custom CSS"),
      "CARD 08 Appearance workspace exposes arbitrary CSS.",
    );

    const publishedBefore = appearanceQaSnapshot.publishedVersionId;

    await page.locator('[data-appearance-preset="CHRISTMAS"]').click();
    assert(
      (await page.locator("#appearancePreset").inputValue()) === "CHRISTMAS",
      "CARD 09 Christmas preset did not become selected.",
    );
    assert(
      (await page.locator("#appearanceAccent").inputValue()).toLowerCase() ===
        "#a47a35" &&
        (await page.locator("#appearanceButton").inputValue()).toLowerCase() ===
          "#1e5239",
      "CARD 09 Christmas preset colours were not applied.",
    );

    await page.locator("#appearanceAccent").evaluate((el) => {
      el.value = "#000000";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.locator("#appearanceResetPreset").click();
    assert(
      (await page.locator("#appearanceAccent").inputValue()).toLowerCase() ===
        "#a47a35",
      "CARD 09 Reset colours to preset did not restore Christmas defaults.",
    );

    await page.locator("#appearanceHeroHeading").fill(APPEARANCE_QA_HEADING);
    await page.locator("#appearanceHeroImage").fill("/images/1.png");
    const sectionImage = page
      .locator("[data-appearance-section-image]")
      .first();
    const sectionImageKey = await sectionImage.getAttribute(
      "data-appearance-section-image",
    );
    assert(sectionImageKey, "CARD 09 has no editable Section image field.");
    await sectionImage.fill("/images/1.png");

    const savePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/admin/api/appearance/draft") &&
        response.request().method() === "PATCH",
      { timeout: 20_000 },
    );
    await page.locator("#appearanceSaveDraft").click();
    const saved = await assertMutationResponse(
      savePromise,
      "CARD 08 Appearance draft save",
      200,
    );
    assert(
      saved?.config?.hero?.heading === APPEARANCE_QA_HEADING,
      "CARD 08 Appearance draft did not persist the Hero heading.",
    );
    assert(
      saved?.config?.presetKey === "CHRISTMAS" &&
        saved?.config?.hero?.imageUrl === "/images/1.png" &&
        String(saved?.config?.tokens?.accent || "").toLowerCase() ===
          "#a47a35" &&
        saved?.config?.sectionImages?.[sectionImageKey] === "/images/1.png",
      "CARD 09 Appearance draft did not persist preset/reset/section imagery.",
    );

    const stateAfterDraft = d1(
      "SELECT current_published_version_id AS publishedVersionId, current_draft_version_id AS draftVersionId " +
        "FROM website_appearance WHERE id='site_appearance' LIMIT 1",
    )[0];
    assert(
      String(stateAfterDraft?.publishedVersionId || "") === String(publishedBefore || ""),
      "CARD 08 Appearance draft changed the published pointer.",
    );
    assert(
      stateAfterDraft?.draftVersionId,
      "CARD 08 Appearance draft did not create a private draft pointer.",
    );

    const previewPromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/admin/api/appearance/preview") &&
        response.request().method() === "GET",
      { timeout: 20_000 },
    );
    await page.locator("#appearancePreview").click();
    await assertMutationResponse(
      previewPromise,
      "CARD 08 Appearance private preview",
      200,
    );
    await page.waitForSelector(".appearance-preview-box", { timeout: 10_000 });
    const previewText = await page.locator(".appearance-preview").innerText();
    assert(
      previewText.includes("Private preview") &&
        previewText.includes(APPEARANCE_QA_HEADING),
      "CARD 08 Appearance Preview does not reflect the draft.",
    );
    await page.locator("[data-close-product-sheet]:visible").first().click();

    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    const publishPromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/admin/api/appearance/publish") &&
        response.request().method() === "POST",
      { timeout: 20_000 },
    );
    await page.locator("#appearancePublish").click();
    const published = await assertMutationResponse(
      publishPromise,
      "CARD 08 Appearance publish",
      200,
    );
    const qaPublishedId = String(published?.config?.publishedVersionId || "");
    assert(qaPublishedId, "CARD 08 Appearance publish returned no published version.");
    await page.waitForFunction(
      () =>
        document
          .querySelector("#view-website [data-publication-status]")
          ?.textContent?.includes("Published and verified in staging."),
      null,
      { timeout: 20_000 },
    );

    const publicAppearanceResponse = await fetch(BASE + "/v1/appearance");
    assert(publicAppearanceResponse.ok, "CARD 08 public Appearance endpoint failed.");
    const publicAppearance = await publicAppearanceResponse.json();
    assert(
      publicAppearance?.contract === "website-appearance-published-v1" &&
        publicAppearance?.config?.hero?.heading === APPEARANCE_QA_HEADING &&
        publicAppearance?.config?.hero?.imageUrl === "/images/1.png" &&
        publicAppearance?.config?.presetKey === "CHRISTMAS" &&
        String(publicAppearance?.config?.tokens?.accent || "").toLowerCase() ===
          "#a47a35" &&
        String(publicAppearance?.config?.tokens?.button || "").toLowerCase() ===
          "#1e5239" &&
        publicAppearance?.config?.sectionImages?.[sectionImageKey] ===
          "/images/1.png",
      "CARD 09 public Appearance contract does not match the seasonal draft.",
    );
    const appearanceAudit = d1(
      "SELECT actor_id AS actorId, after_json AS afterJson, created_at AS createdAt " +
        "FROM website_appearance_audit_events " +
        "WHERE appearance_id='site_appearance' AND event_type='PUBLISHED' " +
        "ORDER BY created_at DESC LIMIT 1",
    )[0];
    assert(
      appearanceAudit?.actorId === sessionOwnerEmail &&
        String(appearanceAudit?.afterJson || "").includes(qaPublishedId) &&
        Boolean(appearanceAudit?.createdAt),
      "CARD 10 Appearance publish audit is missing actor/time/version evidence.",
    );

    const storefront = await context.newPage();
    try {
      await storefront.setViewportSize({ width: 390, height: 844 });
      await storefront.goto(
        "https://theblacksheepshop.co.uk/index.html?commerce-preview=staging",
        { waitUntil: "domcontentloaded", timeout: 60_000 },
      );
      await storefront.waitForFunction(
        () =>
          document.documentElement.dataset.commerceLive === "ready" &&
          window.BLACK_SHEEP_WEBSITE_APPEARANCE?.hero?.heading,
        null,
        { timeout: 30_000 },
      );
      const applied = await storefront.evaluate(() => {
        const media = document.querySelector(".hero-media");
        const image = media?.querySelector("img");
        const imageStyle = image ? getComputedStyle(image) : null;
        const rect = media?.getBoundingClientRect();
        return {
          heading: document.querySelector(".hero h1")?.textContent?.trim() || "",
          heroImage: image?.getAttribute("src") || "",
          imageObjectFit: imageStyle?.objectFit || "",
          imageObjectPosition: imageStyle?.objectPosition || "",
          accent: document.documentElement.style.getPropertyValue("--gold").trim(),
          button: document.documentElement.style.getPropertyValue("--button").trim(),
          contractHeading:
            window.BLACK_SHEEP_WEBSITE_APPEARANCE?.hero?.heading || "",
          presetKey:
            window.BLACK_SHEEP_WEBSITE_APPEARANCE?.presetKey || "",
          mediaHeight: rect?.height || 0,
          viewportWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
        };
      });
      assert(
        applied.heading === APPEARANCE_QA_HEADING &&
          applied.contractHeading === APPEARANCE_QA_HEADING &&
          applied.presetKey === "CHRISTMAS" &&
          applied.heroImage.endsWith("/images/1.png") &&
          applied.imageObjectFit === "cover" &&
          ["50% 50%", "center", "center center"].includes(applied.imageObjectPosition) &&
          applied.accent.toLowerCase() === "#a47a35" &&
          applied.button.toLowerCase() === "#1e5239",
        "CARD 09 storefront did not apply the published preset/Hero: " +
          JSON.stringify(applied),
      );
      assert(
        applied.mediaHeight >= 300 &&
          applied.scrollWidth <= applied.viewportWidth + 2,
        "CARD 09 mobile Hero layout overflowed or collapsed: " +
          JSON.stringify(applied),
      );
    } finally {
      await storefront.close();
    }

    assert(
      publishedBefore,
      "CARD 08 restore proof requires an existing published Appearance version.",
    );
    const restoreButton = page.locator(
      '[data-appearance-restore="' + publishedBefore + '"]',
    );
    await restoreButton.waitFor({ state: "visible", timeout: 20_000 });
    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    const restorePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/admin/api/appearance/restore") &&
        response.request().method() === "POST",
      { timeout: 20_000 },
    );
    await restoreButton.click();
    await assertMutationResponse(
      restorePromise,
      "CARD 08 Appearance restore",
      200,
    );

    const restoredPublicResponse = await fetch(BASE + "/v1/appearance");
    assert(restoredPublicResponse.ok, "CARD 08 restored Appearance endpoint failed.");
    const restoredPublic = await restoredPublicResponse.json();
    assert(
      restoredPublic?.config?.hero?.heading === appearanceQaSnapshot.publishedHeroHeading &&
        String(restoredPublic?.config?.tokens?.accent || "").toLowerCase() ===
          String(appearanceQaSnapshot.publishedAccentColor || "").toLowerCase(),
      "CARD 08 restore did not reproduce the prior published Appearance.",
    );

    await assertNoHorizontalOverflow(page, "CARD 08 Appearance iPad portrait");
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "ipad-card08-website-appearance.png"),
      fullPage: true,
    });
  } finally {
    await context.close();
    await browser.close();
    cleanupAppearanceQa();
  }
}

async function sharedMediaLibraryQa() {
  snapshotAppearanceQaState();
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 820, height: 1180 },
  });
  const page = await context.newPage();
  let assetId = "";
  let assetUrl = "";

  async function adminRequest(pathname, options = {}) {
    const response = await context.request.fetch(BASE + pathname, options);
    const body = await response.json().catch(() => ({}));
    return { response, body };
  }

  try {
    await addAdminCookie(context);
    await page.goto(BASE + "/admin#website", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForSelector('[data-website-tab="media"]', {
      timeout: 20_000,
    });
    await page.locator('[data-website-tab="media"]').click();
    await page.waitForSelector("#websiteMediaPanel:not(.hidden)", {
      timeout: 20_000,
    });

    const mediaText = await page.locator("#websiteMediaPanel").innerText();
    for (const expected of [
      "Add image",
      "Media Library",
      "Upload once",
      "Show archived",
    ]) {
      assert(
        mediaText.includes(expected),
        "CARD 11 Media Library workspace is missing: " + expected,
      );
    }

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z9ZkAAAAASUVORK5CYII=",
      "base64",
    );
    await page.locator("#sharedMediaFile").setInputFiles({
      name: "card11-shared-media-" + RUN_ID + ".png",
      mimeType: "image/png",
      buffer: png,
    });
    await page.locator("#sharedMediaTitle").fill(MEDIA_QA_TITLE);
    await page.locator("#sharedMediaAlt").fill("CARD 11 shared media QA image");
    await page.locator("#sharedMediaContext").selectOption("HOMEPAGE");

    const uploadPromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/admin/api/media") &&
        response.request().method() === "POST",
      { timeout: 20_000 },
    );
    await page.locator("#sharedMediaUpload").click();
    const uploaded = await assertMutationResponse(
      uploadPromise,
      "CARD 11 shared media upload",
      201,
    );
    assetId = String(uploaded?.asset?.id || "");
    assetUrl = String(uploaded?.asset?.publicUrl || "");
    assert(
      assetId && assetUrl.startsWith("/media/"),
      "CARD 11 upload did not return a reusable asset id/public URL.",
    );

    await page.waitForFunction(
      (title) => document.getElementById("sharedMediaGrid")?.textContent?.includes(title),
      MEDIA_QA_TITLE,
      { timeout: 20_000 },
    );

    const updatedAlt = "CARD 11 updated reusable alt " + RUN_ID;
    const patch = await adminRequest(
      "/admin/api/media/" + encodeURIComponent(assetId),
      {
        method: "PATCH",
        data: {
          title: MEDIA_QA_TITLE,
          altText: updatedAlt,
          context: "HOMEPAGE",
        },
      },
    );
    assert(
      patch.response.status() === 200 &&
        patch.body?.asset?.altText === updatedAlt,
      "CARD 11 alt text update failed.",
    );

    await page.locator('[data-website-tab="appearance"]').click();
    await page.waitForSelector("#websiteAppearancePanel:not(.hidden)", {
      timeout: 20_000,
    });
    await page.waitForFunction(
      () => Boolean(document.getElementById("appearanceStatus")?.textContent),
      null,
      { timeout: 20_000 },
    );

    await page.locator("#appearanceHeroChooseMedia").click();
    await page.waitForSelector("#websiteMediaPanel:not(.hidden)", {
      timeout: 20_000,
    });
    const heroUse = page.locator(
      '[data-shared-media-use="' + assetId + '"]',
    );
    await heroUse.waitFor({ state: "visible", timeout: 20_000 });
    await heroUse.click();
    await page.waitForSelector("#websiteAppearancePanel:not(.hidden)", {
      timeout: 20_000,
    });
    assert(
      (await page.locator("#appearanceHeroImage").inputValue()) === assetUrl,
      "CARD 11 shared asset was not selected for the Hero.",
    );

    const sectionChoose = page
      .locator("[data-appearance-section-choose]")
      .first();
    const sectionKey = await sectionChoose.getAttribute(
      "data-appearance-section-choose",
    );
    assert(sectionKey, "CARD 11 has no Section media picker target.");
    await sectionChoose.click();
    await page.waitForSelector("#websiteMediaPanel:not(.hidden)", {
      timeout: 20_000,
    });
    const sectionUse = page.locator(
      '[data-shared-media-use="' + assetId + '"]',
    );
    await sectionUse.waitFor({ state: "visible", timeout: 20_000 });
    await sectionUse.click();
    await page.waitForSelector("#websiteAppearancePanel:not(.hidden)", {
      timeout: 20_000,
    });
    assert(
      (await page
        .locator(
          '[data-appearance-section-image="' + sectionKey + '"]',
        )
        .inputValue()) === assetUrl,
      "CARD 11 shared asset was not reused for a Section.",
    );

    await page.locator("#appearanceHeroHeading").fill(MEDIA_QA_HEADING);
    const savePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/admin/api/appearance/draft") &&
        response.request().method() === "PATCH",
      { timeout: 20_000 },
    );
    await page.locator("#appearanceSaveDraft").click();
    const saved = await assertMutationResponse(
      savePromise,
      "CARD 11 shared media Appearance draft",
      200,
    );
    assert(
      saved?.config?.hero?.imageUrl === assetUrl &&
        saved?.config?.sectionImages?.[sectionKey] === assetUrl,
      "CARD 11 one asset was not reused by both Hero and Section draft surfaces.",
    );

    await page.locator('[data-website-tab="media"]').click();
    await page.waitForSelector("#websiteMediaPanel:not(.hidden)", {
      timeout: 20_000,
    });
    await page.locator("#sharedMediaShowArchived").check();
    const card = page
      .locator(".media-library-card")
      .filter({ hasText: MEDIA_QA_TITLE });
    await card.waitFor({ state: "visible", timeout: 20_000 });

    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    const archivePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith(
          "/admin/api/media/" + encodeURIComponent(assetId) + "/archive",
        ) &&
        response.request().method() === "POST",
      { timeout: 20_000 },
    );
    await card.locator('[data-shared-media-archive="' + assetId + '"]').click();
    await assertMutationResponse(
      archivePromise,
      "CARD 11 shared media archive",
      200,
    );

    const archivedDelivery = await context.request.get(BASE + assetUrl);
    assert(
      archivedDelivery.status() === 200,
      "CARD 11 archive broke the existing public media URL.",
    );

    const blockedDelete = await adminRequest(
      "/admin/api/media/" + encodeURIComponent(assetId),
      { method: "DELETE" },
    );
    assert(
      blockedDelete.response.status() === 409 &&
        blockedDelete.body?.error?.code === "shared_media_delete_blocked" &&
        Array.isArray(blockedDelete.body?.error?.blockers) &&
        blockedDelete.body.error.blockers.includes("appearance_history"),
      "CARD 11 permanent deletion was not blocked by versioned Appearance history.",
    );

    await assertNoHorizontalOverflow(page, "CARD 11 Media Library iPad portrait");
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "ipad-card11-shared-media-library.png"),
      fullPage: true,
    });
  } finally {
    try {
      cleanupAppearanceQa();
      if (assetId) {
        const current = await adminRequest(
          "/admin/api/media?includeArchived=1&q=" + encodeURIComponent(MEDIA_QA_TITLE),
        );
        const asset = (current.body?.assets || []).find((item) => item.id === assetId);
        if (asset?.status === "ACTIVE") {
          await adminRequest(
            "/admin/api/media/" + encodeURIComponent(assetId) + "/archive",
            { method: "POST" },
          );
        }
        const removed = await adminRequest(
          "/admin/api/media/" + encodeURIComponent(assetId),
          { method: "DELETE" },
        );
        assert(
          removed.response.status() === 200,
          "CARD 11 QA asset cleanup could not remove the now-unreferenced R2 object.",
        );
      }
    } finally {
      await context.close();
      await browser.close();
    }
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
        const panel = document.querySelector(
          ".catalog-sheet:not(.hidden) .product-editor-panel",
        );
        const actions = panel?.querySelector(":scope > .editor-actions");
        const choices = Array.from(
          panel?.querySelectorAll(
            "#newProductCategories .category-choice:not(.hidden)",
          ) ?? [],
        );
        const last = choices.at(-1);
        if (!panel || !actions || !last) return null;
        const actionRect = actions.getBoundingClientRect();
        const lastRect = last.getBoundingClientRect();
        return {
          actionTop: actionRect.top,
          actionBottom: actionRect.bottom,
          actionHeight: actionRect.height,
          lastBottom: lastRect.bottom,
          panelTop: panel.getBoundingClientRect().top,
          panelBottom: panel.getBoundingClientRect().bottom,
          viewportHeight: window.innerHeight,
        };
      });
      assert(clearance, label + " Add Product footer clearance could not be measured.");
      assert(
        clearance.actionHeight > 0 &&
          clearance.actionBottom > clearance.actionTop &&
          clearance.actionTop >= clearance.panelTop &&
          clearance.actionBottom <= clearance.panelBottom + 2,
        label +
          " Add Product footer measurement targeted a hidden/wrong action row (" +
          JSON.stringify(clearance) +
          ").",
      );
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
        await page.waitForFunction(
          (rootName) => {
            const cards = Array.from(
              document.querySelectorAll(
                "#storefrontStructureTree .structure-card",
              ),
            );
            const root = cards.find((card) =>
              card.textContent?.includes(rootName),
            );
            const toggle = root?.querySelector(
              ":scope > .structure-body > .structure-actions [data-structure-toggle-menu]",
            );
            const publish = root?.querySelector(
              ":scope > .structure-body > .structure-actions [data-structure-publish]",
            );
            return Boolean(
              toggle?.textContent?.includes("Hide from menu") && publish,
            );
          },
          STRUCTURE_ROOT_NAME,
          { timeout: 20_000 },
        );
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
      await page.waitForFunction(
        () =>
          document
            .querySelector("#view-catalogue [data-publication-status]")
            ?.textContent?.includes("Published and verified in staging."),
        null,
        { timeout: 20_000 },
      );
      const structureState = d1(
        "SELECT current_published_version_id AS publishedVersionId " +
          "FROM storefront_nodes WHERE id=" + q(rootId) + " LIMIT 1",
      )[0];
      const structurePublishedVersion = String(
        structureState?.publishedVersionId || "",
      );
      const structureAudit = d1(
        "SELECT actor_id AS actorId, after_json AS afterJson, created_at AS createdAt " +
          "FROM storefront_audit_events WHERE node_id=" + q(rootId) +
          " AND event_type='NODE_UPDATED' AND reason='Owner published Storefront section' " +
          "ORDER BY created_at DESC LIMIT 1",
      )[0];
      assert(
        structurePublishedVersion &&
          structureAudit?.actorId === sessionOwnerEmail &&
          String(structureAudit?.afterJson || "").includes(structurePublishedVersion) &&
          Boolean(structureAudit?.createdAt),
        "CARD 10 Structure publish audit is missing actor/time/version evidence.",
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

      const cleanStructureResponse = await fetch(BASE + "/v1/storefront-structure");
      assert(
        cleanStructureResponse.ok,
        "CARD 12 public Structure capability endpoint is unavailable.",
      );
      const cleanStructurePayload = await cleanStructureResponse.json();
      assert(
        cleanStructurePayload?.cleanCollectionRoutes === true,
        "CARD 12 clean collection route capability is not enabled on staging.",
      );
      const cleanChild = (cleanStructurePayload?.nodes || []).find(
        (row) => row.id === publicChild.id,
      );
      assert(
        cleanChild?.cleanUrl === "/collections/" + publicChild.slug,
        "CARD 12 published Admin-created section did not receive a clean URL.",
      );

      const cleanCollectionResponse = await fetch(
        BASE + "/collections/" + encodeURIComponent(String(publicChild.slug)),
        { redirect: "manual" },
      );
      assert(
        cleanCollectionResponse.status === 200,
        "CARD 12 clean collection route returned HTTP " +
          cleanCollectionResponse.status,
      );
      const cleanCollectionHtml = await cleanCollectionResponse.text();
      const expectedCanonical =
        "https://theblacksheepshop.co.uk/collections/" +
        encodeURIComponent(String(publicChild.slug));
      assert(
        cleanCollectionHtml.includes(
          '<link rel="canonical" href="' + expectedCanonical + '">',
        ),
        "CARD 12 clean collection canonical is missing or incorrect.",
      );
      assert(
        cleanCollectionHtml.includes(
          '<meta name="robots" content="index,follow,max-image-preview:large">',
        ),
        "CARD 12 clean collection route is not indexable.",
      );
      assert(
        cleanCollectionHtml.includes(String(publicChild.name)) &&
          cleanCollectionHtml.includes(String(placementSeed.title)),
        "CARD 12 clean collection HTML is missing the published section or Product.",
      );

      const dynamicSitemapResponse = await fetch(BASE + "/sitemap.xml");
      assert(
        dynamicSitemapResponse.status === 200,
        "CARD 12 canonical sitemap returned HTTP " +
          dynamicSitemapResponse.status,
      );
      const dynamicSitemapXml = await dynamicSitemapResponse.text();
      assert(
        dynamicSitemapXml.includes(
          "<loc>" + expectedCanonical + "</loc>",
        ),
        "CARD 12 canonical sitemap is missing the published Admin-created section.",
      );
      assert(
        !dynamicSitemapXml.includes("/collections/gifts</loc>"),
        "CARD 12 canonical sitemap duplicated a legacy static collection URL.",
      );
      assert(
        dynamicSitemapXml.includes(
          "<loc>https://theblacksheepshop.co.uk" +
            expectedCleanProductUrl +
            "</loc>",
        ),
        "CARD 12 canonical sitemap is missing the published Admin-created Product.",
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

    await openView("website");
    await page.waitForSelector("#websiteHomepagePanel:not(.hidden)", { timeout: 20_000 });
    await page.waitForFunction(
      () =>
        document.querySelectorAll("#homepageModules [data-homepage-module]").length ===
        5,
      undefined,
      { timeout: 20_000 },
    );
    const homepageModuleRows = await page
      .locator("#homepageModules [data-homepage-module]")
      .evaluateAll((nodes) =>
        nodes.slice(0, 5).map((node) => ({
          key: node.getAttribute("data-homepage-module"),
          text: node.textContent || "",
          moveButtons: node.querySelectorAll("[data-homepage-module-move]").length,
        })),
      );
    assert(
      homepageModuleRows.slice(0, 3).map((row) => row.key).join(",") ===
        "HERO,PRODUCT_RAIL,COLLECTIONS",
      label +
        " Website Homepage order is not fixed as Hero → Product strip → Shop by collection: " +
        JSON.stringify(homepageModuleRows),
    );
    assert(
      homepageModuleRows.slice(0, 3).every((row) => row.moveButtons === 0),
      label + " fixed Homepage rows still expose reorder controls.",
    );
    assert(
      homepageModuleRows.slice(0, 3).every((row) => row.text.includes("Fixed position")),
      label + " fixed Homepage rows do not explain their protected position.",
    );
    for (const tab of ["homepage", "appearance", "media"]) {
      assert(
        (await page.locator('[data-website-tab="' + tab + '"]').count()) === 1,
        label + " Website has a missing or duplicate " + tab + " tab.",
      );
    }
    await assertNoHorizontalOverflow(page, label + " Website Homepage");
    await page.locator('[data-website-tab="appearance"]').click();
    await page.waitForSelector("#websiteAppearancePanel:not(.hidden)", {
      timeout: 10_000,
    });
    await assertNoHorizontalOverflow(page, label + " Website Appearance");
    await page.locator('[data-website-tab="media"]').click();
    await page.waitForSelector("#websiteMediaPanel:not(.hidden)", {
      timeout: 10_000,
    });
    await assertNoHorizontalOverflow(page, label + " Website Media");

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
    await page.waitForFunction(
      () => {
        const select = document.getElementById("stocktakeScopeRef");
        return Boolean(select && select.options && select.options.length > 1);
      },
      null,
      { timeout: 10_000 },
    );
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
  console.log("QA stage: CARD06/07 Homepage merchandising");
  await homepageMerchandisingQa();
  console.log("QA stage: CARD08/09 Website Appearance");
  await websiteAppearanceQa();
  console.log("QA stage: CARD11 Shared Media Library");
  await sharedMediaLibraryQa();
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
          "card06-homepage-three-modes",
          "card06-featured-product-selection-and-reorder",
          "card06-draft-does-not-change-published-version",
          "card06-private-preview",
          "card06-ipad-portrait-no-overflow",
          "card07-five-protected-homepage-modules",
          "card07-module-reorder-private-draft",
          "card07-module-hide-private-draft",
          "card07-draft-does-not-change-published-modules",
          "card07-private-preview-module-layout",
          "card08-appearance-four-safe-cards",
          "card09-five-approved-seasonal-presets",
          "card09-preset-reset-to-approved-defaults",
          "card09-hero-and-section-image-editing",
          "card09-seasonal-publish-public-contract",
          "card09-mobile-hero-no-overflow",
          "card11-media-library-upload-once",
          "card11-alt-text-editable",
          "card11-one-asset-reused-by-hero-and-section",
          "card11-archive-preserves-public-media-url",
          "card11-hard-delete-blocked-by-version-history",
          "card11-unused-r2-object-cleaned-after-qa",
          "card08-appearance-private-draft",
          "card08-appearance-private-preview",
          "card08-appearance-publish-public-contract",
          "card08-storefront-applies-published-tokens-and-hero",
          "card08-appearance-restore",
          "card08-ipad-portrait-no-overflow",
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
      cleanupAppearanceQa();
      console.log("Synthetic Website Appearance QA data cleaned up.");
      cleanupHomepageQa();
      console.log("Synthetic Homepage merchandising QA data cleaned up.");
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
