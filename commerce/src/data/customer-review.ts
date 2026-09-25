import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1";

interface ReviewRow {
  tokenId: string;
  orderId: string;
  publicReference: string;
  orderStatus: string;
  paymentStatus: string;
  paymentRequestUrl: string | null;
  fulfilmentMessage: string | null;
  customerName: string;
  customerEmail: string;
  revisionId: string;
  revisionNumber: number;
  revisionState: string;
  customerMessage: string | null;
  fulfilmentMethod: string;
  itemsSubtotalMinor: number;
  deliveryAmountMinor: number | null;
  adjustmentAmountMinor: number;
  finalTotalMinor: number | null;
  expiresAt: string;
}

export interface CustomerReviewSnapshot {
  reference: string;
  orderStatus: string;
  paymentStatus: string;
  revisionId: string;
  revisionNumber: number;
  revisionState: string;
  customerMessage: string | null;
  fulfilmentMethod: string;
  fulfilmentMessage: string | null;
  itemsSubtotalMinor: number;
  deliveryAmountMinor: number | null;
  adjustmentAmountMinor: number;
  finalTotalMinor: number | null;
  expiresAt: string;
  paymentAvailable: boolean;
  originalItems: Array<{
    lineNumber: number;
    productName: string;
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
  }>;
  revisedItems: Array<{
    lineNumber: number;
    productName: string;
    requestedQuantity: number;
    confirmedQuantity: number;
    availabilityStatus: string;
    customerNote: string | null;
    unitPriceMinor: number;
    lineTotalMinor: number;
  }>;
}

async function allRows<T>(statement: D1PreparedStatementLike): Promise<T[]> {
  if (!statement.all) throw new Error("d1_all_not_supported");
  return (await statement.all<T>()).results ?? [];
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function validateToken(token: string): void {
  if (
    token.length < 32 ||
    token.length > 128 ||
    !/^[A-Za-z0-9_-]+$/.test(token)
  ) {
    throw new Error("review_token_invalid");
  }
}

async function findReviewRow(
  db: D1DatabaseLike,
  token: string,
): Promise<ReviewRow | null> {
  validateToken(token);
  const hash = await sha256Hex(token);
  const now = new Date().toISOString();

  return db
    .prepare(
      `SELECT
        t.id AS tokenId,
        o.id AS orderId,
        o.public_reference AS publicReference,
        o.status AS orderStatus,
        o.payment_status AS paymentStatus,
        o.payment_request_url AS paymentRequestUrl,
        o.fulfilment_message AS fulfilmentMessage,
        o.customer_name AS customerName,
        o.customer_email AS customerEmail,
        r.id AS revisionId,
        r.revision_number AS revisionNumber,
        r.state AS revisionState,
        r.customer_message AS customerMessage,
        r.fulfilment_method AS fulfilmentMethod,
        r.items_subtotal_minor AS itemsSubtotalMinor,
        r.delivery_amount_minor AS deliveryAmountMinor,
        r.adjustment_amount_minor AS adjustmentAmountMinor,
        r.final_total_minor AS finalTotalMinor,
        t.expires_at AS expiresAt
      FROM customer_review_tokens t
      INNER JOIN orders o ON o.id = t.order_id
      INNER JOIN order_revisions r ON r.id = t.revision_id
      WHERE t.token_hash = ?
        AND t.revoked_at IS NULL
        AND t.expires_at > ?
        AND r.state IN ('SENT', 'ACCEPTED')
        AND r.id = (
          SELECT r2.id
          FROM order_revisions r2
          WHERE r2.order_id = o.id
            AND r2.state IN ('SENT', 'ACCEPTED')
          ORDER BY r2.revision_number DESC
          LIMIT 1
        )
      LIMIT 1`,
    )
    .bind(hash, now)
    .first<ReviewRow>();
}

export async function createCustomerReviewToken(
  db: D1DatabaseLike,
  reference: string,
  ttlHours = 168,
): Promise<{
  token: string;
  expiresAt: string;
  revisionId: string;
  revisionNumber: number;
}> {
  const revision = await db
    .prepare(
      `SELECT
        o.id AS orderId,
        r.id AS revisionId,
        r.revision_number AS revisionNumber
      FROM orders o
      INNER JOIN order_revisions r ON r.id = (
        SELECT r2.id
        FROM order_revisions r2
        WHERE r2.order_id = o.id
          AND r2.state IN ('SENT', 'ACCEPTED')
        ORDER BY r2.revision_number DESC
        LIMIT 1
      )
      WHERE o.public_reference = ?
        AND o.payment_status IN ('UNPAID', 'PAYMENT_REQUESTED')
      LIMIT 1`,
    )
    .bind(reference)
    .first<{ orderId: string; revisionId: string; revisionNumber: number }>();

  if (!revision) throw new Error("review_revision_not_available");

  const safeTtl = Math.max(1, Math.min(336, Math.floor(ttlHours)));
  const token = newToken();
  const tokenHash = await sha256Hex(token);
  const id = crypto.randomUUID();
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(
    now.getTime() + safeTtl * 60 * 60 * 1000,
  ).toISOString();

  await db.batch([
    db
      .prepare(
        `UPDATE customer_review_tokens
        SET revoked_at = ?
        WHERE order_id = ? AND revoked_at IS NULL`,
      )
      .bind(createdAt, revision.orderId),
    db
      .prepare(
        `INSERT INTO customer_review_tokens (
          id, order_id, revision_id, token_hash,
          expires_at, revoked_at, last_used_at, created_at
        ) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)`,
      )
      .bind(
        id,
        revision.orderId,
        revision.revisionId,
        tokenHash,
        expiresAt,
        createdAt,
      ),
    db
      .prepare(
        `INSERT INTO order_events (
          order_id, event_type, from_status, to_status,
          actor_type, actor_id, note, metadata_json, created_at
        ) VALUES (?, 'CUSTOMER_REVIEW_LINK_CREATED', NULL, NULL, 'admin', NULL, NULL, ?, ?)`,
      )
      .bind(
        revision.orderId,
        JSON.stringify({
          revisionId: revision.revisionId,
          revisionNumber: revision.revisionNumber,
          expiresAt,
        }),
        createdAt,
      ),
  ]);

  return {
    token,
    expiresAt,
    revisionId: revision.revisionId,
    revisionNumber: Number(revision.revisionNumber),
  };
}

export async function getCustomerReview(
  db: D1DatabaseLike,
  token: string,
): Promise<CustomerReviewSnapshot | null> {
  const row = await findReviewRow(db, token);
  if (!row) return null;

  const [originalItems, revisedItems] = await Promise.all([
    allRows<{
      lineNumber: number;
      productName: string;
      quantity: number;
      unitPriceMinor: number;
      lineTotalMinor: number;
    }>(
      db
        .prepare(
          `SELECT
            line_number AS lineNumber,
            product_name AS productName,
            quantity,
            unit_price_minor AS unitPriceMinor,
            line_total_minor AS lineTotalMinor
          FROM order_items
          WHERE order_id = ?
          ORDER BY line_number ASC`,
        )
        .bind(row.orderId),
    ),
    allRows<{
      lineNumber: number;
      productName: string;
      requestedQuantity: number;
      confirmedQuantity: number;
      availabilityStatus: string;
      customerNote: string | null;
      unitPriceMinor: number;
      lineTotalMinor: number;
    }>(
      db
        .prepare(
          `SELECT
            line_number AS lineNumber,
            product_name AS productName,
            requested_quantity AS requestedQuantity,
            confirmed_quantity AS confirmedQuantity,
            availability_status AS availabilityStatus,
            customer_note AS customerNote,
            unit_price_minor AS unitPriceMinor,
            line_total_minor AS lineTotalMinor
          FROM order_revision_items
          WHERE revision_id = ?
          ORDER BY line_number ASC`,
        )
        .bind(row.revisionId),
    ),
  ]);

  await db
    .prepare(
      "UPDATE customer_review_tokens SET last_used_at = ? WHERE id = ?",
    )
    .bind(new Date().toISOString(), row.tokenId)
    .run();

  return {
    reference: row.publicReference,
    orderStatus: row.orderStatus,
    paymentStatus: row.paymentStatus,
    revisionId: row.revisionId,
    revisionNumber: Number(row.revisionNumber),
    revisionState: row.revisionState,
    customerMessage: row.customerMessage,
    fulfilmentMethod: row.fulfilmentMethod,
    fulfilmentMessage: row.fulfilmentMessage,
    itemsSubtotalMinor: Number(row.itemsSubtotalMinor),
    deliveryAmountMinor:
      row.deliveryAmountMinor === null
        ? null
        : Number(row.deliveryAmountMinor),
    adjustmentAmountMinor: Number(row.adjustmentAmountMinor),
    finalTotalMinor:
      row.finalTotalMinor === null ? null : Number(row.finalTotalMinor),
    expiresAt: row.expiresAt,
    paymentAvailable:
      row.paymentStatus === "PAYMENT_REQUESTED" &&
      Boolean(row.paymentRequestUrl),
    originalItems: originalItems.map((item) => ({
      ...item,
      lineNumber: Number(item.lineNumber),
      quantity: Number(item.quantity),
      unitPriceMinor: Number(item.unitPriceMinor),
      lineTotalMinor: Number(item.lineTotalMinor),
    })),
    revisedItems: revisedItems.map((item) => ({
      ...item,
      lineNumber: Number(item.lineNumber),
      requestedQuantity: Number(item.requestedQuantity),
      confirmedQuantity: Number(item.confirmedQuantity),
      unitPriceMinor: Number(item.unitPriceMinor),
      lineTotalMinor: Number(item.lineTotalMinor),
    })),
  };
}

export async function acceptCustomerReview(
  db: D1DatabaseLike,
  token: string,
): Promise<{ paymentRequestUrl: string; reference: string }> {
  const row = await findReviewRow(db, token);
  if (!row) throw new Error("review_not_available");
  if (!row.paymentRequestUrl || row.paymentStatus !== "PAYMENT_REQUESTED") {
    throw new Error("review_payment_not_available");
  }

  const now = new Date().toISOString();
  const statements: D1PreparedStatementLike[] = [
    db
      .prepare(
        "UPDATE customer_review_tokens SET last_used_at = ? WHERE id = ?",
      )
      .bind(now, row.tokenId),
  ];

  if (row.revisionState === "SENT") {
    statements.push(
      db
        .prepare(
          `UPDATE order_revisions
          SET state = 'ACCEPTED', accepted_at = ?, version = version + 1
          WHERE id = ? AND state = 'SENT'`,
        )
        .bind(now, row.revisionId),
    );
    statements.push(
      db
        .prepare(
          `INSERT INTO order_events (
            order_id, event_type, from_status, to_status,
            actor_type, actor_id, note, metadata_json, created_at
          ) VALUES (?, 'ORDER_REVISION_ACCEPTED', NULL, NULL, 'customer', NULL, NULL, ?, ?)`,
        )
        .bind(
          row.orderId,
          JSON.stringify({
            revisionId: row.revisionId,
            revisionNumber: row.revisionNumber,
            channel: "customer_review",
          }),
          now,
        ),
    );
  }

  await db.batch(statements);
  return {
    paymentRequestUrl: row.paymentRequestUrl,
    reference: row.publicReference,
  };
}

export async function declineCustomerReview(
  db: D1DatabaseLike,
  token: string,
): Promise<{ reference: string }> {
  const row = await findReviewRow(db, token);
  if (!row) throw new Error("review_not_available");
  if (row.paymentStatus === "PAID" || row.paymentStatus === "REFUNDED") {
    throw new Error("review_already_paid");
  }

  const now = new Date().toISOString();

  await db.batch([
    db
      .prepare(
        `UPDATE order_revisions
        SET state = 'DECLINED', declined_at = ?, version = version + 1
        WHERE id = ? AND state IN ('SENT', 'ACCEPTED')`,
      )
      .bind(now, row.revisionId),
    db
      .prepare(
        `UPDATE orders
        SET status = 'UNDER_REVIEW',
            payment_status = 'UNPAID',
            payment_request_url = NULL,
            payment_reference = NULL,
            updated_at = ?
        WHERE id = ? AND payment_status IN ('UNPAID', 'PAYMENT_REQUESTED')`,
      )
      .bind(now, row.orderId),
    db
      .prepare(
        "UPDATE customer_review_tokens SET revoked_at = ?, last_used_at = ? WHERE id = ?",
      )
      .bind(now, now, row.tokenId),
    db
      .prepare(
        `INSERT INTO order_events (
          order_id, event_type, from_status, to_status,
          actor_type, actor_id, note, metadata_json, created_at
        ) VALUES (?, 'ORDER_REVISION_DECLINED', ?, 'UNDER_REVIEW', 'customer', NULL, NULL, ?, ?)`,
      )
      .bind(
        row.orderId,
        row.orderStatus,
        JSON.stringify({
          revisionId: row.revisionId,
          revisionNumber: row.revisionNumber,
          channel: "customer_review",
        }),
        now,
      ),
  ]);

  return { reference: row.publicReference };
}

export async function recordCustomerQuestion(
  db: D1DatabaseLike,
  token: string,
  message: string,
): Promise<{
  messageId: string;
  orderId: string;
  revisionId: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  body: string;
}> {
  const row = await findReviewRow(db, token);
  if (!row) throw new Error("review_not_available");

  const body = String(message ?? "").trim();
  if (body.length < 2 || body.length > 2000) {
    throw new Error("review_question_invalid");
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.batch([
    db
      .prepare(
        `INSERT INTO order_messages (
          id, order_id, revision_id, direction, kind,
          subject, body, delivery_status, provider,
          provider_message_id, created_by, created_at,
          sent_at, delivered_at, updated_at
        ) VALUES (?, ?, ?, 'CUSTOMER_TO_SHOP', 'CUSTOMER_QUESTION',
          NULL, ?, 'RECORDED', NULL, NULL, 'customer-review', ?, NULL, NULL, ?)`,
      )
      .bind(id, row.orderId, row.revisionId, body, now, now),
    db
      .prepare(
        `INSERT INTO order_events (
          order_id, event_type, from_status, to_status,
          actor_type, actor_id, note, metadata_json, created_at
        ) VALUES (?, 'CUSTOMER_QUESTION_RECEIVED', NULL, NULL, 'customer', NULL, NULL, ?, ?)`,
      )
      .bind(
        row.orderId,
        JSON.stringify({
          revisionId: row.revisionId,
          revisionNumber: row.revisionNumber,
          messageId: id,
        }),
        now,
      ),
    db
      .prepare(
        "UPDATE customer_review_tokens SET last_used_at = ? WHERE id = ?",
      )
      .bind(now, row.tokenId),
  ]);

  return {
    messageId: id,
    orderId: row.orderId,
    revisionId: row.revisionId,
    reference: row.publicReference,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    body,
  };
}

export async function listOrderMessages(
  db: D1DatabaseLike,
  reference: string,
): Promise<Array<Record<string, unknown>>> {
  return allRows<Record<string, unknown>>(
    db
      .prepare(
        `SELECT
          m.id,
          m.revision_id AS revisionId,
          m.direction,
          m.kind,
          m.subject,
          m.body,
          m.delivery_status AS deliveryStatus,
          m.provider,
          m.provider_message_id AS providerMessageId,
          m.created_by AS createdBy,
          m.created_at AS createdAt,
          m.sent_at AS sentAt,
          m.delivered_at AS deliveredAt,
          m.updated_at AS updatedAt
        FROM order_messages m
        INNER JOIN orders o ON o.id = m.order_id
        WHERE o.public_reference = ?
        ORDER BY m.created_at DESC`,
      )
      .bind(reference),
  );
}
