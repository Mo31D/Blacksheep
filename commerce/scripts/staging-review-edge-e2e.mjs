import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const BASE = "https://black-sheep-commerce-api-staging.ky6vfb55p9.workers.dev";
const DB = "black-sheep-commerce-staging";
const RUN_ID = String(process.env.GITHUB_RUN_ID || Date.now());
const A_ID = "e2e-review-a-" + RUN_ID;
const A_REF = "E2E-REVIEW-A-" + RUN_ID;
const B_ID = "e2e-review-b-" + RUN_ID;
const B_REF = "E2E-REVIEW-B-" + RUN_ID;
const NOW = new Date().toISOString();
let completed = false;

function assert(value, message) {
  if (!value) throw new Error(message);
}

function q(value) {
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function runWrangler(sql) {
  const r = spawnSync(
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
    { encoding: "utf8", env: process.env, maxBuffer: 8 * 1024 * 1024 },
  );
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || "wrangler failed").slice(-3000));
  }
  const parsed = JSON.parse(r.stdout.trim());
  const batches = Array.isArray(parsed) ? parsed : [parsed];
  return batches.flatMap((part) => part.results || []);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function token() {
  return randomBytes(36).toString("base64url");
}

async function post(path, body) {
  const response = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
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

async function get(path) {
  const response = await fetch(BASE + path, { redirect: "manual" });
  return { response, text: await response.text() };
}

function cleanup() {
  const ids = q(A_ID) + "," + q(B_ID);
  runWrangler(
    [
      "DELETE FROM customer_review_tokens WHERE order_id IN (" + ids + ")",
      "DELETE FROM order_messages WHERE order_id IN (" + ids + ")",
      "DELETE FROM order_adjustments WHERE revision_id IN (SELECT id FROM order_revisions WHERE order_id IN (" + ids + "))",
      "DELETE FROM order_revision_items WHERE revision_id IN (SELECT id FROM order_revisions WHERE order_id IN (" + ids + "))",
      "DELETE FROM order_revisions WHERE order_id IN (" + ids + ")",
      "DELETE FROM order_events WHERE order_id IN (" + ids + ")",
      "DELETE FROM order_items WHERE order_id IN (" + ids + ")",
      "DELETE FROM orders WHERE id IN (" + ids + ")",
    ].join(";"),
  );
}

function seedOrder(id, ref, revisions) {
  runWrangler(
    "INSERT INTO orders (" +
      "id,public_reference,idempotency_key,data_class,status,currency,fulfilment_method," +
      "customer_name,customer_email,items_subtotal_minor,delivery_amount_minor," +
      "final_total_minor,payment_status,payment_request_url,fulfilment_message,created_at,updated_at" +
      ") VALUES (" +
      [
        q(id),
        q(ref),
        q("edge-idem-" + ref),
        "'E2E'",
        "'AWAITING_PAYMENT'",
        "'GBP'",
        "'collection'",
        "'E2E Review Edge'",
        "'orders@theblacksheepshop.co.uk'",
        "500",
        "0",
        "500",
        "'PAYMENT_REQUESTED'",
        "'https://example.com/e2e-review-payment'",
        "'Synthetic staging edge-case review'",
        q(NOW),
        q(NOW),
      ].join(",") +
      ");" +
      "INSERT INTO order_items (" +
      "order_id,line_number,catalog_product_id,sku,slug,product_name,unit_price_minor,quantity,line_total_minor,options_json,created_at" +
      ") VALUES (" +
      [
        q(id),
        "1",
        q("edge-item-" + ref),
        "'EDGE'",
        q("edge-item-" + ref),
        q("Edge item " + ref),
        "500",
        "1",
        "500",
        "'{}'",
        q(NOW),
      ].join(",") +
      ");" +
      revisions
        .map((revision) => {
          return (
            "INSERT INTO order_revisions (" +
            "id,order_id,revision_number,state,version,currency,items_subtotal_minor,delivery_amount_minor,adjustment_amount_minor,final_total_minor,customer_message,internal_note,created_by,created_at,sent_at,superseded_at,fulfilment_method" +
            ") VALUES (" +
            [
              q(revision.id),
              q(id),
              String(revision.number),
              q(revision.state),
              String(revision.version || 1),
              "'GBP'",
              "500",
              "0",
              "0",
              "500",
              q(revision.message),
              "'Synthetic staging edge-case'",
              "'e2e'",
              q(NOW),
              revision.state === "SENT" ? q(NOW) : "NULL",
              revision.state === "SUPERSEDED" ? q(NOW) : "NULL",
              "'collection'",
            ].join(",") +
            ");" +
            "INSERT INTO order_revision_items (" +
            "revision_id,line_number,source_order_item_id,catalog_product_id,sku,slug,product_name,unit_price_minor,requested_quantity,confirmed_quantity,availability_status,reason_code,customer_note,internal_note,line_total_minor,created_at,updated_at" +
            ") VALUES (" +
            [
              q(revision.id),
              "1",
              "NULL",
              q("edge-item-" + ref),
              "'EDGE'",
              q("edge-item-" + ref),
              q("Edge item " + ref),
              "500",
              "1",
              "1",
              "'CONFIRMED'",
              "NULL",
              "NULL",
              "NULL",
              "500",
              q(NOW),
              q(NOW),
            ].join(",") +
            ")"
          );
        })
        .join(";"),
  );
}

function insertReviewToken(orderId, revisionId, rawToken) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  runWrangler(
    "INSERT INTO customer_review_tokens (" +
      "id,order_id,revision_id,token_hash,expires_at,revoked_at,last_used_at,created_at" +
      ") VALUES (" +
      [
        q(randomUUID()),
        q(orderId),
        q(revisionId),
        q(hash(rawToken)),
        q(expires),
        "NULL",
        "NULL",
        q(NOW),
      ].join(",") +
      ")",
  );
}

async function main() {
  cleanup();

  const declineRevision = "rev-edge-a-" + RUN_ID;
  seedOrder(A_ID, A_REF, [
    {
      id: declineRevision,
      number: 1,
      state: "SENT",
      version: 1,
      message: "Decline-flow review",
    },
  ]);
  const declineToken = token();
  insertReviewToken(A_ID, declineRevision, declineToken);

  const pageA = await get("/review/" + encodeURIComponent(declineToken));
  assert(pageA.response.status === 200, "Decline test review page should be available.");
  assert(pageA.text.includes(A_REF), "Decline test token rendered the wrong order.");

  const declined = await post(
    "/review/" + encodeURIComponent(declineToken) + "/decline",
    {},
  );
  assert(declined.response.ok, "Customer decline request failed.");

  const declineState = runWrangler(
    "SELECT o.status,o.payment_status AS paymentStatus,r.state AS revisionState,t.revoked_at AS revokedAt " +
      "FROM orders o JOIN order_revisions r ON r.order_id=o.id " +
      "JOIN customer_review_tokens t ON t.revision_id=r.id " +
      "WHERE o.id=" +
      q(A_ID) +
      " LIMIT 1",
  )[0];
  assert(declineState.status === "UNDER_REVIEW", "Decline did not return the order to UNDER_REVIEW.");
  assert(declineState.paymentStatus === "UNPAID", "Decline did not clear PAYMENT_REQUESTED.");
  assert(declineState.revisionState === "DECLINED", "Revision did not enter DECLINED.");
  assert(Boolean(declineState.revokedAt), "Decline did not revoke the customer-review token.");

  const afterDecline = await get("/review/" + encodeURIComponent(declineToken));
  assert(afterDecline.response.status === 404, "Declined token should no longer be usable.");

  const oldRevision = "rev-edge-b-old-" + RUN_ID;
  const currentRevision = "rev-edge-b-current-" + RUN_ID;
  seedOrder(B_ID, B_REF, [
    {
      id: oldRevision,
      number: 1,
      state: "SUPERSEDED",
      version: 2,
      message: "Superseded review",
    },
    {
      id: currentRevision,
      number: 2,
      state: "SENT",
      version: 1,
      message: "Current review",
    },
  ]);

  const oldToken = token();
  const currentToken = token();
  insertReviewToken(B_ID, oldRevision, oldToken);
  insertReviewToken(B_ID, currentRevision, currentToken);

  const oldPage = await get("/review/" + encodeURIComponent(oldToken));
  assert(oldPage.response.status === 404, "Superseded revision token should be rejected.");

  const currentPage = await get("/review/" + encodeURIComponent(currentToken));
  assert(currentPage.response.status === 200, "Current revision token should be accepted.");
  assert(currentPage.text.includes(B_REF), "Current token rendered the wrong order.");
  assert(!currentPage.text.includes(A_REF), "Current token leaked another order reference.");
  assert(currentPage.text.includes("Current review"), "Current revision message was not rendered.");
  assert(!currentPage.text.includes("Superseded review"), "Superseded revision content leaked into the current review.");

  completed = true;
  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          "customer-decline-e2e",
          "decline-clears-payment-request",
          "decline-revokes-token",
          "declined-token-rejected",
          "superseded-token-rejected",
          "current-revision-token-accepted",
          "cross-order-reference-isolation",
          "superseded-content-not-leaked",
        ],
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} catch (error) {
  console.error("REVIEW EDGE E2E FAILED:", error instanceof Error ? error.message : error);
  console.error("Synthetic references preserved for investigation:", A_REF, B_REF);
  process.exitCode = 1;
} finally {
  if (completed) {
    try {
      cleanup();
      console.log("Synthetic review edge-case data cleaned up.");
    } catch (error) {
      console.error("Cleanup warning:", error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }
}
