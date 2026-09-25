import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1";
import type { AdminOrderState, ValidatedAdminAction } from "../domain/admin-order";

interface OrderSummaryRow {
  id: string;
  publicReference: string;
  status: string;
  fulfilmentMethod: string;
  customerName: string;
  customerEmail: string;
  itemsSubtotalMinor: number;
  deliveryAmountMinor: number | null;
  finalTotalMinor: number | null;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
}

async function allRows<T>(
  statement: D1PreparedStatementLike,
): Promise<T[]> {
  if (!statement.all) throw new Error("d1_all_not_supported");
  return (await statement.all<T>()).results ?? [];
}

export async function listAdminOrders(
  db: D1DatabaseLike,
  status?: string | null,
): Promise<OrderSummaryRow[]> {
  const base = `SELECT
      id,
      public_reference AS publicReference,
      status,
      fulfilment_method AS fulfilmentMethod,
      customer_name AS customerName,
      customer_email AS customerEmail,
      items_subtotal_minor AS itemsSubtotalMinor,
      delivery_amount_minor AS deliveryAmountMinor,
      final_total_minor AS finalTotalMinor,
      payment_status AS paymentStatus,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM orders`;

  const statement = status
    ? db
        .prepare(`${base} WHERE status = ? ORDER BY created_at DESC LIMIT 100`)
        .bind(status)
    : db.prepare(`${base} ORDER BY created_at DESC LIMIT 100`);

  return allRows<OrderSummaryRow>(statement);
}

export async function getAdminOrderState(
  db: D1DatabaseLike,
  reference: string,
): Promise<AdminOrderState | null> {
  return db
    .prepare(
      `SELECT
        o.id,
        o.public_reference AS publicReference,
        o.status,
        o.fulfilment_method AS fulfilmentMethod,
        COALESCE(
          (
            SELECT r.items_subtotal_minor
            FROM order_revisions r
            WHERE r.order_id = o.id AND r.state IN ('SENT', 'ACCEPTED')
            ORDER BY r.revision_number DESC
            LIMIT 1
          ),
          o.items_subtotal_minor
        ) AS itemsSubtotalMinor,
        COALESCE(
          (
            SELECT r.delivery_amount_minor
            FROM order_revisions r
            WHERE r.order_id = o.id AND r.state IN ('SENT', 'ACCEPTED')
            ORDER BY r.revision_number DESC
            LIMIT 1
          ),
          o.delivery_amount_minor
        ) AS deliveryAmountMinor,
        COALESCE(
          (
            SELECT r.final_total_minor
            FROM order_revisions r
            WHERE r.order_id = o.id AND r.state IN ('SENT', 'ACCEPTED')
            ORDER BY r.revision_number DESC
            LIMIT 1
          ),
          o.final_total_minor
        ) AS finalTotalMinor,
        o.payment_status AS paymentStatus,
        (
          SELECT r.id
          FROM order_revisions r
          WHERE r.order_id = o.id AND r.state IN ('SENT', 'ACCEPTED')
          ORDER BY r.revision_number DESC
          LIMIT 1
        ) AS activeRevisionId
      FROM orders o
      WHERE o.public_reference = ?
      LIMIT 1`,
    )
    .bind(reference)
    .first<AdminOrderState>();
}

export async function getAdminOrderDetail(
  db: D1DatabaseLike,
  reference: string,
): Promise<Record<string, unknown> | null> {
  const order = await db
    .prepare(
      `SELECT
        id,
        public_reference AS publicReference,
        status,
        currency,
        fulfilment_method AS fulfilmentMethod,
        customer_name AS customerName,
        customer_email AS customerEmail,
        customer_phone AS customerPhone,
        delivery_address_line1 AS deliveryAddressLine1,
        delivery_address_line2 AS deliveryAddressLine2,
        delivery_town AS deliveryTown,
        delivery_county AS deliveryCounty,
        delivery_postcode AS deliveryPostcode,
        delivery_country AS deliveryCountry,
        customer_note AS customerNote,
        items_subtotal_minor AS itemsSubtotalMinor,
        delivery_amount_minor AS deliveryAmountMinor,
        final_total_minor AS finalTotalMinor,
        payment_status AS paymentStatus,
        payment_provider AS paymentProvider,
        payment_reference AS paymentReference,
        payment_request_url AS paymentRequestUrl,
        fulfilment_message AS fulfilmentMessage,
        tracking_reference AS trackingReference,
        tracking_url AS trackingUrl,
        created_at AS createdAt,
        updated_at AS updatedAt,
        quoted_at AS quotedAt,
        paid_at AS paidAt,
        shipped_at AS shippedAt,
        completed_at AS completedAt,
        cancelled_at AS cancelledAt,
        (
          SELECT r.id
          FROM order_revisions r
          WHERE r.order_id = orders.id AND r.state IN ('SENT', 'ACCEPTED')
          ORDER BY r.revision_number DESC
          LIMIT 1
        ) AS activeRevisionId,
        (
          SELECT r.revision_number
          FROM order_revisions r
          WHERE r.order_id = orders.id AND r.state IN ('SENT', 'ACCEPTED')
          ORDER BY r.revision_number DESC
          LIMIT 1
        ) AS activeRevisionNumber,
        (
          SELECT r.state
          FROM order_revisions r
          WHERE r.order_id = orders.id AND r.state IN ('SENT', 'ACCEPTED')
          ORDER BY r.revision_number DESC
          LIMIT 1
        ) AS activeRevisionState,
        COALESCE(
          (
            SELECT r.items_subtotal_minor
            FROM order_revisions r
            WHERE r.order_id = orders.id AND r.state IN ('SENT', 'ACCEPTED')
            ORDER BY r.revision_number DESC
            LIMIT 1
          ),
          items_subtotal_minor
        ) AS effectiveItemsSubtotalMinor,
        COALESCE(
          (
            SELECT r.delivery_amount_minor
            FROM order_revisions r
            WHERE r.order_id = orders.id AND r.state IN ('SENT', 'ACCEPTED')
            ORDER BY r.revision_number DESC
            LIMIT 1
          ),
          delivery_amount_minor
        ) AS effectiveDeliveryAmountMinor,
        COALESCE(
          (
            SELECT r.final_total_minor
            FROM order_revisions r
            WHERE r.order_id = orders.id AND r.state IN ('SENT', 'ACCEPTED')
            ORDER BY r.revision_number DESC
            LIMIT 1
          ),
          final_total_minor
        ) AS effectiveFinalTotalMinor
      FROM orders
      WHERE public_reference = ?
      LIMIT 1`,
    )
    .bind(reference)
    .first<Record<string, unknown>>();

  if (!order) return null;

  const orderId = String(order.id);
  const items = await allRows<Record<string, unknown>>(
    db
      .prepare(
        `SELECT
          line_number AS lineNumber,
          catalog_product_id AS productId,
          sku,
          slug,
          product_name AS productName,
          unit_price_minor AS unitPriceMinor,
          quantity,
          line_total_minor AS lineTotalMinor,
          options_json AS optionsJson
        FROM order_items
        WHERE order_id = ?
        ORDER BY line_number ASC`,
      )
      .bind(orderId),
  );

  const events = await allRows<Record<string, unknown>>(
    db
      .prepare(
        `SELECT
          id,
          event_type AS eventType,
          from_status AS fromStatus,
          to_status AS toStatus,
          actor_type AS actorType,
          actor_id AS actorId,
          note,
          metadata_json AS metadataJson,
          created_at AS createdAt
        FROM order_events
        WHERE order_id = ?
        ORDER BY id ASC`,
      )
      .bind(orderId),
  );

  return { ...order, items, events };
}

export async function applyAdminOrderUpdate(
  db: D1DatabaseLike,
  order: AdminOrderState,
  action: ValidatedAdminAction,
  actorEmail: string,
): Promise<void> {
  const now = new Date().toISOString();
  const assignments = ["status = ?", "updated_at = ?"];
  const values: unknown[] = [action.nextStatus, now];

  const set = (column: string, value: unknown) => {
    assignments.push(`${column} = ?`);
    values.push(value);
  };

  if (action.deliveryAmountMinor !== undefined) {
    set("delivery_amount_minor", action.deliveryAmountMinor);
  }
  if (action.finalTotalMinor !== undefined) {
    set("final_total_minor", action.finalTotalMinor);
  }
  if (action.paymentStatus !== undefined) {
    set("payment_status", action.paymentStatus);
  }
  if (action.paymentProvider !== undefined) {
    set("payment_provider", action.paymentProvider);
  }
  if (action.paymentReference !== undefined) {
    set("payment_reference", action.paymentReference);
  }
  if (action.paymentRequestUrl !== undefined) {
    set("payment_request_url", action.paymentRequestUrl);
  }
  if (action.fulfilmentMessage !== undefined) {
    set("fulfilment_message", action.fulfilmentMessage);
  }
  if (action.trackingReference !== undefined) {
    set("tracking_reference", action.trackingReference);
  }
  if (action.trackingUrl !== undefined) {
    set("tracking_url", action.trackingUrl);
  }
  if (action.timestampField) {
    set(action.timestampField, now);
  }

  values.push(order.id);

  const update = db
    .prepare(`UPDATE orders SET ${assignments.join(", ")} WHERE id = ?`)
    .bind(...values);

  const event = db
    .prepare(
      `INSERT INTO order_events (
        order_id,
        event_type,
        from_status,
        to_status,
        actor_type,
        actor_id,
        note,
        metadata_json,
        created_at
      ) VALUES (?, ?, ?, ?, 'admin', ?, ?, '{}', ?)`,
    )
    .bind(
      order.id,
      action.eventType,
      order.status,
      action.nextStatus,
      actorEmail,
      action.note ?? null,
      now,
    );

  await db.batch([update, event]);
}

export async function getPaymentNotificationSnapshot(
  db: D1DatabaseLike,
  reference: string,
): Promise<{
  id: string;
  publicReference: string;
  customerName: string;
  customerEmail: string;
  finalTotalMinor: number | null;
  paymentRequestUrl: string | null;
  fulfilmentMethod: string;
  fulfilmentMessage: string | null;
} | null> {
  return db
    .prepare(
      `SELECT
        o.id,
        o.public_reference AS publicReference,
        o.customer_name AS customerName,
        o.customer_email AS customerEmail,
        COALESCE(
          (
            SELECT r.final_total_minor
            FROM order_revisions r
            WHERE r.order_id = o.id AND r.state IN ('SENT', 'ACCEPTED')
            ORDER BY r.revision_number DESC
            LIMIT 1
          ),
          o.final_total_minor
        ) AS finalTotalMinor,
        o.payment_request_url AS paymentRequestUrl,
        o.fulfilment_method AS fulfilmentMethod,
        o.fulfilment_message AS fulfilmentMessage
      FROM orders o
      WHERE o.public_reference = ?
      LIMIT 1`,
    )
    .bind(reference)
    .first();
}

export async function getAdminReports(
  db: D1DatabaseLike,
  requestedDays = 30,
): Promise<Record<string, unknown>> {
  const supportedDays = new Set([7, 30, 90, 365]);
  const periodDays = supportedDays.has(requestedDays) ? requestedDays : 30;
  const sinceDate = new Date(Date.now() - (periodDays - 1) * 86_400_000);
  sinceDate.setUTCHours(0, 0, 0, 0);
  const since = sinceDate.toISOString();

  const summaryRow =
    (await db
      .prepare(
        `SELECT
          COUNT(*) AS orderCount,
          COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN COALESCE(final_total_minor, items_subtotal_minor) ELSE 0 END), 0) AS revenueMinor,
          COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN 1 ELSE 0 END), 0) AS netPaidCount,
          COALESCE(SUM(CASE WHEN payment_status IN ('PAID', 'REFUNDED') THEN 1 ELSE 0 END), 0) AS paidCount,
          COALESCE(SUM(CASE WHEN payment_status IN ('PAYMENT_REQUESTED', 'PAID', 'REFUNDED') THEN 1 ELSE 0 END), 0) AS paymentRequestedCount,
          COALESCE(SUM(CASE WHEN payment_status = 'REFUNDED' THEN 1 ELSE 0 END), 0) AS refundedOrders,
          COALESCE(SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS cancelledOrders,
          COALESCE(SUM(CASE WHEN fulfilment_method = 'collection' THEN 1 ELSE 0 END), 0) AS collectionCount,
          COALESCE(SUM(CASE WHEN fulfilment_method = 'delivery' THEN 1 ELSE 0 END), 0) AS deliveryCount
        FROM orders
        WHERE created_at >= ?`,
      )
      .bind(since)
      .first<Record<string, unknown>>()) ?? {};

  const number = (value: unknown): number => Number(value ?? 0);
  const orderCount = number(summaryRow.orderCount);
  const revenueMinor = number(summaryRow.revenueMinor);
  const netPaidCount = number(summaryRow.netPaidCount);
  const paidCount = number(summaryRow.paidCount);
  const paymentRequestedCount = number(summaryRow.paymentRequestedCount);
  const refundedOrders = number(summaryRow.refundedOrders);

  const statusCounts = await allRows<Record<string, unknown>>(
    db
      .prepare(
        `SELECT status, COUNT(*) AS count
        FROM orders
        WHERE created_at >= ?
        GROUP BY status
        ORDER BY count DESC, status ASC`,
      )
      .bind(since),
  );

  const revenueTrend = await allRows<Record<string, unknown>>(
    db
      .prepare(
        `SELECT
          substr(COALESCE(paid_at, created_at), 1, 10) AS day,
          COALESCE(SUM(COALESCE(final_total_minor, items_subtotal_minor)), 0) AS revenueMinor,
          COUNT(*) AS paidOrders
        FROM orders
        WHERE created_at >= ? AND payment_status = 'PAID'
        GROUP BY substr(COALESCE(paid_at, created_at), 1, 10)
        ORDER BY day ASC`,
      )
      .bind(since),
  );

  const topProducts = await allRows<Record<string, unknown>>(
    db
      .prepare(
        `SELECT
          i.catalog_product_id AS productId,
          i.product_name AS productName,
          COALESCE(SUM(i.quantity), 0) AS quantity,
          COUNT(DISTINCT o.id) AS orderCount,
          COALESCE(SUM(i.line_total_minor), 0) AS revenueMinor
        FROM order_items i
        INNER JOIN orders o ON o.id = i.order_id
        WHERE o.created_at >= ? AND o.payment_status = 'PAID'
        GROUP BY i.catalog_product_id, i.product_name
        ORDER BY revenueMinor DESC, quantity DESC
        LIMIT 8`,
      )
      .bind(since),
  );

  const topCustomers = await allRows<Record<string, unknown>>(
    db
      .prepare(
        `SELECT
          lower(customer_email) AS customerEmail,
          MAX(customer_name) AS customerName,
          COUNT(*) AS orderCount,
          COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN COALESCE(final_total_minor, items_subtotal_minor) ELSE 0 END), 0) AS revenueMinor
        FROM orders
        WHERE created_at >= ?
        GROUP BY lower(customer_email)
        ORDER BY revenueMinor DESC, orderCount DESC
        LIMIT 8`,
      )
      .bind(since),
  );

  const busiestHours = await allRows<Record<string, unknown>>(
    db
      .prepare(
        `SELECT
          substr(created_at, 12, 2) AS hour,
          COUNT(*) AS count
        FROM orders
        WHERE created_at >= ?
        GROUP BY substr(created_at, 12, 2)
        ORDER BY count DESC, hour ASC
        LIMIT 6`,
      )
      .bind(since),
  );

  return {
    periodDays,
    since,
    generatedAt: new Date().toISOString(),
    summary: {
      orderCount,
      revenueMinor,
      paidCount,
      paymentRequestedCount,
      refundedOrders,
      cancelledOrders: number(summaryRow.cancelledOrders),
      collectionCount: number(summaryRow.collectionCount),
      deliveryCount: number(summaryRow.deliveryCount),
      averageOrderValueMinor:
        netPaidCount > 0 ? Math.round(revenueMinor / netPaidCount) : 0,
      conversionToPaid:
        paymentRequestedCount > 0
          ? Math.round((paidCount / paymentRequestedCount) * 1000) / 10
          : 0,
      refundRate:
        orderCount > 0
          ? Math.round((refundedOrders / orderCount) * 1000) / 10
          : 0,
    },
    statusCounts,
    revenueTrend,
    topProducts,
    topCustomers,
    busiestHours,
  };
}
