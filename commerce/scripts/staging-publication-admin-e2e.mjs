import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";

const BASE =
  "https://black-sheep-commerce-api-staging.ky6vfb55p9.workers.dev";
const DB = "black-sheep-commerce-staging";
const RUN_ID = randomBytes(5).toString("hex");
const TITLE = "PHASE 6 PUBLICATION QA " + RUN_ID.toUpperCase();
const SKU = "QA6PUB-" + RUN_ID.toUpperCase();
const DESCRIPTION =
  "Synthetic Phase 6 publication product created through the real staging Admin UI.";
const PRICE = "12.34";
const ARTIFACT_DIR = path.resolve("publication-admin-qa-artifacts");
const PUBLISHED_DIR = path.resolve(ARTIFACT_DIR, "published");
const ARCHIVED_DIR = path.resolve(ARTIFACT_DIR, "archived");
const NOW = new Date().toISOString();

let sessionToken = "";
let sessionHash = "";
let productId = "";
let slug = "";
let completed = false;

fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

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
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      "Wrangler D1 command failed:\n" +
        String(result.stderr || result.stdout || "").slice(-6000),
    );
  }
  const parsed = JSON.parse(result.stdout.trim());
  const blocks = Array.isArray(parsed) ? parsed : [parsed];
  return blocks.flatMap((part) => part.results || []);
}

function runNode(script, args, cwd = process.cwd()) {
  const result = spawnSync(
    process.execPath,
    [script, ...args],
    {
      cwd,
      encoding: "utf8",
      env: process.env,
      maxBuffer: 40 * 1024 * 1024,
    },
  );
  if (result.status !== 0) {
    throw new Error(
      "Node command failed: " +
        script +
        "\n" +
        String(result.stdout || "") +
        "\n" +
        String(result.stderr || ""),
    );
  }
  return String(result.stdout || "");
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
  assert.ok(rows.length && rows[0].email, "No staging owner identity available.");
  return String(rows[0].email);
}

function seedSession() {
  const email = findOwnerEmail();
  sessionToken = randomBytes(32).toString("base64url");
  sessionHash = sha256(sessionToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  d1(
    "INSERT INTO admin_sessions (token_hash,email,expires_at,created_at) VALUES (" +
      [q(sessionHash), q(email), q(expiresAt), q(NOW)].join(",") +
      ")",
  );
}

function findProduct() {
  const rows = d1(
    "SELECT p.id,p.current_slug AS slug,p.publication_status AS publicationStatus," +
      "p.version,v.sku,v.price_minor AS priceMinor " +
      "FROM products p JOIN product_variants v ON v.product_id=p.id " +
      "AND v.is_default=1 AND v.active=1 WHERE v.sku=" +
      q(SKU) +
      " LIMIT 1",
  );
  return rows[0] || null;
}

function cleanup() {
  try {
    if (!productId) {
      const row = findProduct();
      if (row) productId = String(row.id);
    }
    if (productId) {
      d1("DELETE FROM products WHERE id=" + q(productId));
    }
  } catch (error) {
    console.error("Product cleanup failed:", error);
  }
  try {
    if (sessionHash) {
      d1("DELETE FROM admin_sessions WHERE token_hash=" + q(sessionHash));
    }
  } catch (error) {
    console.error("Session cleanup failed:", error);
  }
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

async function publicProduct(id) {
  const response = await fetch(
    BASE + "/v1/catalog/" + encodeURIComponent(id),
    { headers: { accept: "application/json" } },
  );
  let payload = {};
  try {
    payload = await response.json();
  } catch {}
  return { response, payload };
}

function exportAndRender(outDir, expectedCount, requireBaselineParity) {
  fs.mkdirSync(outDir, { recursive: true });
  const catalog = path.join(outDir, "catalog.candidate.js");
  const manifest = path.join(outDir, "publication-manifest.json");
  const exportReport = path.join(outDir, "export-report.json");
  const site = path.join(outDir, "site");
  const renderReport = path.join(outDir, "render-report.json");

  const exportArgs = [
    "--remote",
    "--env",
    "staging",
    "--candidate-out",
    catalog,
    "--manifest-out",
    manifest,
    "--report-out",
    exportReport,
  ];
  if (requireBaselineParity) exportArgs.push("--require-baseline-parity");

  runNode("scripts/phase6-publication-candidate.mjs", exportArgs);

  runNode("scripts/phase6-publication-render.mjs", [
    "--catalog",
    catalog,
    "--manifest",
    manifest,
    "--out-dir",
    site,
    "--report-out",
    renderReport,
  ]);

  const exportData = JSON.parse(fs.readFileSync(exportReport, "utf8"));
  const renderData = JSON.parse(fs.readFileSync(renderReport, "utf8"));

  assert.equal(
    exportData.candidateProducts,
    expectedCount,
    "Unexpected publication candidate Product count.",
  );
  assert.equal(
    renderData.productPages,
    expectedCount,
    "Unexpected rendered Product page count.",
  );
  assert.equal(
    renderData.sitemapProductUrls,
    expectedCount,
    "Unexpected rendered sitemap Product URL count.",
  );

  return { catalog, manifest, site, exportData, renderData };
}

async function runQa() {
  seedSession();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  try {
    await addAdminCookie(context);
    await page.goto(BASE + "/admin#products", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    await page.locator('aside.sidebar [data-nav="products"]').click();
    await page.locator("#view-products.active").waitFor({
      state: "visible",
      timeout: 20_000,
    });
    await page.locator("#productList").waitFor({ state: "visible" });

    const baseline = d1(
      "SELECT COUNT(*) AS count FROM products WHERE publication_status='ACTIVE' " +
        "AND current_published_version_id IS NOT NULL",
    )[0];
    assert.equal(Number(baseline?.count), 146, "Unexpected active staging baseline.");

    await page.locator("#addProduct").click();
    await page.locator("#newProductTitle").waitFor({
      state: "visible",
      timeout: 10_000,
    });
    await page.locator("#newProductTitle").fill(TITLE);
    await page.locator("#newProductPrice").fill(PRICE);
    await page.locator("#newProductType").fill("gifts");
    await page.locator("#newProductSku").fill(SKU);
    await page.locator("#newProductDesc").fill(DESCRIPTION);

    const categories = page.locator(
      "#newProductCategories input[type=checkbox]",
    );
    assert.ok(
      (await categories.count()) > 0,
      "Admin Add Product category choices were not loaded.",
    );
    await categories.first().check();

    await page.locator("#createProductSave").click();
    await page.waitForFunction(
      (title) =>
        document.getElementById("productDetail")?.textContent?.includes(title),
      TITLE,
      { timeout: 20_000 },
    );

    let row = findProduct();
    assert.ok(row, "Admin-created QA Product was not found in staging D1.");
    productId = String(row.id);
    slug = String(row.slug);
    assert.equal(row.publicationStatus, "DRAFT");
    assert.equal(Number(row.priceMinor), 1234);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "01-admin-created-draft.png"),
      fullPage: true,
    });

    await page.locator("#productPublish").waitFor({
      state: "visible",
      timeout: 10_000,
    });
    const publishResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(
          "/admin/api/products/" + encodeURIComponent(productId) + "/publish",
        ) && response.request().method() === "POST",
      { timeout: 20_000 },
    );
    await page.locator("#productPublish").click();
    const publishResponse = await publishResponsePromise;
    assert.ok(
      publishResponse.ok(),
      "Admin Publish request failed with HTTP " + publishResponse.status(),
    );

    row = findProduct();
    assert.ok(row, "Published QA Product disappeared from staging D1.");
    assert.equal(row.publicationStatus, "ACTIVE");

    const publicAfterPublish = await publicProduct(productId);
    assert.equal(
      publicAfterPublish.response.status,
      200,
      "Published Admin Product did not appear in public D1 API.",
    );
    assert.equal(publicAfterPublish.payload?.product?.name, TITLE);
    assert.equal(publicAfterPublish.payload?.product?.slug, slug);
    assert.equal(publicAfterPublish.payload?.product?.priceMinor, 1234);
    assert.equal(
      publicAfterPublish.payload?.product?.purchasable,
      false,
      "New Admin Product should remain safe/non-purchasable until selling controls are enabled.",
    );

    const published = exportAndRender(PUBLISHED_DIR, 147, false);
    assert.ok(
      published.exportData.newProducts.includes(productId),
      "Admin-created Product was not classified as a new publication Product.",
    );
    assert.equal(
      published.renderData.genericPages,
      1,
      "Admin-created Product should use exactly one generic candidate page.",
    );
    assert.equal(
      published.renderData.coreMismatches.length,
      0,
      "Generic candidate page has core publication mismatches.",
    );

    const pagePath = path.join(
      published.site,
      "products",
      slug + ".html",
    );
    assert.ok(fs.existsSync(pagePath), "Published candidate Product page missing.");
    const html = fs.readFileSync(pagePath, "utf8");
    assert.ok(html.includes("<h1>" + TITLE + "</h1>"));
    assert.ok(html.includes("£12.34"));
    assert.ok(
      html.includes(
        '<link rel="canonical" href="https://theblacksheepshop.co.uk/products/' +
          slug +
          '.html">',
      ),
      "Published candidate canonical missing.",
    );
    assert.ok(
      html.includes('"@type":"Product"'),
      "Published candidate Product JSON-LD missing.",
    );
    assert.ok(
      fs
        .readFileSync(path.join(published.site, "sitemap.xml"), "utf8")
        .includes("/products/" + slug + ".html"),
      "Published candidate Product missing from sitemap.",
    );

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "02-admin-published.png"),
      fullPage: true,
    });

    await page.locator("#productArchive").waitFor({
      state: "visible",
      timeout: 10_000,
    });
    const archiveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(
          "/admin/api/products/" + encodeURIComponent(productId) + "/archive",
        ) && response.request().method() === "POST",
      { timeout: 20_000 },
    );
    await page.locator("#productArchive").click();
    const archiveResponse = await archiveResponsePromise;
    assert.ok(
      archiveResponse.ok(),
      "Admin Archive request failed with HTTP " + archiveResponse.status(),
    );

    row = findProduct();
    assert.ok(row, "Archived QA Product was not found in staging D1.");
    assert.equal(row.publicationStatus, "ARCHIVED");

    const publicAfterArchive = await publicProduct(productId);
    assert.equal(
      publicAfterArchive.response.status,
      404,
      "Archived Product remained in public D1 API.",
    );

    const archived = exportAndRender(ARCHIVED_DIR, 146, true);
    assert.equal(
      archived.exportData.newProducts.length,
      0,
      "Archived QA Product remained classified as a publication Product.",
    );
    assert.equal(
      archived.exportData.semanticMismatchCount,
      0,
      "Baseline semantic parity did not return after archive.",
    );
    assert.equal(
      archived.renderData.genericPages,
      0,
      "Archived QA Product still generated a generic page.",
    );
    assert.ok(
      !fs.existsSync(
        path.join(archived.site, "products", slug + ".html"),
      ),
      "Archived QA Product still generated a static page.",
    );
    assert.ok(
      !fs
        .readFileSync(path.join(archived.site, "sitemap.xml"), "utf8")
        .includes("/products/" + slug + ".html"),
      "Archived QA Product remained in generated sitemap.",
    );

    const audit = d1(
      "SELECT event_type AS eventType FROM product_audit_events WHERE product_id=" +
        q(productId) +
        " ORDER BY created_at",
    ).map((entry) => entry.eventType);
    assert.ok(audit.includes("PRODUCT_CREATED"), "PRODUCT_CREATED audit missing.");
    assert.ok(audit.includes("PRODUCT_PUBLISHED"), "PRODUCT_PUBLISHED audit missing.");
    assert.ok(audit.includes("PRODUCT_ARCHIVED"), "PRODUCT_ARCHIVED audit missing.");

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "03-admin-archived.png"),
      fullPage: true,
    });

    completed = true;
    console.log(
      JSON.stringify(
        {
          ok: true,
          runId: RUN_ID,
          productId,
          slug,
          title: TITLE,
          checks: [
            "admin-ui-add-product",
            "draft-created",
            "admin-ui-publish",
            "public-api-after-publish",
            "d1-publication-candidate-147",
            "generic-product-page-generated",
            "candidate-canonical-jsonld-price",
            "candidate-sitemap-inclusion",
            "admin-ui-archive",
            "public-api-404-after-archive",
            "publication-candidate-restored-146",
            "candidate-page-removed-after-archive",
            "candidate-sitemap-removal",
            "audit-created-published-archived",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await context.close();
    await browser.close();
    cleanup();

    const restored = d1(
      "SELECT COUNT(*) AS count FROM products WHERE publication_status='ACTIVE' " +
        "AND current_published_version_id IS NOT NULL",
    )[0];
    if (Number(restored?.count) !== 146) {
      throw new Error(
        "Staging active Product baseline was not restored after QA: " +
          JSON.stringify(restored),
      );
    }
    if (!completed) {
      console.error("Phase 6 publication Admin QA failed; cleanup attempted.");
    }
  }
}

await runQa();
