import {
  d1StatementChanged,
  type D1DatabaseLike,
  type D1PreparedStatementLike,
} from "./d1";
import type { AdminOrderState, ValidatedAdminAction } from "../domain/admin-order";
import { getAdminReportsV2 } from "./admin-reports-v2";
import {
  getActiveReservationReleasePlan,
  getCommittedReservationPlan,
  prepareReservationCommitMutation,
  prepareReservationConsumeMutation,
  prepareReservationReleaseMutation,
  type ActiveReservationReleasePlan,
} from "./order-reservations";

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
  dataClass: "BUSINESS" | "TEST" | "E2E" = "BUSINESS",
): Promise<OrderSummaryRow[]> {
  const activeRevision = `r.order_id = o.id AND r.state IN ('SENT', 'ACCEPTED')`;
  const base = `SELECT
      o.id,
      o.public_reference AS publicReference,
      o.status,
      COALESCE(
        (SELECT r.fulfilment_method FROM order_revisions r WHERE ${activeRevision} ORDER BY r.revision_number DESC LIMIT 1),
        o.fulfilment_method
      ) AS fulfilmentMethod,
      o.customer_name AS customerName,
      o.customer_email AS customerEmail,
      COALESCE(
        (SELECT r.items_subtotal_minor FROM order_revisions r WHERE ${activeRevision} ORDER BY r.revision_number DESC LIMIT 1),
        o.items_subtotal_minor
      ) AS itemsSubtotalMinor,
      COALESCE(
        (SELECT r.delivery_amount_minor FROM order_revisions r WHERE ${activeRevision} ORDER BY r.revision_number DESC LIMIT 1),
        o.delivery_amount_minor
      ) AS deliveryAmountMinor,
      COALESCE(
        (SELECT r.final_total_minor FROM order_revisions r WHERE ${activeRevision} ORDER BY r.revision_number DESC LIMIT 1),
        o.final_total_minor
      ) AS finalTotalMinor,
      o.payment_status AS paymentStatus,
      o.created_at AS createdAt,
      o.updated_at AS updatedAt
    FROM orders o`;

  const testData = dataClass === "TEST" || dataClass === "E2E";
  const visibility = testData
    ? "o.data_class IN ('TEST','E2E') AND o.admin_hidden_at IS NULL"
    : "o.data_class = 'BUSINESS' AND o.admin_hidden_at IS NULL";
  const statement = status
    ? db
        .prepare(`${base} WHERE ${visibility} AND o.status = ? ORDER BY o.created_at DESC LIMIT 100`)
        .bind(status)
    : db.prepare(`${base} WHERE ${visibility} ORDER BY o.created_at DESC LIMIT 100`);

  return allRows<OrderSummaryRow>(statement);
}

export async function resetAdminTestOrders(
  db: D1DatabaseLike,
): Promise<{ hiddenOrders: number; resetAt: string }> {
  const countRow = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM orders WHERE data_class IN ('TEST','E2E') AND admin_hidden_at IS NULL",
    )
    .first<{ count: number }>();
  const resetAt = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        "UPDATE orders SET admin_hidden_at = ?, updated_at = ? WHERE data_class IN ('TEST','E2E') AND admin_hidden_at IS NULL",
      )
      .bind(resetAt, resetAt),
  ]);
  return { hiddenOrders: Number(countRow?.count ?? 0), resetAt };
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
        COALESCE(
          (
            SELECT r.fulfilment_method
            FROM order_revisions r
            WHERE r.order_id = o.id AND r.state IN ('SENT', 'ACCEPTED')
            ORDER BY r.revision_number DESC
            LIMIT 1
          ),
          o.fulfilment_method
        ) AS fulfilmentMethod,
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
        ) AS effectiveFinalTotalMinor,
        COALESCE(
          (
            SELECT r.fulfilment_method
            FROM order_revisions r
            WHERE r.order_id = orders.id AND r.state IN ('SENT', 'ACCEPTED')
            ORDER BY r.revision_number DESC
            LIMIT 1
          ),
          fulfilment_method
        ) AS effectiveFulfilmentMethod,
        CASE
          WHEN COALESCE(
            (
              SELECT r.fulfilment_method
              FROM order_revisions r
              WHERE r.order_id = orders.id AND r.state IN ('SENT', 'ACCEPTED')
              ORDER BY r.revision_number DESC LIMIT 1
            ),
            fulfilment_method
          ) = 'delivery'
          THEN COALESCE(
            (
              SELECT r.delivery_address_line1
              FROM order_revisions r
              WHERE r.order_id = orders.id AND r.state IN ('SENT', 'ACCEPTED')
              ORDER BY r.revision_number DESC LIMIT 1
            ),
            delivery_address_line1
          )
        END AS effectiveDeliveryAddressLine1,
        CASE
          WHEN COALESCE(
            (
              SELECT r.fulfilment_method
              FROM order_revisions r
              WHERE r.order_id = orders.id AND r.state IN ('SENT', 'ACCEPTED')
              ORDER BY r.revision_number DESC LIMIT 1
            ),
            fulfilment_method
          ) = 'delivery'
          THEN COALESCE(
            (
              SELECT r.delivery_address_line2
              FROM order_revisions r
              WHERE r.order_id = orders.id AND r.state IN ('SENT', 'ACCEPTED')
              ORDER BY r.revision_number DESC LIMIT 1
            ),
            delivery_address_line2
          )
        END AS effectiveDeliveryAddressLine2,
        CASE
          WHEN COALESCE(
            (
              SELECT r.fulfilment_method
              FROM order_revisions r
              WHERE r.order_id = orders.id AND r.state IN ('SENT', 'ACCEPTED')
              ORDER BY r.revision_number DESC LIMIT 1
            ),
            fulfilment_method
          ) = 'delivery'
          THEN COALESCE(
            (
              SELECT r.delivery_town
              FROM order_revisions r
              WHERE r.order_id = orders.id AND r.state IN ('SENT', 'ACCEPTED')
              ORDER BY r.revision_number DESC LIMIT 1
            ),
            delivery_town
          )
        END AS effectiveDeliveryTown,
        CASE
          WHEN COALESCE(
            (
              SELECT r.fulfilment_method
              FROM order_revisions r
              WHERE r.order_id = orders.id AND r.state IN ('SENT', 'ACCEPTED')
              ORDER BY r.revision_number DESC LIMIT 1
            ),
            fulfilment_method
          ) = 'delivery'
          THEN COALESCE(
            (
              SELECT r.delivery_county
              FROM order_revisions r
              WHERE r.order_id = orders.id AND r.state IN ('SENT', 'ACCEPTED')
              ORDER BY r.revision_number DESC LIMIT 1
            ),
            delivery_county
          )
        END AS effectiveDeliveryCounty,
        CASE
          WHEN COALESCE(
            (
              SELECT r.fulfilment_method
              FROM order_revisions r
              WHERE r.order_id = orders.id AND r.state IN ('SENT', 'ACCEPTED')
              ORDER BY r.revision_number DESC LIMIT 1
            ),
            fulfilment_method
          ) = 'delivery'
          THEN COALESCE(
            (
              SELECT r.delivery_postcode
              FROM order_revisions r
              WHERE r.order_id = orders.id AND r.state IN ('SENT', 'ACCEPTED')
              ORDER BY r.revision_number DESC LIMIT 1
            ),
            delivery_postcode
          )
        END AS effectiveDeliveryPostcode,
        CASE
          WHEN COALESCE(
            (
              SELECT r.fulfilment_method
              FROM order_revisions r
              WHERE r.order_id = orders.id AND r.state IN ('SENT', 'ACCEPTED')
              ORDER BY r.revision_number DESC LIMIT 1
            ),
            fulfilment_method
          ) = 'delivery'
          THEN COALESCE(
            (
              SELECT r.delivery_country
              FROM order_revisions r
              WHERE r.order_id = orders.id AND r.state IN ('SENT', 'ACCEPTED')
              ORDER BY r.revision_number DESC LIMIT 1
            ),
            delivery_country
          )
        END AS effectiveDeliveryCountry
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

export interface AdminOrderUpdateOptions {
  inventoryReservations?: boolean;
}

export async function applyAdminOrderUpdate(
  db: D1DatabaseLike,
  order: AdminOrderState,
  action: ValidatedAdminAction,
  actorEmail: string,
  options: AdminOrderUpdateOptions = {},
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

  let reservationPlan: ActiveReservationReleasePlan | null = null;
  let lifecycle:
    | "COMMIT"
    | "CONSUME"
    | "RELEASE_ACTIVE"
    | "RELEASE_COMMITTED"
    | null = null;

  if (options.inventoryReservations && order.activeRevisionId) {
    if (action.eventType === "PAYMENT_CONFIRMED") {
      lifecycle = "COMMIT";
      reservationPlan = await getActiveReservationReleasePlan(
        db,
        order.activeRevisionId,
      );
    } else if (
      action.eventType === "ORDER_SHIPPED" ||
      (action.eventType === "ORDER_COMPLETED" &&
        order.fulfilmentMethod === "collection")
    ) {
      lifecycle = "CONSUME";
      reservationPlan = await getCommittedReservationPlan(
        db,
        order.activeRevisionId,
      );
    } else if (action.eventType === "ORDER_CANCELLED") {
      lifecycle = "RELEASE_ACTIVE";
      reservationPlan = await getActiveReservationReleasePlan(
        db,
        order.activeRevisionId,
      );
    } else if (
      action.eventType === "ORDER_REFUNDED_AND_CANCELLED" &&
      order.status !== "SHIPPED"
    ) {
      lifecycle = "RELEASE_COMMITTED";
      reservationPlan = await getCommittedReservationPlan(
        db,
        order.activeRevisionId,
      );
    }
  }

  values.push(order.id);

  const guardedLifecycle = Boolean(
    options.inventoryReservations && lifecycle && reservationPlan,
  );
  const update = guardedLifecycle
    ? db
        .prepare(
          `UPDATE orders
          SET ${assignments.join(", ")}
          WHERE id = ?
            AND status = ?
            AND payment_status = ?`,
        )
        .bind(...values, order.status, order.paymentStatus)
    : db
        .prepare(`UPDATE orders SET ${assignments.join(", ")} WHERE id = ?`)
        .bind(...values);

  const statements: D1PreparedStatementLike[] = [update];
  const nextPaymentStatus = action.paymentStatus ?? order.paymentStatus;
  const orderGuard = {
    orderId: order.id,
    status: action.nextStatus,
    paymentStatus: nextPaymentStatus,
    updatedAt: now,
  };

  if (guardedLifecycle && reservationPlan) {
    if (lifecycle === "COMMIT") {
      statements.push(
        ...prepareReservationCommitMutation(db, reservationPlan, {
          actorEmail,
          createdAt: now,
          externalOrderGuard: orderGuard,
        }).statements,
      );
    } else if (lifecycle === "CONSUME") {
      statements.push(
        ...prepareReservationConsumeMutation(db, reservationPlan, {
          actorEmail,
          createdAt: now,
          externalOrderGuard: orderGuard,
        }).statements,
      );
    } else {
      statements.push(
        ...prepareReservationReleaseMutation(db, reservationPlan, {
          actorEmail,
          sourceState:
            lifecycle === "RELEASE_COMMITTED" ? "COMMITTED" : "ACTIVE",
          reason:
            lifecycle === "RELEASE_COMMITTED"
              ? "Paid order cancelled before fulfilment"
              : "Order cancelled before payment",
          createdAt: now,
          externalOrderGuard: orderGuard,
        }).statements,
      );
    }
  }

  const event = guardedLifecycle
    ? db
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
          )
          SELECT ?, ?, ?, ?, 'admin', ?, ?, ?, ?
          WHERE EXISTS (
            SELECT 1
            FROM orders
            WHERE id = ?
              AND status = ?
              AND payment_status = ?
              AND updated_at = ?
          )`,
        )
        .bind(
          order.id,
          action.eventType,
          order.status,
          action.nextStatus,
          actorEmail,
          action.note ?? null,
          JSON.stringify({
            inventoryReservationLifecycle: lifecycle,
            reservationId: reservationPlan?.reservationId ?? null,
          }),
          now,
          order.id,
          action.nextStatus,
          nextPaymentStatus,
          now,
        )
    : db
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

  statements.push(event);

  let results: unknown[];
  try {
    results = await db.batch(statements);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (
      guardedLifecycle &&
      message.includes("inventory_reservations.mutation_token")
    ) {
      throw new Error("reservation_order_transition_conflict");
    }
    throw cause;
  }

  if (guardedLifecycle && d1StatementChanged(results[0]) === false) {
    throw new Error("reservation_order_transition_conflict");
  }
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
  revisionNumber: number | null;
  customerMessage: string | null;
  items: Array<{
    productName: string;
    quantity: number;
    lineTotalMinor: number;
  }>;
} | null> {
  const order = await db
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
        COALESCE(
          (
            SELECT r.fulfilment_method
            FROM order_revisions r
            WHERE r.order_id = o.id AND r.state IN ('SENT', 'ACCEPTED')
            ORDER BY r.revision_number DESC
            LIMIT 1
          ),
          o.fulfilment_method
        ) AS fulfilmentMethod,
        o.fulfilment_message AS fulfilmentMessage,
        (
          SELECT r.id
          FROM order_revisions r
          WHERE r.order_id = o.id AND r.state IN ('SENT', 'ACCEPTED')
          ORDER BY r.revision_number DESC
          LIMIT 1
        ) AS activeRevisionId,
        (
          SELECT r.revision_number
          FROM order_revisions r
          WHERE r.order_id = o.id AND r.state IN ('SENT', 'ACCEPTED')
          ORDER BY r.revision_number DESC
          LIMIT 1
        ) AS revisionNumber,
        (
          SELECT r.customer_message
          FROM order_revisions r
          WHERE r.order_id = o.id AND r.state IN ('SENT', 'ACCEPTED')
          ORDER BY r.revision_number DESC
          LIMIT 1
        ) AS customerMessage
      FROM orders o
      WHERE o.public_reference = ?
      LIMIT 1`,
    )
    .bind(reference)
    .first<{
      id: string;
      publicReference: string;
      customerName: string;
      customerEmail: string;
      finalTotalMinor: number | null;
      paymentRequestUrl: string | null;
      fulfilmentMethod: string;
      fulfilmentMessage: string | null;
      activeRevisionId: string | null;
      revisionNumber: number | null;
      customerMessage: string | null;
    }>();

  if (!order) return null;

  const items = order.activeRevisionId
    ? await allRows<{
        productName: string;
        quantity: number;
        lineTotalMinor: number;
      }>(
        db
          .prepare(
            `SELECT
              product_name AS productName,
              confirmed_quantity AS quantity,
              line_total_minor AS lineTotalMinor
            FROM order_revision_items
            WHERE revision_id = ? AND confirmed_quantity > 0
            ORDER BY line_number ASC`,
          )
          .bind(order.activeRevisionId),
      )
    : await allRows<{
        productName: string;
        quantity: number;
        lineTotalMinor: number;
      }>(
        db
          .prepare(
            `SELECT
              product_name AS productName,
              quantity,
              line_total_minor AS lineTotalMinor
            FROM order_items
            WHERE order_id = ?
            ORDER BY line_number ASC`,
          )
          .bind(order.id),
      );

  const { activeRevisionId: _activeRevisionId, ...snapshot } = order;
  return { ...snapshot, items };
}

export async function getAdminReports(
  db: D1DatabaseLike,
  requestedDays = 30,
): Promise<Record<string, unknown>> {
  return getAdminReportsV2(db, requestedDays);
}
