import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1";
import {
  calculateRevisionTotals,
  validateRevisionItem,
  type RevisionItemStatus,
  type RevisionState,
} from "../domain/order-revision";
import { requirePurchasableProduct } from "../domain/catalog";

interface OriginalOrderRow {
  id: string;
  status: string;
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

interface RevisionRow {
  id: string;
  orderId: string;
  revisionNumber: number;
  state: RevisionState;
  version: number;
  currency: string;
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
  declinedAt: string | null;
  supersededAt: string | null;
  expiresAt: string | null;
  fulfilmentMethod: "delivery" | "collection";
  orderStatus: string;
}

interface RevisionItemRow {
  id: number;
  lineNumber: number;
  sourceOrderItemId: number | null;
  catalogProductId: string;
  sku: string | null;
  slug: string;
  productName: string;
  unitPriceMinor: number;
  requestedQuantity: number;
  confirmedQuantity: number;
  availabilityStatus: RevisionItemStatus;
  reasonCode: string | null;
  customerNote: string | null;
  internalNote: string | null;
  lineTotalMinor: number;
}

export interface OrderRevisionSummary {
  id: string;
  revisionNumber: number;
  state: RevisionState;
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

export interface RevisionItemPatch {
  lineNumber: number;
  confirmedQuantity: number;
  availabilityStatus: RevisionItemStatus;
  reasonCode?: string | null;
  customerNote?: string | null;
  internalNote?: string | null;
}

export interface UpdateDraftRevisionInput {
  expectedVersion: number;
  deliveryAmountMinor?: number | null;
  customerMessage?: string | null;
  internalNote?: string | null;
  items?: RevisionItemPatch[];
}

async function allRows<T>(statement: D1PreparedStatementLike): Promise<T[]> {
  if (!statement.all) throw new Error("d1_all_not_supported");
  return (await statement.all<T>()).results ?? [];
}

function optionalText(value: unknown, max: number, code: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(code);
  const text = value.trim();
  if (text.length > max) throw new Error(code);
  return text || null;
}

async function findRevision(
  db: D1DatabaseLike,
  orderReference: string,
  revisionId: string,
): Promise<RevisionRow | null> {
  return db
    .prepare(
      `SELECT
        r.id,
        r.order_id AS orderId,
        r.revision_number AS revisionNumber,
        r.state,
        r.version,
        r.currency,
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
        r.declined_at AS declinedAt,
        r.superseded_at AS supersededAt,
        r.expires_at AS expiresAt,
        o.fulfilment_method AS fulfilmentMethod,
        o.status AS orderStatus
      FROM order_revisions r
      INNER JOIN orders o ON o.id = r.order_id
      WHERE o.public_reference = ? AND r.id = ?
      LIMIT 1`,
    )
    .bind(orderReference, revisionId)
    .first<RevisionRow>();
}

async function revisionItems(
  db: D1DatabaseLike,
  revisionId: string,
): Promise<RevisionItemRow[]> {
  return allRows<RevisionItemRow>(
    db
      .prepare(
        `SELECT
          id,
          line_number AS lineNumber,
          source_order_item_id AS sourceOrderItemId,
          catalog_product_id AS catalogProductId,
          sku,
          slug,
          product_name AS productName,
          unit_price_minor AS unitPriceMinor,
          requested_quantity AS requestedQuantity,
          confirmed_quantity AS confirmedQuantity,
          availability_status AS availabilityStatus,
          reason_code AS reasonCode,
          customer_note AS customerNote,
          internal_note AS internalNote,
          line_total_minor AS lineTotalMinor
        FROM order_revision_items
        WHERE revision_id = ?
        ORDER BY line_number ASC`,
      )
      .bind(revisionId),
  );
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

export async function getOrderRevisionDetail(
  db: D1DatabaseLike,
  orderReference: string,
  revisionId: string,
): Promise<Record<string, unknown> | null> {
  const revision = await findRevision(db, orderReference, revisionId);
  if (!revision) return null;

  const [items, adjustments] = await Promise.all([
    revisionItems(db, revisionId),
    allRows<Record<string, unknown>>(
      db
        .prepare(
          `SELECT
            id,
            kind,
            label,
            amount_minor AS amountMinor,
            internal_reason AS internalReason,
            created_by AS createdBy,
            created_at AS createdAt
          FROM order_adjustments
          WHERE revision_id = ?
          ORDER BY id ASC`,
        )
        .bind(revisionId),
    ),
  ]);

  return { ...revision, items, adjustments };
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
        status,
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
  if (!["UNDER_REVIEW", "QUOTED"].includes(order.status)) {
    throw new Error("revision_order_not_editable");
  }

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

export async function updateDraftRevision(
  db: D1DatabaseLike,
  orderReference: string,
  revisionId: string,
  input: UpdateDraftRevisionInput,
  actorEmail: string,
): Promise<Record<string, unknown>> {
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new Error("revision_expected_version_required");
  }

  const revision = await findRevision(db, orderReference, revisionId);
  if (!revision) throw new Error("revision_not_found");
  if (revision.state !== "DRAFT") throw new Error("revision_not_draft");
  if (revision.version !== input.expectedVersion) {
    throw new Error("revision_version_conflict");
  }

  const storedItems = await revisionItems(db, revisionId);
  if (storedItems.length === 0) throw new Error("revision_has_no_items");

  const patches = new Map<number, RevisionItemPatch>();
  for (const patch of input.items ?? []) {
    if (!Number.isInteger(patch.lineNumber) || patch.lineNumber < 1) {
      throw new Error("revision_invalid_line_number");
    }
    if (patches.has(patch.lineNumber)) throw new Error("revision_duplicate_line_patch");
    patches.set(patch.lineNumber, patch);
  }

  const merged = storedItems.map((item) => {
    const patch = patches.get(item.lineNumber);
    const candidate = {
      unitPriceMinor: item.unitPriceMinor,
      requestedQuantity: item.requestedQuantity,
      confirmedQuantity: patch?.confirmedQuantity ?? item.confirmedQuantity,
      availabilityStatus: patch?.availabilityStatus ?? item.availabilityStatus,
    };
    validateRevisionItem(candidate);
    return {
      ...item,
      ...candidate,
      reasonCode:
        patch && "reasonCode" in patch
          ? optionalText(patch.reasonCode, 80, "revision_invalid_reason_code")
          : item.reasonCode,
      customerNote:
        patch && "customerNote" in patch
          ? optionalText(patch.customerNote, 500, "revision_invalid_customer_note")
          : item.customerNote,
      internalNote:
        patch && "internalNote" in patch
          ? optionalText(patch.internalNote, 1000, "revision_invalid_internal_note")
          : item.internalNote,
      lineTotalMinor: candidate.unitPriceMinor * candidate.confirmedQuantity,
    };
  });

  for (const lineNumber of patches.keys()) {
    if (!storedItems.some((item) => item.lineNumber === lineNumber)) {
      throw new Error("revision_unknown_line");
    }
  }

  let deliveryAmountMinor =
    input.deliveryAmountMinor === undefined
      ? revision.deliveryAmountMinor
      : input.deliveryAmountMinor;

  if (revision.fulfilmentMethod === "collection") {
    if (deliveryAmountMinor !== null && deliveryAmountMinor !== 0) {
      throw new Error("revision_collection_delivery_must_be_zero");
    }
    deliveryAmountMinor = 0;
  }

  const totals = calculateRevisionTotals({
    items: merged,
    deliveryAmountMinor,
    adjustmentAmountMinor: revision.adjustmentAmountMinor,
  });

  const customerMessage =
    input.customerMessage === undefined
      ? revision.customerMessage
      : optionalText(input.customerMessage, 2000, "revision_invalid_customer_message");
  const internalNote =
    input.internalNote === undefined
      ? revision.internalNote
      : optionalText(input.internalNote, 3000, "revision_invalid_internal_note");

  const now = new Date().toISOString();
  const nextVersion = revision.version + 1;
  const statements: D1PreparedStatementLike[] = [
    db
      .prepare(
        `UPDATE order_revisions
        SET version = ?,
            items_subtotal_minor = ?,
            delivery_amount_minor = ?,
            final_total_minor = ?,
            customer_message = ?,
            internal_note = ?
        WHERE id = ? AND version = ? AND state = 'DRAFT'`,
      )
      .bind(
        nextVersion,
        totals.itemsSubtotalMinor,
        totals.deliveryAmountMinor,
        totals.finalTotalMinor,
        customerMessage,
        internalNote,
        revisionId,
        revision.version,
      ),
  ];

  for (const item of merged) {
    statements.push(
      db
        .prepare(
          `UPDATE order_revision_items
          SET confirmed_quantity = ?,
              availability_status = ?,
              reason_code = ?,
              customer_note = ?,
              internal_note = ?,
              line_total_minor = ?,
              updated_at = ?
          WHERE revision_id = ? AND line_number = ?
            AND EXISTS (
              SELECT 1 FROM order_revisions
              WHERE id = ? AND version = ? AND state = 'DRAFT'
            )`,
        )
        .bind(
          item.confirmedQuantity,
          item.availabilityStatus,
          item.reasonCode,
          item.customerNote,
          item.internalNote,
          item.lineTotalMinor,
          now,
          revisionId,
          item.lineNumber,
          revisionId,
          nextVersion,
        ),
    );
  }

  statements.push(
    db
      .prepare(
        `INSERT INTO order_events (
          order_id, event_type, from_status, to_status,
          actor_type, actor_id, note, metadata_json, created_at
        )
        SELECT ?, 'ORDER_REVISION_UPDATED', NULL, NULL, 'admin', ?, NULL, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM order_revisions
          WHERE id = ? AND version = ? AND state = 'DRAFT'
        )`,
      )
      .bind(
        revision.orderId,
        actorEmail,
        JSON.stringify({
          revisionId,
          revisionNumber: revision.revisionNumber,
          version: nextVersion,
        }),
        now,
        revisionId,
        nextVersion,
      ),
  );

  await db.batch(statements);

  const updated = await findRevision(db, orderReference, revisionId);
  if (!updated || updated.version !== nextVersion) {
    throw new Error("revision_version_conflict");
  }

  return (await getOrderRevisionDetail(db, orderReference, revisionId))!;
}

export async function transitionOrderRevision(
  db: D1DatabaseLike,
  orderReference: string,
  revisionId: string,
  action: "send" | "accept" | "decline",
  expectedVersion: number,
  actorEmail: string,
): Promise<Record<string, unknown>> {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new Error("revision_expected_version_required");
  }

  const revision = await findRevision(db, orderReference, revisionId);
  if (!revision) throw new Error("revision_not_found");
  if (revision.version !== expectedVersion) throw new Error("revision_version_conflict");

  const now = new Date().toISOString();
  const nextVersion = revision.version + 1;
  const statements: D1PreparedStatementLike[] = [];

  if (action === "send") {
    if (revision.state !== "DRAFT") throw new Error("revision_send_requires_draft");
    if (revision.finalTotalMinor === null) throw new Error("revision_total_required");

    statements.push(
      db
        .prepare(
          `UPDATE order_revisions
          SET state = 'SUPERSEDED', superseded_at = ?, version = version + 1
          WHERE order_id = ? AND state = 'SENT' AND id <> ?`,
        )
        .bind(now, revision.orderId, revisionId),
    );
    statements.push(
      db
        .prepare(
          `UPDATE order_revisions
          SET state = 'SENT', sent_at = ?, version = ?
          WHERE id = ? AND version = ? AND state = 'DRAFT'`,
        )
        .bind(now, nextVersion, revisionId, revision.version),
    );
    statements.push(
      db
        .prepare(
          `UPDATE orders
          SET status = 'QUOTED', updated_at = ?, quoted_at = COALESCE(quoted_at, ?)
          WHERE id = ? AND status IN ('UNDER_REVIEW', 'QUOTED')`,
        )
        .bind(now, now, revision.orderId),
    );
  } else if (action === "accept") {
    if (revision.state !== "SENT") throw new Error("revision_accept_requires_sent");
    statements.push(
      db
        .prepare(
          `UPDATE order_revisions
          SET state = 'ACCEPTED', accepted_at = ?, version = ?
          WHERE id = ? AND version = ? AND state = 'SENT'`,
        )
        .bind(now, nextVersion, revisionId, revision.version),
    );
  } else {
    if (revision.state !== "SENT") throw new Error("revision_decline_requires_sent");
    statements.push(
      db
        .prepare(
          `UPDATE order_revisions
          SET state = 'DECLINED', declined_at = ?, version = ?
          WHERE id = ? AND version = ? AND state = 'SENT'`,
        )
        .bind(now, nextVersion, revisionId, revision.version),
    );
  }

  const eventType =
    action === "send"
      ? "ORDER_REVISION_SENT"
      : action === "accept"
        ? "ORDER_REVISION_ACCEPTED"
        : "ORDER_REVISION_DECLINED";

  statements.push(
    db
      .prepare(
        `INSERT INTO order_events (
          order_id, event_type, from_status, to_status,
          actor_type, actor_id, note, metadata_json, created_at
        )
        SELECT ?, ?, ?, ?, 'admin', ?, NULL, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM order_revisions
          WHERE id = ? AND version = ?
        )`,
      )
      .bind(
        revision.orderId,
        eventType,
        action === "send" ? revision.orderStatus : null,
        action === "send" ? "QUOTED" : null,
        actorEmail,
        JSON.stringify({
          revisionId,
          revisionNumber: revision.revisionNumber,
          version: nextVersion,
        }),
        now,
        revisionId,
        nextVersion,
      ),
  );

  await db.batch(statements);

  const updated = await findRevision(db, orderReference, revisionId);
  if (!updated || updated.version !== nextVersion) {
    throw new Error("revision_version_conflict");
  }

  return (await getOrderRevisionDetail(db, orderReference, revisionId))!;
}


export interface AddRevisionCatalogItemInput {
  expectedVersion: number;
  catalogProductId: string;
  quantity: number;
  customerNote?: string | null;
  internalNote?: string | null;
}

export interface SubstituteRevisionCatalogItemInput
  extends AddRevisionCatalogItemInput {
  lineNumber: number;
}

function requireExpectedVersion(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("revision_expected_version_required");
  }
}

function requireQuantity(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 99) {
    throw new Error("revision_invalid_confirmed_quantity");
  }
}

async function verifyMutationVersion(
  db: D1DatabaseLike,
  orderReference: string,
  revisionId: string,
  expectedVersion: number,
): Promise<Record<string, unknown>> {
  const updated = await findRevision(db, orderReference, revisionId);
  if (!updated || updated.version !== expectedVersion) {
    throw new Error("revision_version_conflict");
  }
  return (await getOrderRevisionDetail(db, orderReference, revisionId))!;
}

export async function addCatalogItemToDraftRevision(
  db: D1DatabaseLike,
  orderReference: string,
  revisionId: string,
  input: AddRevisionCatalogItemInput,
  actorEmail: string,
): Promise<Record<string, unknown>> {
  requireExpectedVersion(input.expectedVersion);
  requireQuantity(input.quantity);

  const revision = await findRevision(db, orderReference, revisionId);
  if (!revision) throw new Error("revision_not_found");
  if (revision.state !== "DRAFT") throw new Error("revision_not_draft");
  if (revision.version !== input.expectedVersion) {
    throw new Error("revision_version_conflict");
  }

  const product = requirePurchasableProduct(String(input.catalogProductId || ""));
  if (product.priceMinor === null) throw new Error("price_unavailable");

  const items = await revisionItems(db, revisionId);
  if (items.some((item) => item.catalogProductId === product.id)) {
    throw new Error("revision_product_already_present");
  }

  const nextLineNumber =
    items.reduce((maximum, item) => Math.max(maximum, item.lineNumber), 0) + 1;
  const newItem = {
    unitPriceMinor: product.priceMinor,
    requestedQuantity: 0,
    confirmedQuantity: input.quantity,
    availabilityStatus: "ADDED" as const,
  };
  validateRevisionItem(newItem);

  const totals = calculateRevisionTotals({
    items: [
      ...items.map((item) => ({
        unitPriceMinor: item.unitPriceMinor,
        requestedQuantity: item.requestedQuantity,
        confirmedQuantity: item.confirmedQuantity,
        availabilityStatus: item.availabilityStatus,
      })),
      newItem,
    ],
    deliveryAmountMinor:
      revision.fulfilmentMethod === "collection" ? 0 : revision.deliveryAmountMinor,
    adjustmentAmountMinor: revision.adjustmentAmountMinor,
  });

  const now = new Date().toISOString();
  const nextVersion = revision.version + 1;
  const customerNote = optionalText(
    input.customerNote,
    500,
    "revision_invalid_customer_note",
  );
  const internalNote = optionalText(
    input.internalNote,
    1000,
    "revision_invalid_internal_note",
  );

  await db.batch([
    db
      .prepare(
        `UPDATE order_revisions
        SET version = ?, items_subtotal_minor = ?, final_total_minor = ?
        WHERE id = ? AND version = ? AND state = 'DRAFT'`,
      )
      .bind(
        nextVersion,
        totals.itemsSubtotalMinor,
        totals.finalTotalMinor,
        revisionId,
        revision.version,
      ),
    db
      .prepare(
        `INSERT INTO order_revision_items (
          revision_id, line_number, source_order_item_id,
          catalog_product_id, sku, slug, product_name,
          unit_price_minor, requested_quantity, confirmed_quantity,
          availability_status, reason_code, customer_note, internal_note,
          line_total_minor, created_at, updated_at
        )
        SELECT ?, ?, NULL, ?, ?, ?, ?, ?, 0, ?, 'ADDED', 'OWNER_ADDED', ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM order_revisions
          WHERE id = ? AND version = ? AND state = 'DRAFT'
        )`,
      )
      .bind(
        revisionId,
        nextLineNumber,
        product.id,
        product.sku,
        product.slug,
        product.name,
        product.priceMinor,
        input.quantity,
        customerNote,
        internalNote,
        product.priceMinor * input.quantity,
        now,
        now,
        revisionId,
        nextVersion,
      ),
    db
      .prepare(
        `INSERT INTO order_events (
          order_id, event_type, from_status, to_status,
          actor_type, actor_id, note, metadata_json, created_at
        )
        SELECT ?, 'ORDER_REVISION_ITEM_ADDED', NULL, NULL, 'admin', ?, NULL, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM order_revisions
          WHERE id = ? AND version = ?
        )`,
      )
      .bind(
        revision.orderId,
        actorEmail,
        JSON.stringify({
          revisionId,
          revisionNumber: revision.revisionNumber,
          lineNumber: nextLineNumber,
          catalogProductId: product.id,
          quantity: input.quantity,
          version: nextVersion,
        }),
        now,
        revisionId,
        nextVersion,
      ),
  ]);

  return verifyMutationVersion(
    db,
    orderReference,
    revisionId,
    nextVersion,
  );
}

export async function substituteDraftRevisionLine(
  db: D1DatabaseLike,
  orderReference: string,
  revisionId: string,
  input: SubstituteRevisionCatalogItemInput,
  actorEmail: string,
): Promise<Record<string, unknown>> {
  requireExpectedVersion(input.expectedVersion);
  requireQuantity(input.quantity);
  if (!Number.isInteger(input.lineNumber) || input.lineNumber < 1) {
    throw new Error("revision_invalid_line_number");
  }

  const revision = await findRevision(db, orderReference, revisionId);
  if (!revision) throw new Error("revision_not_found");
  if (revision.state !== "DRAFT") throw new Error("revision_not_draft");
  if (revision.version !== input.expectedVersion) {
    throw new Error("revision_version_conflict");
  }

  const product = requirePurchasableProduct(String(input.catalogProductId || ""));
  if (product.priceMinor === null) throw new Error("price_unavailable");

  const items = await revisionItems(db, revisionId);
  const target = items.find((item) => item.lineNumber === input.lineNumber);
  if (!target) throw new Error("revision_unknown_line");
  if (target.catalogProductId === product.id) {
    throw new Error("revision_substitute_must_change_product");
  }

  const replacement = {
    unitPriceMinor: product.priceMinor,
    requestedQuantity: target.requestedQuantity,
    confirmedQuantity: input.quantity,
    availabilityStatus: "SUBSTITUTE" as const,
  };
  validateRevisionItem(replacement);

  const totals = calculateRevisionTotals({
    items: items.map((item) =>
      item.lineNumber === input.lineNumber
        ? replacement
        : {
            unitPriceMinor: item.unitPriceMinor,
            requestedQuantity: item.requestedQuantity,
            confirmedQuantity: item.confirmedQuantity,
            availabilityStatus: item.availabilityStatus,
          },
    ),
    deliveryAmountMinor:
      revision.fulfilmentMethod === "collection" ? 0 : revision.deliveryAmountMinor,
    adjustmentAmountMinor: revision.adjustmentAmountMinor,
  });

  const now = new Date().toISOString();
  const nextVersion = revision.version + 1;
  const customerNote = optionalText(
    input.customerNote,
    500,
    "revision_invalid_customer_note",
  );
  const internalNote = optionalText(
    input.internalNote,
    1000,
    "revision_invalid_internal_note",
  );

  await db.batch([
    db
      .prepare(
        `UPDATE order_revisions
        SET version = ?, items_subtotal_minor = ?, final_total_minor = ?
        WHERE id = ? AND version = ? AND state = 'DRAFT'`,
      )
      .bind(
        nextVersion,
        totals.itemsSubtotalMinor,
        totals.finalTotalMinor,
        revisionId,
        revision.version,
      ),
    db
      .prepare(
        `UPDATE order_revision_items
        SET catalog_product_id = ?,
            sku = ?,
            slug = ?,
            product_name = ?,
            unit_price_minor = ?,
            confirmed_quantity = ?,
            availability_status = 'SUBSTITUTE',
            reason_code = 'SUBSTITUTE_OFFERED',
            customer_note = ?,
            internal_note = ?,
            line_total_minor = ?,
            updated_at = ?
        WHERE revision_id = ? AND line_number = ?
          AND EXISTS (
            SELECT 1 FROM order_revisions
            WHERE id = ? AND version = ? AND state = 'DRAFT'
          )`,
      )
      .bind(
        product.id,
        product.sku,
        product.slug,
        product.name,
        product.priceMinor,
        input.quantity,
        customerNote,
        internalNote,
        product.priceMinor * input.quantity,
        now,
        revisionId,
        input.lineNumber,
        revisionId,
        nextVersion,
      ),
    db
      .prepare(
        `INSERT INTO order_events (
          order_id, event_type, from_status, to_status,
          actor_type, actor_id, note, metadata_json, created_at
        )
        SELECT ?, 'ORDER_REVISION_ITEM_SUBSTITUTED', NULL, NULL, 'admin', ?, NULL, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM order_revisions
          WHERE id = ? AND version = ?
        )`,
      )
      .bind(
        revision.orderId,
        actorEmail,
        JSON.stringify({
          revisionId,
          revisionNumber: revision.revisionNumber,
          lineNumber: input.lineNumber,
          originalCatalogProductId: target.catalogProductId,
          substituteCatalogProductId: product.id,
          quantity: input.quantity,
          version: nextVersion,
        }),
        now,
        revisionId,
        nextVersion,
      ),
  ]);

  return verifyMutationVersion(
    db,
    orderReference,
    revisionId,
    nextVersion,
  );
}
