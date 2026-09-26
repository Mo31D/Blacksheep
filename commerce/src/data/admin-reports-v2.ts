import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1";

async function allRows<T>(statement: D1PreparedStatementLike): Promise<T[]> {
  if (!statement.all) throw new Error("d1_all_not_supported");
  return (await statement.all<T>()).results ?? [];
}

function number(value: unknown): number {
  return Number(value ?? 0);
}

export async function getAdminReportsV2(
  db: D1DatabaseLike,
  requestedDays = 30,
): Promise<Record<string, unknown>> {
  const supportedDays = new Set([7, 30, 90, 365]);
  const periodDays = supportedDays.has(requestedDays) ? requestedDays : 30;
  const sinceDate = new Date(Date.now() - (periodDays - 1) * 86_400_000);
  sinceDate.setUTCHours(0, 0, 0, 0);
  const since = sinceDate.toISOString();

  const effectiveTotalSql =
    "COALESCE((SELECT r.final_total_minor FROM order_revisions r WHERE r.order_id = o.id AND r.state IN ('SENT','ACCEPTED') ORDER BY r.revision_number DESC LIMIT 1), o.final_total_minor, o.items_subtotal_minor)";

  const summaryRow =
    (await db
      .prepare(
        "SELECT COUNT(*) AS orderCount, " +
          "COALESCE(SUM(CASE WHEN o.payment_status IN ('PAID','REFUNDED') THEN " +
          effectiveTotalSql +
          " ELSE 0 END), 0) AS grossRevenueMinor, " +
          "COALESCE(SUM(CASE WHEN o.payment_status IN ('PAID','REFUNDED') THEN 1 ELSE 0 END), 0) AS paidCount, " +
          "COALESCE(SUM(CASE WHEN o.payment_status IN ('PAYMENT_REQUESTED','PAID','REFUNDED') THEN 1 ELSE 0 END), 0) AS paymentRequestedCount, " +
          "COALESCE(SUM(CASE WHEN o.status = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS cancelledOrders, " +
          "COALESCE(SUM(CASE WHEN COALESCE((SELECT r.fulfilment_method FROM order_revisions r WHERE r.order_id = o.id AND r.state IN ('SENT','ACCEPTED') ORDER BY r.revision_number DESC LIMIT 1), o.fulfilment_method) = 'collection' THEN 1 ELSE 0 END), 0) AS collectionCount, " +
          "COALESCE(SUM(CASE WHEN COALESCE((SELECT r.fulfilment_method FROM order_revisions r WHERE r.order_id = o.id AND r.state IN ('SENT','ACCEPTED') ORDER BY r.revision_number DESC LIMIT 1), o.fulfilment_method) = 'delivery' THEN 1 ELSE 0 END), 0) AS deliveryCount " +
          "FROM orders o WHERE o.data_class = 'BUSINESS' AND o.admin_hidden_at IS NULL AND o.created_at >= ?",
      )
      .bind(since)
      .first<Record<string, unknown>>()) ?? {};

  const refundSummary =
    (await db
      .prepare(
        "SELECT COALESCE(SUM(r.amount_minor), 0) AS refundedMinor, COUNT(DISTINCT r.order_id) AS refundedOrders " +
          "FROM refunds r INNER JOIN orders o ON o.id = r.order_id WHERE o.data_class = 'BUSINESS' AND o.admin_hidden_at IS NULL AND o.created_at >= ?",
      )
      .bind(since)
      .first<Record<string, unknown>>()) ?? {};

  const orderCount = number(summaryRow.orderCount);
  const grossRevenueMinor = number(summaryRow.grossRevenueMinor);
  const refundedMinor = number(refundSummary.refundedMinor);
  const netRevenueMinor = Math.max(0, grossRevenueMinor - refundedMinor);
  const paidCount = number(summaryRow.paidCount);
  const paymentRequestedCount = number(summaryRow.paymentRequestedCount);
  const refundedOrders = number(refundSummary.refundedOrders);

  const statusCounts = await allRows<Record<string, unknown>>(
    db
      .prepare(
        "SELECT status, COUNT(*) AS count FROM orders WHERE data_class = 'BUSINESS' AND admin_hidden_at IS NULL AND created_at >= ? GROUP BY status ORDER BY count DESC, status ASC",
      )
      .bind(since),
  );

  const grossTrend = await allRows<Record<string, unknown>>(
    db
      .prepare(
        "SELECT substr(COALESCE(o.paid_at, o.created_at),1,10) AS day, COALESCE(SUM(" +
          effectiveTotalSql +
          "),0) AS grossMinor, COUNT(*) AS paidOrders FROM orders o " +
          "WHERE o.data_class = 'BUSINESS' AND o.admin_hidden_at IS NULL AND o.created_at >= ? AND o.payment_status IN ('PAID','REFUNDED') " +
          "GROUP BY substr(COALESCE(o.paid_at, o.created_at),1,10) ORDER BY day ASC",
      )
      .bind(since),
  );

  const refundTrend = await allRows<Record<string, unknown>>(
    db
      .prepare(
        "SELECT substr(r.created_at,1,10) AS day, COALESCE(SUM(r.amount_minor),0) AS refundedMinor " +
          "FROM refunds r INNER JOIN orders o ON o.id = r.order_id WHERE o.data_class = 'BUSINESS' AND o.admin_hidden_at IS NULL AND o.created_at >= ? " +
          "GROUP BY substr(r.created_at,1,10) ORDER BY day ASC",
      )
      .bind(since),
  );

  const trendMap = new Map<
    string,
    { day: string; grossMinor: number; refundedMinor: number; paidOrders: number }
  >();

  for (const row of grossTrend) {
    const day = String(row.day ?? "");
    trendMap.set(day, {
      day,
      grossMinor: number(row.grossMinor),
      refundedMinor: 0,
      paidOrders: number(row.paidOrders),
    });
  }

  for (const row of refundTrend) {
    const day = String(row.day ?? "");
    const existing = trendMap.get(day) ?? {
      day,
      grossMinor: 0,
      refundedMinor: 0,
      paidOrders: 0,
    };
    existing.refundedMinor += number(row.refundedMinor);
    trendMap.set(day, existing);
  }

  const revenueTrend = Array.from(trendMap.values())
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((row) => ({
      ...row,
      revenueMinor: row.grossMinor - row.refundedMinor,
    }));

  const topProducts = await allRows<Record<string, unknown>>(
    db
      .prepare(
        "SELECT productId, productName, SUM(quantity) AS quantity, COUNT(DISTINCT orderId) AS orderCount, SUM(lineTotalMinor) AS revenueMinor FROM (" +
          "SELECT ri.catalog_product_id AS productId, ri.product_name AS productName, ri.confirmed_quantity AS quantity, o.id AS orderId, ri.line_total_minor AS lineTotalMinor " +
          "FROM orders o INNER JOIN order_revisions r ON r.id = (SELECT r2.id FROM order_revisions r2 WHERE r2.order_id = o.id AND r2.state IN ('SENT','ACCEPTED') ORDER BY r2.revision_number DESC LIMIT 1) " +
          "INNER JOIN order_revision_items ri ON ri.revision_id = r.id WHERE o.data_class = 'BUSINESS' AND o.admin_hidden_at IS NULL AND o.created_at >= ? AND o.payment_status IN ('PAID','REFUNDED') AND ri.confirmed_quantity > 0 " +
          "UNION ALL " +
          "SELECT i.catalog_product_id, i.product_name, i.quantity, o.id, i.line_total_minor FROM orders o INNER JOIN order_items i ON i.order_id = o.id " +
          "WHERE o.data_class = 'BUSINESS' AND o.admin_hidden_at IS NULL AND o.created_at >= ? AND o.payment_status IN ('PAID','REFUNDED') AND NOT EXISTS (SELECT 1 FROM order_revisions r3 WHERE r3.order_id = o.id AND r3.state IN ('SENT','ACCEPTED'))" +
          ") GROUP BY productId, productName ORDER BY revenueMinor DESC, quantity DESC LIMIT 12",
      )
      .bind(since, since),
  );

  const availabilityLoss = await allRows<Record<string, unknown>>(
    db
      .prepare(
        "SELECT ri.catalog_product_id AS productId, ri.product_name AS productName, " +
          "SUM(CASE WHEN ri.requested_quantity > ri.confirmed_quantity THEN ri.requested_quantity - ri.confirmed_quantity ELSE 0 END) AS lostQuantity, " +
          "SUM(CASE WHEN ri.requested_quantity > ri.confirmed_quantity THEN (ri.requested_quantity - ri.confirmed_quantity) * ri.unit_price_minor ELSE 0 END) AS lostValueMinor, " +
          "SUM(ri.requested_quantity) AS requestedQuantity, SUM(ri.confirmed_quantity) AS confirmedQuantity, COUNT(DISTINCT o.id) AS affectedOrders " +
          "FROM order_revision_items ri INNER JOIN order_revisions r ON r.id = ri.revision_id INNER JOIN orders o ON o.id = r.order_id " +
          "WHERE o.data_class = 'BUSINESS' AND o.admin_hidden_at IS NULL AND o.created_at >= ? AND r.state IN ('SENT','ACCEPTED') AND r.id = (SELECT r2.id FROM order_revisions r2 WHERE r2.order_id = o.id AND r2.state IN ('SENT','ACCEPTED') ORDER BY r2.revision_number DESC LIMIT 1) " +
          "GROUP BY ri.catalog_product_id, ri.product_name HAVING lostQuantity > 0 ORDER BY lostValueMinor DESC, lostQuantity DESC LIMIT 12",
      )
      .bind(since),
  );

  const refundReasons = await allRows<Record<string, unknown>>(
    db
      .prepare(
        "SELECT r.reason_code AS reasonCode, COUNT(*) AS count, SUM(r.amount_minor) AS amountMinor " +
          "FROM refunds r INNER JOIN orders o ON o.id = r.order_id WHERE o.data_class = 'BUSINESS' AND o.admin_hidden_at IS NULL AND o.created_at >= ? " +
          "GROUP BY r.reason_code ORDER BY amountMinor DESC, count DESC",
      )
      .bind(since),
  );

  const cancellationReasons = await allRows<Record<string, unknown>>(
    db
      .prepare(
        "SELECT CASE WHEN e.note IS NULL OR trim(e.note) = '' THEN 'No reason recorded' ELSE trim(e.note) END AS reason, COUNT(*) AS count " +
          "FROM order_events e INNER JOIN orders o ON o.id = e.order_id " +
          "WHERE o.data_class = 'BUSINESS' AND o.admin_hidden_at IS NULL AND o.created_at >= ? AND e.event_type IN ('ORDER_CANCELLED','ORDER_REFUNDED_AND_CANCELLED') " +
          "GROUP BY CASE WHEN e.note IS NULL OR trim(e.note) = '' THEN 'No reason recorded' ELSE trim(e.note) END ORDER BY count DESC LIMIT 10",
      )
      .bind(since),
  );

  const eventTimes = await allRows<Record<string, unknown>>(
    db
      .prepare(
        "SELECT e.order_id AS orderId, e.event_type AS eventType, MIN(e.created_at) AS createdAt " +
          "FROM order_events e INNER JOIN orders o ON o.id = e.order_id " +
          "WHERE o.data_class = 'BUSINESS' AND o.admin_hidden_at IS NULL AND o.created_at >= ? AND e.event_type IN ('ORDER_SUBMITTED','ORDER_REVIEW_STARTED','ORDER_QUOTED','ORDER_REVISION_SENT','PAYMENT_REQUEST_SENT','PAYMENT_CONFIRMED','ORDER_READY_FOR_COLLECTION','ORDER_SHIPPED','ORDER_COMPLETED') " +
          "GROUP BY e.order_id, e.event_type ORDER BY e.order_id",
      )
      .bind(since),
  );

  const eventByOrder = new Map<string, Map<string, number>>();
  for (const row of eventTimes) {
    const orderId = String(row.orderId ?? "");
    const at = Date.parse(String(row.createdAt ?? ""));
    if (!orderId || !Number.isFinite(at)) continue;
    if (!eventByOrder.has(orderId)) eventByOrder.set(orderId, new Map());
    eventByOrder.get(orderId)!.set(String(row.eventType), at);
  }

  const durations: Record<string, number[]> = {
    reviewMinutes: [],
    quoteMinutes: [],
    paymentMinutes: [],
    fulfilmentMinutes: [],
    completionMinutes: [],
  };

  const pushDuration = (
    bucket: string,
    start: number | undefined,
    end: number | undefined,
  ) => {
    if (start === undefined || end === undefined || end < start) return;
    durations[bucket].push((end - start) / 60000);
  };

  for (const events of eventByOrder.values()) {
    const submitted = events.get("ORDER_SUBMITTED");
    const review = events.get("ORDER_REVIEW_STARTED");
    const quote =
      events.get("ORDER_REVISION_SENT") ?? events.get("ORDER_QUOTED");
    const paymentRequest = events.get("PAYMENT_REQUEST_SENT");
    const paid = events.get("PAYMENT_CONFIRMED");
    const ready =
      events.get("ORDER_READY_FOR_COLLECTION") ?? events.get("ORDER_SHIPPED");
    const completed = events.get("ORDER_COMPLETED");

    pushDuration("reviewMinutes", submitted, review);
    pushDuration("quoteMinutes", review, quote);
    pushDuration("paymentMinutes", paymentRequest, paid);
    pushDuration("fulfilmentMinutes", paid, ready);
    pushDuration("completionMinutes", ready, completed);
  }

  const average = (values: number[]): number =>
    values.length
      ? Math.round(
          values.reduce((sum, value) => sum + value, 0) / values.length,
        )
      : 0;

  const ageingQueues = await allRows<Record<string, unknown>>(
    db.prepare(
      "SELECT public_reference AS publicReference, customer_name AS customerName, status, payment_status AS paymentStatus, fulfilment_method AS fulfilmentMethod, created_at AS createdAt, updated_at AS updatedAt " +
        "FROM orders WHERE data_class = 'BUSINESS' AND admin_hidden_at IS NULL AND status IN ('SUBMITTED','AWAITING_PAYMENT','READY_FOR_COLLECTION') " +
        "ORDER BY CASE status WHEN 'SUBMITTED' THEN 1 WHEN 'AWAITING_PAYMENT' THEN 2 ELSE 3 END, updated_at ASC LIMIT 40",
    ),
  );

  const emailFailures = await allRows<Record<string, unknown>>(
    db
      .prepare(
        "SELECT publicReference, customerName, eventType, createdAt, isActive FROM (" +
          "SELECT o.public_reference AS publicReference, o.customer_name AS customerName, m.delivery_status AS eventType, m.updated_at AS createdAt, 1 AS isActive " +
          "FROM order_messages m INNER JOIN orders o ON o.id = m.order_id " +
          "WHERE o.data_class = 'BUSINESS' AND o.admin_hidden_at IS NULL AND o.created_at >= ? AND m.delivery_status IN ('FAILED','BOUNCED','COMPLAINED','DELAYED') " +
          "UNION ALL " +
          "SELECT o.public_reference AS publicReference, o.customer_name AS customerName, e.event_type AS eventType, e.created_at AS createdAt, 0 AS isActive " +
          "FROM order_events e INNER JOIN orders o ON o.id = e.order_id " +
          "WHERE o.data_class = 'BUSINESS' AND o.admin_hidden_at IS NULL AND o.created_at >= ? AND e.event_type LIKE '%_FAILED' AND NOT EXISTS (" +
          "SELECT 1 FROM order_messages m2 WHERE m2.order_id = o.id AND m2.delivery_status = 'FAILED' AND abs(strftime('%s',m2.updated_at)-strftime('%s',e.created_at)) < 300" +
          ")" +
          ") ORDER BY createdAt DESC LIMIT 30",
      )
      .bind(since, since),
  );

  const activeEmailFailureCount = emailFailures.reduce(
    (count, row) => count + (number(row.isActive) === 1 ? 1 : 0),
    0,
  );

  const topCustomers = await allRows<Record<string, unknown>>(
    db
      .prepare(
        "SELECT lower(o.customer_email) AS customerEmail, MAX(o.customer_name) AS customerName, COUNT(*) AS orderCount, " +
          "COALESCE(SUM(CASE WHEN o.payment_status IN ('PAID','REFUNDED') THEN " +
          effectiveTotalSql +
          " ELSE 0 END),0) - COALESCE(SUM((SELECT COALESCE(SUM(rf.amount_minor),0) FROM refunds rf WHERE rf.order_id = o.id)),0) AS revenueMinor " +
          "FROM orders o WHERE o.data_class = 'BUSINESS' AND o.admin_hidden_at IS NULL AND o.created_at >= ? GROUP BY lower(o.customer_email) ORDER BY revenueMinor DESC, orderCount DESC LIMIT 10",
      )
      .bind(since),
  );

  const busiestHours = await allRows<Record<string, unknown>>(
    db
      .prepare(
        "SELECT substr(created_at,12,2) AS hour, COUNT(*) AS count FROM orders WHERE data_class = 'BUSINESS' AND admin_hidden_at IS NULL AND created_at >= ? GROUP BY substr(created_at,12,2) ORDER BY count DESC, hour ASC LIMIT 6",
      )
      .bind(since),
  );

  return {
    periodDays,
    since,
    generatedAt: new Date().toISOString(),
    summary: {
      orderCount,
      grossRevenueMinor,
      refundedMinor,
      revenueMinor: netRevenueMinor,
      paidCount,
      paymentRequestedCount,
      refundedOrders,
      cancelledOrders: number(summaryRow.cancelledOrders),
      collectionCount: number(summaryRow.collectionCount),
      deliveryCount: number(summaryRow.deliveryCount),
      averageOrderValueMinor:
        paidCount > 0 ? Math.round(netRevenueMinor / paidCount) : 0,
      conversionToPaid:
        paymentRequestedCount > 0
          ? Math.round((paidCount / paymentRequestedCount) * 1000) / 10
          : 0,
      refundRate:
        paidCount > 0
          ? Math.round((refundedOrders / paidCount) * 1000) / 10
          : 0,
      emailFailureCount: activeEmailFailureCount,
    },
    statusCounts,
    revenueTrend,
    topProducts,
    topCustomers,
    busiestHours,
    availabilityLoss,
    refundReasons,
    cancellationReasons,
    operations: {
      averageReviewMinutes: average(durations.reviewMinutes),
      averageQuoteMinutes: average(durations.quoteMinutes),
      averagePaymentMinutes: average(durations.paymentMinutes),
      averageFulfilmentMinutes: average(durations.fulfilmentMinutes),
      averageCompletionMinutes: average(durations.completionMinutes),
    },
    ageingQueues,
    emailFailures,
  };
}
