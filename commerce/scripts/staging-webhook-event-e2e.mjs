import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

const BASE =
  "https://black-sheep-commerce-api-staging.ky6vfb55p9.workers.dev";
const DB = "black-sheep-commerce-staging";
const RUN_ID = String(process.env.GITHUB_RUN_ID || Date.now());
const ORDER_ID = "webhook-e2e-" + RUN_ID;
const REF = "E2E-WEBHOOK-" + RUN_ID;
const NOW = new Date().toISOString();

let sessionHash = "";
let sessionToken = "";

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanupSession() {
  if (!sessionHash) return;
  d1("DELETE FROM admin_sessions WHERE token_hash=" + q(sessionHash));
}

function seedOrder() {
  d1(
    "DELETE FROM order_messages WHERE order_id=" +
      q(ORDER_ID) +
      ";" +
      "DELETE FROM email_webhook_events WHERE provider_message_id IN (" +
      "SELECT provider_message_id FROM order_messages WHERE order_id=" +
      q(ORDER_ID) +
      ");" +
      "DELETE FROM order_events WHERE order_id=" +
      q(ORDER_ID) +
      ";" +
      "DELETE FROM order_items WHERE order_id=" +
      q(ORDER_ID) +
      ";" +
      "DELETE FROM orders WHERE id=" +
      q(ORDER_ID),
  );

  d1(
    "INSERT INTO orders (" +
      "id,public_reference,idempotency_key,status,currency,fulfilment_method," +
      "customer_name,customer_email,items_subtotal_minor,delivery_amount_minor," +
      "final_total_minor,payment_status,fulfilment_message,paid_at,created_at,updated_at" +
      ") VALUES (" +
      [
        q(ORDER_ID),
        q(REF),
        q("webhook-idem-" + RUN_ID),
        "'PAID'",
        "'GBP'",
        "'collection'",
        "'Webhook Staging Test'",
        "'orders@theblacksheepshop.co.uk'",
        "500",
        "0",
        "500",
        "'PAID'",
        "'Synthetic webhook verification — no action required.'",
        q(NOW),
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
        "'webhook-test-item'",
        "'WEBHOOK-TEST'",
        "'webhook-test-item'",
        "'Webhook Test Item'",
        "500",
        "1",
        "500",
        "'{}'",
        q(NOW),
      ].join(",") +
      ");" +
      "INSERT INTO order_events (" +
      "order_id,event_type,from_status,to_status,actor_type,actor_id,note,metadata_json,created_at" +
      ") VALUES (" +
      [
        q(ORDER_ID),
        "'PAYMENT_CONFIRMED'",
        "'AWAITING_PAYMENT'",
        "'PAID'",
        "'system'",
        "NULL",
        "'Synthetic staging webhook verification seed'",
        "'{}'",
        q(NOW),
      ].join(",") +
      ")",
  );
}

function createSession() {
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
    "No staging owner identity is available for webhook E2E.",
  );

  const ownerEmail = String(rows[0].email);
  sessionToken = randomBytes(32).toString("base64url");
  sessionHash = sha256(sessionToken);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

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

async function api(path, body) {
  const response = await fetch(BASE + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: BASE,
      cookie: "bs_admin_session=" + sessionToken,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      "Admin API " +
        path +
        " failed with HTTP " +
        response.status +
        ": " +
        String(text).slice(0, 1000),
    );
  }

  return data;
}

async function waitForOutboundMessage() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const rows = d1(
      "SELECT id,provider_message_id AS providerMessageId," +
        "delivery_status AS deliveryStatus,created_at AS createdAt " +
        "FROM order_messages WHERE order_id=" +
        q(ORDER_ID) +
        " AND provider='resend' ORDER BY created_at DESC LIMIT 1",
    );

    if (rows.length && rows[0].providerMessageId) return rows[0];
    await sleep(2000);
  }

  throw new Error("Outbound Resend audit row did not appear.");
}

async function waitForDelivered(providerMessageId) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const messages = d1(
      "SELECT id,provider_message_id AS providerMessageId," +
        "delivery_status AS deliveryStatus,delivered_at AS deliveredAt " +
        "FROM order_messages WHERE order_id=" +
        q(ORDER_ID) +
        " AND provider_message_id=" +
        q(providerMessageId) +
        " LIMIT 1",
    );

    const events = d1(
      "SELECT webhook_event_id AS webhookEventId,event_type AS eventType," +
        "received_at AS receivedAt FROM email_webhook_events " +
        "WHERE provider='resend' AND provider_message_id=" +
        q(providerMessageId) +
        " ORDER BY received_at ASC",
    );

    if (
      messages.length &&
      messages[0].deliveryStatus === "DELIVERED" &&
      events.some((event) => event.eventType === "email.delivered")
    ) {
      return { message: messages[0], events };
    }

    await sleep(2000);
  }

  throw new Error("Signed Resend webhook did not reach DELIVERED in staging D1.");
}

try {
  seedOrder();
  createSession();

  let order = (
    await api(
      "/admin/api/orders/" + encodeURIComponent(REF) + "/actions",
      { action: "start_preparing" },
    )
  ).order;

  assert(order?.status === "PREPARING", "start_preparing did not reach PREPARING.");

  order = (
    await api(
      "/admin/api/orders/" + encodeURIComponent(REF) + "/actions",
      { action: "ready_for_collection" },
    )
  ).order;

  assert(
    order?.status === "READY_FOR_COLLECTION",
    "ready_for_collection did not reach READY_FOR_COLLECTION.",
  );

  const outbound = await waitForOutboundMessage();
  assert(
    outbound.deliveryStatus === "SENT" || outbound.deliveryStatus === "DELIVERED",
    "Outbound email audit did not start in SENT/DELIVERED state.",
  );

  const delivered = await waitForDelivered(outbound.providerMessageId);
  const deliveredEvent = delivered.events.find(
    (event) => event.eventType === "email.delivered",
  );
  assert(deliveredEvent?.webhookEventId, "Delivered webhook event ID is missing.");

  const orderEvents = d1(
    "SELECT event_type AS eventType FROM order_events WHERE order_id=" +
      q(ORDER_ID) +
      " ORDER BY id",
  );

  assert(
    orderEvents.some((event) => event.eventType === "EMAIL_DELIVERED"),
    "EMAIL_DELIVERED audit event was not recorded.",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        reference: REF,
        orderId: ORDER_ID,
        providerMessageId: outbound.providerMessageId,
        deliveredWebhookEventId: deliveredEvent.webhookEventId,
        deliveryStatus: delivered.message.deliveryStatus,
        webhookEvents: delivered.events.map((event) => ({
          webhookEventId: event.webhookEventId,
          eventType: event.eventType,
        })),
        replayReady: true,
        cleanupDeferred: true,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    "STAGING WEBHOOK GENERATOR FAILED:",
    error instanceof Error ? error.message : error,
  );
  console.error("Synthetic staging order preserved:", REF);
  process.exitCode = 1;
} finally {
  try {
    cleanupSession();
  } catch (error) {
    console.error(
      "Session cleanup warning:",
      error instanceof Error ? error.message : error,
    );
  }
}
