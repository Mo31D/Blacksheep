import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const BASE = "https://black-sheep-commerce-api-staging.ky6vfb55p9.workers.dev";
const DB = "black-sheep-commerce-staging";
const RUN_ID = String(process.env.GITHUB_RUN_ID || Date.now());
const ORDER_ID = "e2e-" + RUN_ID;
const REF = "E2E-" + RUN_ID;
const CANCEL_ORDER_ID = "e2e-cancel-" + RUN_ID;
const CANCEL_REF = "E2E-CANCEL-" + RUN_ID;
const CUSTOMER_EMAIL = "orders@theblacksheepshop.co.uk";
const NOW = new Date().toISOString();

let sessionHash = null;
let sessionToken = null;
let completed = false;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function sqlQuote(value) {
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function runWrangler(args) {
  const result = spawnSync("npx", ["wrangler", ...args], {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      "Wrangler failed: " +
        args.join(" ") +
        "\n" +
        (result.stderr || result.stdout || "").slice(-4000),
    );
  }
  return result.stdout.trim();
}

function d1(sql) {
  const raw = runWrangler([
    "d1",
    "execute",
    DB,
    "--remote",
    "--env",
    "staging",
    "--command",
    sql,
    "--json",
  ]);
  const parsed = JSON.parse(raw);
  const batches = Array.isArray(parsed) ? parsed : [parsed];
  return batches.flatMap((part) => part.results || []);
}

async function rawRequest(path, options = {}) {
  const method = options.method || "GET";
  const headers = new Headers(options.headers || {});
  if (["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    headers.set("origin", BASE);
  }
  if (options.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(BASE + path, {
    method,
    headers,
    body:
      options.body === undefined
        ? undefined
        : typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body),
    redirect: "manual",
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { response, data, text };
}

async function api(path, options = {}) {
  const method = options.method || "GET";
  const headers = new Headers(options.headers || {});
  if (sessionToken) headers.set("cookie", "bs_admin_session=" + sessionToken);
  const result = await rawRequest(path, {
    ...options,
    method,
    headers,
  });
  if (!result.response.ok) {
    throw new Error(
      method +
        " " +
        path +
        " -> " +
        result.response.status +
        ": " +
        String(result.text).slice(0, 800),
    );
  }
  return result.data;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function cleanupSql() {
  const ids = sqlQuote(ORDER_ID) + "," + sqlQuote(CANCEL_ORDER_ID);
  return [
    "DELETE FROM order_messages WHERE order_id IN (" + ids + ")",
    "DELETE FROM customer_review_tokens WHERE order_id IN (" + ids + ")",
    "DELETE FROM refunds WHERE order_id IN (" + ids + ")",
    "DELETE FROM order_adjustments WHERE revision_id IN (SELECT id FROM order_revisions WHERE order_id IN (" + ids + "))",
    "DELETE FROM order_revision_items WHERE revision_id IN (SELECT id FROM order_revisions WHERE order_id IN (" + ids + "))",
    "DELETE FROM order_revisions WHERE order_id IN (" + ids + ")",
    "DELETE FROM order_events WHERE order_id IN (" + ids + ")",
    "DELETE FROM order_items WHERE order_id IN (" + ids + ")",
    "DELETE FROM orders WHERE id IN (" + ids + ")",
  ].join(";");
}

async function ensureTestSession() {
  const unauth = await rawRequest("/admin/api/orders");
  assert(unauth.response.status === 401, "Admin API must reject an unauthenticated request.");

  let rows = d1(
    "SELECT email FROM admin_sessions ORDER BY created_at DESC LIMIT 1",
  );
  if (!rows.length) {
    rows = d1(
      "SELECT email FROM admin_login_codes ORDER BY created_at DESC LIMIT 1",
    );
  }
  if (!rows.length) {
    const requested = await rawRequest("/admin/auth/request", {
      method: "POST",
    });
    assert(requested.response.ok, "Unable to create an owner login-code record for the staging test.");
    rows = d1(
      "SELECT email FROM admin_login_codes ORDER BY created_at DESC LIMIT 1",
    );
  }
  assert(rows.length && rows[0].email, "No owner identity is available in staging D1.");

  const ownerEmail = String(rows[0].email);
  sessionToken = randomBytes(32).toString("base64url");
  sessionHash = sha256(sessionToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  d1(
    "INSERT INTO admin_sessions (token_hash,email,expires_at,created_at) VALUES (" +
      [
        sqlQuote(sessionHash),
        sqlQuote(ownerEmail),
        sqlQuote(expiresAt),
        sqlQuote(NOW),
      ].join(",") +
      ")",
  );

  const authed = await api("/admin/api/orders");
  assert(Array.isArray(authed.orders), "Injected staging session was not accepted by the real Admin API.");
}

function seedPrimaryOrder() {
  d1(cleanupSql());
  d1(
    "INSERT INTO orders (" +
      "id,public_reference,idempotency_key,status,currency,fulfilment_method," +
      "customer_name,customer_email,items_subtotal_minor,delivery_amount_minor," +
      "final_total_minor,payment_status,created_at,updated_at" +
      ") VALUES (" +
      [
        sqlQuote(ORDER_ID),
        sqlQuote(REF),
        sqlQuote("e2e-idem-" + RUN_ID),
        "'SUBMITTED'",
        "'GBP'",
        "'collection'",
        "'E2E Staging Test'",
        sqlQuote(CUSTOMER_EMAIL),
        "1700",
        "0",
        "NULL",
        "'UNPAID'",
        sqlQuote(NOW),
        sqlQuote(NOW),
      ].join(",") +
      ");" +
      "INSERT INTO order_items (" +
      "order_id,line_number,catalog_product_id,sku,slug,product_name,unit_price_minor,quantity,line_total_minor,options_json,created_at" +
      ") VALUES " +
      "(" +
      [
        sqlQuote(ORDER_ID),
        "1",
        "'e2e-original-a'",
        "'E2E-A'",
        "'e2e-original-a'",
        "'E2E Original A'",
        "500",
        "2",
        "1000",
        "'{}'",
        sqlQuote(NOW),
      ].join(",") +
      "),(" +
      [
        sqlQuote(ORDER_ID),
        "2",
        "'e2e-original-b'",
        "'E2E-B'",
        "'e2e-original-b'",
        "'E2E Original B'",
        "700",
        "1",
        "700",
        "'{}'",
        sqlQuote(NOW),
      ].join(",") +
      ");" +
      "INSERT INTO order_events (order_id,event_type,from_status,to_status,actor_type,actor_id,note,metadata_json,created_at) VALUES (" +
      [
        sqlQuote(ORDER_ID),
        "'ORDER_SUBMITTED'",
        "NULL",
        "'SUBMITTED'",
        "'system'",
        "NULL",
        "'Synthetic staging E2E order'",
        "'{}'",
        sqlQuote(NOW),
      ].join(",") +
      ")",
  );
}

function seedRefundCancelOrder() {
  d1(
    "INSERT INTO orders (" +
      "id,public_reference,idempotency_key,status,currency,fulfilment_method," +
      "customer_name,customer_email,items_subtotal_minor,delivery_amount_minor," +
      "final_total_minor,payment_status,created_at,updated_at,paid_at" +
      ") VALUES (" +
      [
        sqlQuote(CANCEL_ORDER_ID),
        sqlQuote(CANCEL_REF),
        sqlQuote("e2e-cancel-idem-" + RUN_ID),
        "'PAID'",
        "'GBP'",
        "'collection'",
        "'E2E Refund Cancel Test'",
        sqlQuote(CUSTOMER_EMAIL),
        "500",
        "0",
        "500",
        "'PAID'",
        sqlQuote(NOW),
        sqlQuote(NOW),
        sqlQuote(NOW),
      ].join(",") +
      ");" +
      "INSERT INTO order_items (" +
      "order_id,line_number,catalog_product_id,sku,slug,product_name,unit_price_minor,quantity,line_total_minor,options_json,created_at" +
      ") VALUES (" +
      [
        sqlQuote(CANCEL_ORDER_ID),
        "1",
        "'e2e-cancel-item'",
        "'E2E-C'",
        "'e2e-cancel-item'",
        "'E2E Cancel Item'",
        "500",
        "1",
        "500",
        "'{}'",
        sqlQuote(NOW),
      ].join(",") +
      ")",
  );
}

async function main() {
  const health = await rawRequest("/health");
  assert(health.response.ok, "Staging health endpoint failed.");
  assert(health.data?.environment === "staging", "E2E target is not marked as staging.");
  assert(health.data?.database === "bound", "Staging D1 binding is unavailable.");

  await ensureTestSession();
  const reportsBefore = await api("/admin/api/reports?days=30");

  seedPrimaryOrder();

  let order = (await api("/admin/api/orders/" + encodeURIComponent(REF))).order;
  assert(order.status === "SUBMITTED", "Synthetic order did not start as SUBMITTED.");

  order = (
    await api("/admin/api/orders/" + encodeURIComponent(REF) + "/actions", {
      method: "POST",
      body: { action: "start_review" },
    })
  ).order;
  assert(order.status === "UNDER_REVIEW", "start_review did not reach UNDER_REVIEW.");

  const created = await api(
    "/admin/api/orders/" + encodeURIComponent(REF) + "/revisions",
    { method: "POST", body: {} },
  );
  let revision = (
    await api(
      "/admin/api/orders/" +
        encodeURIComponent(REF) +
        "/revisions/" +
        encodeURIComponent(created.revision.id),
    )
  ).revision;
  assert(revision.state === "DRAFT", "Revision was not created as DRAFT.");

  revision = (
    await api(
      "/admin/api/orders/" +
        encodeURIComponent(REF) +
        "/revisions/" +
        encodeURIComponent(revision.id),
      {
        method: "PATCH",
        body: {
          expectedVersion: revision.version,
          customerMessage:
            "Staging E2E: one quantity was reduced and another item was reviewed.",
          internalNote: "Synthetic E2E review.",
          items: [
            {
              lineNumber: 1,
              confirmedQuantity: 1,
              availabilityStatus: "REDUCED",
              customerNote: "Only one is available in this E2E scenario.",
            },
            {
              lineNumber: 2,
              confirmedQuantity: 0,
              availabilityStatus: "UNAVAILABLE",
              customerNote: "Temporarily unavailable in this E2E scenario.",
            },
          ],
        },
      },
    )
  ).revision;
  assert(
    revision.items.some(
      (item) => item.lineNumber === 1 && item.availabilityStatus === "REDUCED",
    ),
    "Reduced-quantity revision state was not saved.",
  );
  assert(
    revision.items.some(
      (item) => item.lineNumber === 2 && item.availabilityStatus === "UNAVAILABLE",
    ),
    "Unavailable revision state was not saved.",
  );

  const catalog = await api("/admin/api/catalog?q=");
  assert(Array.isArray(catalog.products) && catalog.products.length >= 2, "Staging catalogue did not return two purchasable products.");
  const substituteProduct = catalog.products[0];
  const addedProduct = catalog.products.find((product) => product.id !== substituteProduct.id);
  assert(addedProduct, "Could not choose a distinct add-item product.");

  revision = (
    await api(
      "/admin/api/orders/" +
        encodeURIComponent(REF) +
        "/revisions/" +
        encodeURIComponent(revision.id) +
        "/items/2/substitute",
      {
        method: "POST",
        body: {
          expectedVersion: revision.version,
          catalogProductId: substituteProduct.id,
          quantity: 1,
        },
      },
    )
  ).revision;
  assert(
    revision.items.some(
      (item) => item.lineNumber === 2 && item.availabilityStatus === "SUBSTITUTE",
    ),
    "Substitute product was not applied.",
  );

  revision = (
    await api(
      "/admin/api/orders/" +
        encodeURIComponent(REF) +
        "/revisions/" +
        encodeURIComponent(revision.id) +
        "/items/2/reset",
      {
        method: "POST",
        body: { expectedVersion: revision.version },
      },
    )
  ).revision;
  assert(
    revision.items.some(
      (item) =>
        item.lineNumber === 2 &&
        item.catalogProductId === "e2e-original-b" &&
        item.availabilityStatus === "CONFIRMED",
    ),
    "Restore-original did not restore line 2.",
  );

  revision = (
    await api(
      "/admin/api/orders/" +
        encodeURIComponent(REF) +
        "/revisions/" +
        encodeURIComponent(revision.id) +
        "/items",
      {
        method: "POST",
        body: {
          expectedVersion: revision.version,
          catalogProductId: addedProduct.id,
          quantity: 1,
        },
      },
    )
  ).revision;
  const addedLine = revision.items.find(
    (item) =>
      item.catalogProductId === addedProduct.id &&
      item.availabilityStatus === "ADDED",
  );
  assert(addedLine, "Add-item flow did not create an ADDED line.");

  revision = (
    await api(
      "/admin/api/orders/" +
        encodeURIComponent(REF) +
        "/revisions/" +
        encodeURIComponent(revision.id) +
        "/items/" +
        addedLine.lineNumber,
      {
        method: "DELETE",
        body: { expectedVersion: revision.version },
      },
    )
  ).revision;
  assert(
    !revision.items.some((item) => item.lineNumber === addedLine.lineNumber),
    "Remove-added-item flow left the added line behind.",
  );

  async function addAdjustment(kind, label, amountMinor) {
    revision = (
      await api(
        "/admin/api/orders/" +
          encodeURIComponent(REF) +
          "/revisions/" +
          encodeURIComponent(revision.id) +
          "/adjustments",
        {
          method: "POST",
          body: {
            expectedVersion: revision.version,
            kind,
            label,
            amountMinor,
            internalReason: "Synthetic staging E2E adjustment.",
          },
        },
      )
    ).revision;
  }

  await addAdjustment("DISCOUNT", "E2E stock discount", -100);
  await addAdjustment("SURCHARGE", "E2E handling surcharge", 50);
  await addAdjustment("MANUAL_CORRECTION", "E2E temporary correction", 25);
  const manual = revision.adjustments.find(
    (adjustment) => adjustment.label === "E2E temporary correction",
  );
  assert(manual, "Manual correction was not persisted.");
  revision = (
    await api(
      "/admin/api/orders/" +
        encodeURIComponent(REF) +
        "/revisions/" +
        encodeURIComponent(revision.id) +
        "/adjustments/" +
        manual.id,
      {
        method: "DELETE",
        body: { expectedVersion: revision.version },
      },
    )
  ).revision;
  assert(
    revision.adjustmentAmountMinor === -50,
    "Adjustment total should be -50 minor units after removing the temporary correction.",
  );

  revision = (
    await api(
      "/admin/api/orders/" +
        encodeURIComponent(REF) +
        "/revisions/" +
        encodeURIComponent(revision.id),
      {
        method: "PATCH",
        body: {
          expectedVersion: revision.version,
          fulfilmentMethod: "delivery",
          deliveryAmountMinor: 300,
          deliveryAddress: {
            line1: "1 E2E Test Street",
            town: "Ambleside",
            postcode: "LA22 9ZZ",
            country: "GB",
          },
        },
      },
    )
  ).revision;
  assert(revision.fulfilmentMethod === "delivery", "Collection→delivery revision failed.");

  revision = (
    await api(
      "/admin/api/orders/" +
        encodeURIComponent(REF) +
        "/revisions/" +
        encodeURIComponent(revision.id),
      {
        method: "PATCH",
        body: {
          expectedVersion: revision.version,
          fulfilmentMethod: "collection",
          deliveryAmountMinor: 0,
          deliveryAddress: null,
        },
      },
    )
  ).revision;
  assert(revision.fulfilmentMethod === "collection", "Delivery→collection revision failed.");

  revision = (
    await api(
      "/admin/api/orders/" +
        encodeURIComponent(REF) +
        "/revisions/" +
        encodeURIComponent(revision.id) +
        "/send",
      {
        method: "POST",
        body: { expectedVersion: revision.version },
      },
    )
  ).revision;
  assert(revision.state === "SENT", "Finalized revision did not enter SENT state.");
  assert(revision.finalTotalMinor === 1150, "Reviewed final total was expected to be £11.50.");

  order = (
    await api("/admin/api/orders/" + encodeURIComponent(REF) + "/actions", {
      method: "POST",
      body: {
        action: "send_payment_request",
        paymentProvider: "e2e",
        paymentReference: "E2E-" + RUN_ID,
        paymentRequestUrl: "https://example.com/e2e-payment",
        fulfilmentMessage: "Synthetic E2E collection timing.",
      },
    })
  ).order;
  assert(
    order.status === "AWAITING_PAYMENT" &&
      order.paymentStatus === "PAYMENT_REQUESTED",
    "Payment request flow did not reach AWAITING_PAYMENT/PAYMENT_REQUESTED.",
  );

  const knownToken = randomBytes(36).toString("base64url");
  const knownTokenHash = sha256(knownToken);
  const tokenId = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  d1(
    "UPDATE customer_review_tokens SET revoked_at=" +
      sqlQuote(NOW) +
      " WHERE order_id=" +
      sqlQuote(ORDER_ID) +
      " AND revoked_at IS NULL;" +
      "INSERT INTO customer_review_tokens (id,order_id,revision_id,token_hash,expires_at,revoked_at,last_used_at,created_at) VALUES (" +
      [
        sqlQuote(tokenId),
        sqlQuote(ORDER_ID),
        sqlQuote(revision.id),
        sqlQuote(knownTokenHash),
        sqlQuote(expiresAt),
        "NULL",
        "NULL",
        sqlQuote(NOW),
      ].join(",") +
      ")",
  );

  const reviewPage = await rawRequest("/review/" + encodeURIComponent(knownToken));
  assert(reviewPage.response.status === 200, "Customer review page did not render.");
  assert(reviewPage.text.includes("E2E stock discount"), "Customer review omitted the discount label.");
  assert(reviewPage.text.includes("-£1.00"), "Customer review omitted the signed discount amount.");
  assert(reviewPage.text.includes("E2E handling surcharge"), "Customer review omitted the surcharge label.");
  assert(reviewPage.text.includes("£0.50"), "Customer review omitted the surcharge amount.");
  assert(reviewPage.text.includes("£11.50"), "Customer review omitted the exact reviewed total.");
  assert(!reviewPage.text.includes(CUSTOMER_EMAIL), "Customer review exposed customer contact details.");

  const question = await rawRequest(
    "/review/" + encodeURIComponent(knownToken) + "/question",
    {
      method: "POST",
      body: { message: "Synthetic staging E2E question — no action required." },
    },
  );
  assert(question.response.status === 201, "Customer question flow failed.");

  const accepted = await rawRequest(
    "/review/" + encodeURIComponent(knownToken) + "/accept",
    { method: "POST", body: {} },
  );
  assert(accepted.response.ok, "Customer accept flow failed.");
  assert(
    accepted.data?.paymentRequestUrl === "https://example.com/e2e-payment",
    "Customer accept returned the wrong payment target.",
  );

  const acceptedAgain = await rawRequest(
    "/review/" + encodeURIComponent(knownToken) + "/accept",
    { method: "POST", body: {} },
  );
  assert(acceptedAgain.response.ok, "Idempotent second customer accept failed.");

  order = (
    await api("/admin/api/orders/" + encodeURIComponent(REF) + "/actions", {
      method: "POST",
      body: { action: "mark_paid", paymentReference: "E2E-PAID-" + RUN_ID },
    })
  ).order;
  assert(order.status === "PAID" && order.paymentStatus === "PAID", "mark_paid failed.");

  order = (
    await api("/admin/api/orders/" + encodeURIComponent(REF) + "/actions", {
      method: "POST",
      body: { action: "start_preparing" },
    })
  ).order;
  assert(order.status === "PREPARING", "start_preparing failed.");

  order = (
    await api("/admin/api/orders/" + encodeURIComponent(REF) + "/actions", {
      method: "POST",
      body: { action: "ready_for_collection" },
    })
  ).order;
  assert(order.status === "READY_FOR_COLLECTION", "ready_for_collection failed.");

  order = (
    await api("/admin/api/orders/" + encodeURIComponent(REF) + "/actions", {
      method: "POST",
      body: { action: "complete" },
    })
  ).order;
  assert(order.status === "COMPLETED", "complete order failed.");

  const partialBody = {
    amountMinor: 100,
    reasonCode: "GOODWILL",
    refundMethod: "OTHER",
    externalReference: "E2E-PARTIAL-" + RUN_ID,
    internalNote: "Synthetic staging E2E partial refund.",
    idempotencyKey: "e2e:" + RUN_ID + ":partial",
  };
  let refund = await api(
    "/admin/api/orders/" + encodeURIComponent(REF) + "/refunds",
    { method: "POST", body: partialBody },
  );
  assert(
    refund.refunds.refundedMinor === 100 &&
      refund.refunds.idempotentReplay === false,
    "Partial refund ledger write failed.",
  );

  const replay = await api(
    "/admin/api/orders/" + encodeURIComponent(REF) + "/refunds",
    { method: "POST", body: partialBody },
  );
  assert(
    replay.refunds.idempotentReplay === true &&
      replay.refunds.refundedMinor === 100,
    "Refund idempotency replay failed.",
  );

  const remaining = Number(replay.refunds.remainingRefundableMinor);
  refund = await api(
    "/admin/api/orders/" + encodeURIComponent(REF) + "/refunds",
    {
      method: "POST",
      body: {
        amountMinor: remaining,
        reasonCode: "PRICE_CORRECTION",
        refundMethod: "OTHER",
        externalReference: "E2E-FULL-" + RUN_ID,
        internalNote: "Synthetic staging E2E final refund.",
        idempotencyKey: "e2e:" + RUN_ID + ":full",
      },
    },
  );
  assert(refund.refunds.fullyRefunded === true, "Full cumulative refund failed.");
  assert(
    refund.order.status === "COMPLETED" &&
      refund.order.paymentStatus === "REFUNDED",
    "Refund-after-completion did not preserve COMPLETED while refunding payment.",
  );

  seedRefundCancelOrder();
  const cancelRefund = await api(
    "/admin/api/orders/" + encodeURIComponent(CANCEL_REF) + "/refunds",
    {
      method: "POST",
      body: {
        amountMinor: 500,
        reasonCode: "CUSTOMER_CANCELLED",
        refundMethod: "OTHER",
        externalReference: "E2E-CANCEL-" + RUN_ID,
        internalNote: "Synthetic staging E2E refund-and-cancel.",
        idempotencyKey: "e2e:" + RUN_ID + ":cancel",
        cancelOrder: true,
      },
    },
  );
  assert(
    cancelRefund.refunds.fullyRefunded === true &&
      cancelRefund.order.status === "CANCELLED" &&
      cancelRefund.order.paymentStatus === "REFUNDED",
    "Refund-and-cancel scenario failed.",
  );

  const messages = await api(
    "/admin/api/orders/" + encodeURIComponent(REF) + "/messages",
  );
  assert(
    Array.isArray(messages.messages) &&
      messages.messages.some((message) => message.kind === "CUSTOMER_QUESTION"),
    "Customer question is missing from admin message history.",
  );

  const eventRows = d1(
    "SELECT event_type AS eventType FROM order_events WHERE order_id=" +
      sqlQuote(ORDER_ID) +
      " ORDER BY id",
  );
  const eventTypes = new Set(eventRows.map((row) => row.eventType));
  for (const requiredEvent of [
    "ORDER_REVISION_DRAFT_CREATED",
    "ORDER_REVISION_UPDATED",
    "ORDER_REVISION_ADJUSTMENT_ADDED",
    "ORDER_REVISION_ADJUSTMENT_REMOVED",
    "ORDER_REVISION_SENT",
    "ORDER_REVISION_ACCEPTED",
    "PAYMENT_CONFIRMED",
    "ORDER_READY_FOR_COLLECTION",
    "ORDER_COMPLETED",
    "PAYMENT_PARTIALLY_REFUNDED",
    "PAYMENT_REFUNDED",
  ]) {
    assert(eventTypes.has(requiredEvent), "Missing audit event: " + requiredEvent);
  }

  const refundRows = d1(
    "SELECT amount_minor AS amountMinor FROM refunds WHERE order_id=" +
      sqlQuote(ORDER_ID) +
      " ORDER BY created_at",
  );
  assert(refundRows.length === 2, "Expected exactly two primary-order refund ledger rows.");
  assert(
    refundRows.reduce((sum, row) => sum + Number(row.amountMinor), 0) === 1150,
    "Primary-order refund ledger total should equal £11.50.",
  );

  const reportsAfter = await api("/admin/api/reports?days=30");
  assert(reportsAfter?.summary, "Reports endpoint did not return a summary.");
  assert(
    Number(reportsAfter.summary.refundedMinor) >=
      Number(reportsBefore.summary?.refundedMinor || 0) + 1650,
    "Reports did not include the E2E refund totals.",
  );
  assert(
    Number(reportsAfter.summary.grossRevenueMinor) >=
      Number(reportsBefore.summary?.grossRevenueMinor || 0) + 1650,
    "Reports did not include the E2E gross paid/refunded totals.",
  );

  completed = true;
  console.log(
    JSON.stringify(
      {
        ok: true,
        primaryReference: REF,
        refundCancelReference: CANCEL_REF,
        checks: [
          "admin-session-validation",
          "start-review",
          "revision-reduce-unavailable",
          "substitute-restore",
          "add-remove-item",
          "discount-surcharge-manual-correction",
          "collection-delivery-collection",
          "revision-send",
          "payment-request",
          "customer-review-render",
          "customer-question",
          "customer-accept-idempotency",
          "mark-paid-preparing-ready-complete",
          "partial-refund",
          "refund-idempotency",
          "full-refund-after-completion",
          "refund-and-cancel",
          "message-history",
          "audit-events",
          "reports-refund-gross-revenue",
        ],
        webhookTelemetry: "BLOCKED: staging RESEND_WEBHOOK_SECRET is not configured",
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} catch (error) {
  console.error("STAGING E2E FAILED:", error instanceof Error ? error.message : error);
  console.error("Synthetic references preserved for investigation:", REF, CANCEL_REF);
  process.exitCode = 1;
} finally {
  try {
    if (sessionHash) {
      d1("DELETE FROM admin_sessions WHERE token_hash=" + sqlQuote(sessionHash));
    }
    if (completed) {
      d1(cleanupSql());
      console.log("Synthetic staging E2E order data cleaned up.");
    }
  } catch (cleanupError) {
    console.error(
      "Cleanup warning:",
      cleanupError instanceof Error ? cleanupError.message : cleanupError,
    );
    if (completed) process.exitCode = 1;
  }
}
