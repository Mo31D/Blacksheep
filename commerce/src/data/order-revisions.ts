import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1";
import { calculateRevisionTotals } from "../domain/order-revision";

interface OriginalOrderRow {
  id: string;
  currency: string;
  fulfilmentMethod: "delivery" | "collection";
  deliveryAmountMinor: number | null;
}

interface OriginalOrderItemRow {
  id: number;
  lineNumber: number;
  catalogProductId: string;
  sku: string | null;
  slug: string;
  productName: string;
  unitPriceMinor: number;
  quantity: number;
}

export interface OrderRevisionSummary {
  id: string;
  revisionNumber: number;
  state: string;
  version: number;
  itemsSubtotalMinor: number;
  deliveryAmountMinor: number | null;
  adjustmentAmountMinor: number;
  finalTotalMinor: number | null;
  customerMessage: string | null;
  internalNote: string | null;
  createdBy: string;
  createdAt: string;
  sentAt: string | null;
  acceptedAt: string | null;
  supersededAt: string | null;
}

async function allRows<T>(statement: D1PreparedStatementLike): Promise<T[]> {
  if (!statement.all) throw new Error("d1_all_not_supported");
  return (await statement.all<T>()).results ?? [];
}

export async function listOrderRevisions(
  db: D1DatabaseLike,
  orderReference: string,
): Promise<OrderRevisionSummary[]> {
  return allRows<OrderRevisionSummary>(
    db
      .prepare(
        `SELECT
          r.id,
          r.revision_number AS revisionNumber,
          r.state,
          r.version,
          r.items_subtotal_minor AS itemsSubtotalMinor,
          r.delivery_amount_minor AS deliveryAmountMinor,
          r.adjustment_amount_minor AS adjustmentAmountMinor,
          r.final_total_minor AS finalTotalMinor,
          r.customer_message AS customerMessage,
          r.internal_note AS internalNote,
          r.created_by AS createdBy,
          r.created_at AS createdAt,
          r.sent_at AS sentAt,
          r.accepted_at AS acceptedAt,
          r.superseded_at AS supersededAt
        FROM order_revisions r
        INNER JOIN orders o ON o.id = r.order_id
        WHERE o.public_reference = ?
        ORDER BY r.revision_number DESC`,
      )
      .bind(orderReference),
  );
}

export async function createDraftRevisionFromOriginal(
  db: D1DatabaseLike,
  orderReference: string,
  actorEmail: string,
): Promise<{
  id: string;
  revisionNumber: number;
  version: number;
  state: "DRAFT";
  itemsSubtotalMinor: number;
  deliveryAmountMinor: number | null;
  finalTotalMinor: number | null;
}> {
  const order = await db
    .prepare(
      `SELECT
        id,
        currency,
        fulfilment_method AS fulfilmentMethod,
        delivery_amount_minor AS deliveryAmountMinor
      FROM orders
      WHERE public_reference = ?
      LIMIT 1`,
    )
    .bind(orderReference)
    .first<OriginalOrderRow>();

  if (!order) throw new Error("revision_order_not_found");

  const items = await allRows<OriginalOrderItemRow>(
    db
      .prepare(
        `SELECT
          id,
          line_number AS lineNumber,
          catalog_product_id AS catalogProductId,
          sku,
          slug,
          product_name AS productName,
          unit_price_minor AS unitPriceMinor,
          quantity
        FROM order_items
        WHERE order_id = ?
        ORDER BY line_number ASC`,
      )
      .bind(order.id),
  );

  if (items.length === 0) throw new Error("revision_order_has_no_items");

  const existingDraft = await db
    .prepare(
      `SELECT id
      FROM order_revisions
      WHERE order_id = ? AND state = 'DRAFT'
      LIMIT 1`,
    )
    .bind(order.id)
    .first<{ id: string }>();

  if (existingDraft) throw new Error("revision_draft_already_exists");

  const latest = await db
    .prepare(
      `SELECT COALESCE(MAX(revision_number), 0) AS revisionNumber
      FROM order_revisions
      WHERE order_id = ?`,
    )
    .bind(order.id)
    .first<{ revisionNumber: number }>();

  const revisionNumber = Number(latest?.revisionNumber ?? 0) + 1;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const deliveryAmountMinor =
    order.fulfilmentMethod === "collection" ? 0 : order.deliveryAmountMinor;

  const totals = calculateRevisionTotals({
    items: items.map((item) => ({
      unitPriceMinor: item.unitPriceMinor,
      requestedQuantity: item.quantity,
      confirmedQuantity: item.quantity,
      availabilityStatus: "CONFIRMED" as const,
    })),
    deliveryAmountMinor,
  });

  const statements: D1PreparedStatementLike[] = [
    db
      .prepare(
        `INSERT INTO order_revisions (
          id, order_id, revision_number, state, version, currency,
          items_subtotal_minor, delivery_amount_minor, adjustment_amount_minor,
          final_total_minor, customer_message, internal_note,
          created_by, created_at
        ) VALUES (?, ?, ?, 'DRAFT', 1, ?, ?, ?, 0, ?, NULL, NULL, ?, ?)`,
      )
      .bind(
        id,
        order.id,
        revisionNumber,
        order.currency,
        totals.itemsSubtotalMinor,
        totals.deliveryAmountMinor,
        totals.finalTotalMinor,
        actorEmail,
        now,
      ),
  ];

  for (const item of items) {
    statements.push(
      db
        .prepare(
          `INSERT INTO order_revision_items (
            revision_id, line_number, source_order_item_id,
            catalog_product_id, sku, slug, product_name,
            unit_price_minor, requested_quantity, confirmed_quantity,
            availability_status, reason_code, customer_note, internal_note,
            line_total_minor, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', NULL, NULL, NULL, ?, ?, ?)`,
        )
        .bind(
          id,
          item.lineNumber,
          item.id,
          item.catalogProductId,
          item.sku,
          item.slug,
          item.productName,
          item.unitPriceMinor,
          item.quantity,
          item.quantity,
          item.unitPriceMinor * item.quantity,
          now,
          now,
        ),
    );
  }

  statements.push(
    db
      .prepare(
        `INSERT INTO order_events (
          order_id, event_type, from_status, to_status,
          actor_type, actor_id, note, metadata_json, created_at
        ) VALUES (?, 'ORDER_REVISION_DRAFT_CREATED', NULL, NULL, 'admin', ?, NULL, ?, ?)`,
      )
      .bind(
        order.id,
        actorEmail,
        JSON.stringify({ revisionId: id, revisionNumber }),
        now,
      ),
  );

  await db.batch(statements);

  return {
    id,
    revisionNumber,
    version: 1,
    state: "DRAFT",
    itemsSubtotalMinor: totals.itemsSubtotalMinor,
    deliveryAmountMinor: totals.deliveryAmountMinor,
    finalTotalMinor: totals.finalTotalMinor,
  };
}
