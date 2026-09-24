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
        id,
        public_reference AS publicReference,
        status,
        fulfilment_method AS fulfilmentMethod,
        items_subtotal_minor AS itemsSubtotalMinor,
        delivery_amount_minor AS deliveryAmountMinor,
        final_total_minor AS finalTotalMinor,
        payment_status AS paymentStatus
      FROM orders
      WHERE public_reference = ?
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
        tracking_reference AS trackingReference,
        tracking_url AS trackingUrl,
        created_at AS createdAt,
        updated_at AS updatedAt,
        quoted_at AS quotedAt,
        paid_at AS paidAt,
        shipped_at AS shippedAt,
        completed_at AS completedAt,
        cancelled_at AS cancelledAt
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
