import {
  d1StatementChanged,
  type D1DatabaseLike,
  type D1PreparedStatementLike,
} from "./d1";
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
  deliveryAddressLine1: string | null;
  deliveryAddressLine2: string | null;
  deliveryTown: string | null;
  deliveryCounty: string | null;
  deliveryPostcode: string | null;
  deliveryCountry: string | null;
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
  mutationToken: string | null;
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
  deliveryAddressLine1: string | null;
  deliveryAddressLine2: string | null;
  deliveryTown: string | null;
  deliveryCounty: string | null;
  deliveryPostcode: string | null;
  deliveryCountry: string | null;
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

export interface RevisionDeliveryAddressInput {
  line1: string;
  line2?: string | null;
  town: string;
  county?: string | null;
  postcode: string;
  country?: string | null;
}

export interface UpdateDraftRevisionInput {
  expectedVersion: number;
  fulfilmentMethod?: "delivery" | "collection";
  deliveryAddress?: RevisionDeliveryAddressInput | null;
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
        r.mutation_token AS mutationToken,
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
        COALESCE(r.fulfilment_method, o.fulfilment_method) AS fulfilmentMethod,
        CASE WHEN COALESCE(r.fulfilment_method, o.fulfilment_method) = 'delivery'
          THEN COALESCE(r.delivery_address_line1, o.delivery_address_line1) END AS deliveryAddressLine1,
        CASE WHEN COALESCE(r.fulfilment_method, o.fulfilment_method) = 'delivery'
          THEN COALESCE(r.delivery_address_line2, o.delivery_address_line2) END AS deliveryAddressLine2,
        CASE WHEN COALESCE(r.fulfilment_method, o.fulfilment_method) = 'delivery'
          THEN COALESCE(r.delivery_town, o.delivery_town) END AS deliveryTown,
        CASE WHEN COALESCE(r.fulfilment_method, o.fulfilment_method) = 'delivery'
          THEN COALESCE(r.delivery_county, o.delivery_county) END AS deliveryCounty,
        CASE WHEN COALESCE(r.fulfilment_method, o.fulfilment_method) = 'delivery'
          THEN COALESCE(r.delivery_postcode, o.delivery_postcode) END AS deliveryPostcode,
        CASE WHEN COALESCE(r.fulfilment_method, o.fulfilment_method) = 'delivery'
          THEN COALESCE(r.delivery_country, o.delivery_country) END AS deliveryCountry,
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
        delivery_amount_minor AS deliveryAmountMinor,
        delivery_address_line1 AS deliveryAddressLine1,
        delivery_address_line2 AS deliveryAddressLine2,
        delivery_town AS deliveryTown,
        delivery_county AS deliveryCounty,
        delivery_postcode AS deliveryPostcode,
        delivery_country AS deliveryCountry
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
          fulfilment_method,
          delivery_address_line1, delivery_address_line2, delivery_town,
          delivery_county, delivery_postcode, delivery_country,
          created_by, created_at
        ) VALUES (?, ?, ?, 'DRAFT', 1, ?, ?, ?, 0, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        order.id,
        revisionNumber,
        order.currency,
        totals.itemsSubtotalMinor,
        totals.deliveryAmountMinor,
        totals.finalTotalMinor,
        order.fulfilmentMethod,
        order.fulfilmentMethod === "delivery" ? order.deliveryAddressLine1 : null,
        order.fulfilmentMethod === "delivery" ? order.deliveryAddressLine2 : null,
        order.fulfilmentMethod === "delivery" ? order.deliveryTown : null,
        order.fulfilmentMethod === "delivery" ? order.deliveryCounty : null,
        order.fulfilmentMethod === "delivery" ? order.deliveryPostcode : null,
        order.fulfilmentMethod === "delivery" ? order.deliveryCountry : null,
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

  const fulfilmentMethod = input.fulfilmentMethod ?? revision.fulfilmentMethod;
  if (!["delivery", "collection"].includes(fulfilmentMethod)) {
    throw new Error("revision_invalid_fulfilment_method");
  }

  let deliveryAmountMinor =
    input.deliveryAmountMinor === undefined
      ? revision.deliveryAmountMinor
      : input.deliveryAmountMinor;

  let deliveryAddressLine1: string | null = revision.deliveryAddressLine1;
  let deliveryAddressLine2: string | null = revision.deliveryAddressLine2;
  let deliveryTown: string | null = revision.deliveryTown;
  let deliveryCounty: string | null = revision.deliveryCounty;
  let deliveryPostcode: string | null = revision.deliveryPostcode;
  let deliveryCountry: string | null = revision.deliveryCountry;

  if (fulfilmentMethod === "collection") {
    if (deliveryAmountMinor !== null && deliveryAmountMinor !== 0) {
      throw new Error("revision_collection_delivery_must_be_zero");
    }
    deliveryAmountMinor = 0;
    deliveryAddressLine1 = null;
    deliveryAddressLine2 = null;
    deliveryTown = null;
    deliveryCounty = null;
    deliveryPostcode = null;
    deliveryCountry = null;
  } else {
    if (input.deliveryAddress !== undefined) {
      if (!input.deliveryAddress) throw new Error("revision_delivery_address_required");
      deliveryAddressLine1 = optionalText(
        input.deliveryAddress.line1,
        180,
        "revision_invalid_delivery_address",
      );
      deliveryAddressLine2 = optionalText(
        input.deliveryAddress.line2,
        180,
        "revision_invalid_delivery_address",
      );
      deliveryTown = optionalText(
        input.deliveryAddress.town,
        120,
        "revision_invalid_delivery_address",
      );
      deliveryCounty = optionalText(
        input.deliveryAddress.county,
        120,
        "revision_invalid_delivery_address",
      );
      deliveryPostcode = optionalText(
        input.deliveryAddress.postcode,
        20,
        "revision_invalid_delivery_address",
      );
      const country = optionalText(
        input.deliveryAddress.country ?? "GB",
        2,
        "revision_invalid_delivery_address",
      );
      deliveryCountry = country ? country.toUpperCase() : "GB";
    }
    if (!deliveryAddressLine1 || !deliveryTown || !deliveryPostcode) {
      throw new Error("revision_delivery_address_required");
    }
    if (deliveryAmountMinor === null) {
      throw new Error("revision_delivery_amount_required");
    }
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
  const mutationToken = crypto.randomUUID();
  const statements: D1PreparedStatementLike[] = [
    db
      .prepare(
        `UPDATE order_revisions
        SET version = ?,
            mutation_token = ?,
            items_subtotal_minor = ?,
            delivery_amount_minor = ?,
            final_total_minor = ?,
            customer_message = ?,
            internal_note = ?,
            fulfilment_method = ?,
            delivery_address_line1 = ?,
            delivery_address_line2 = ?,
            delivery_town = ?,
            delivery_county = ?,
            delivery_postcode = ?,
            delivery_country = ?
        WHERE id = ? AND version = ? AND state = 'DRAFT'`,
      )
      .bind(
        nextVersion,
        mutationToken,
        totals.itemsSubtotalMinor,
        totals.deliveryAmountMinor,
        totals.finalTotalMinor,
        customerMessage,
        internalNote,
        fulfilmentMethod,
        deliveryAddressLine1,
        deliveryAddressLine2,
        deliveryTown,
        deliveryCounty,
        deliveryPostcode,
        deliveryCountry,
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
              WHERE id = ? AND version = ? AND mutation_token = ? AND state = 'DRAFT'
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
          mutationToken,
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
          WHERE id = ? AND version = ? AND mutation_token = ? AND state = 'DRAFT'
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
        mutationToken,
      ),
  );

  const results = await db.batch(statements);
  return verifyMutationResult(db, orderReference, revisionId, results);
}

export async function transitionOrderRevision(
  db: D1DatabaseLike,
  orderReference: string,
  revisionId: string,
  action: "send" | "accept" | "decline",
  expectedVersion: number,
  actorEmail: string,
): Promise<Record<string, unknown>> {
  requireExpectedVersion(expectedVersion);

  const revision = await findRevision(db, orderReference, revisionId);
  if (!revision) throw new Error("revision_not_found");
  if (revision.version !== expectedVersion) throw new Error("revision_version_conflict");

  const expectedState = action === "send" ? "DRAFT" : "SENT";
  if (action === "send" && revision.state !== "DRAFT") throw new Error("revision_send_requires_draft");
  if (action === "accept" && revision.state !== "SENT") throw new Error("revision_accept_requires_sent");
  if (action === "decline" && revision.state !== "SENT") throw new Error("revision_decline_requires_sent");
  if (action === "send" && revision.finalTotalMinor === null) throw new Error("revision_total_required");

  const now = new Date().toISOString();
  const nextVersion = revision.version + 1;
  const mutationToken = crypto.randomUUID();
  const statements: D1PreparedStatementLike[] = [
    db.prepare(
      `UPDATE order_revisions
      SET version = ?, mutation_token = ?
      WHERE id = ? AND version = ? AND state = ?`,
    ).bind(nextVersion, mutationToken, revisionId, revision.version, expectedState),
  ];

  if (action === "send") {
    statements.push(
      db.prepare(
        `UPDATE order_revisions
        SET state = 'SUPERSEDED', superseded_at = ?, version = version + 1
        WHERE order_id = ? AND state = 'SENT' AND id <> ?
          AND EXISTS (
            SELECT 1 FROM order_revisions target
            WHERE target.id = ? AND target.version = ?
              AND target.mutation_token = ? AND target.state = 'DRAFT'
          )`,
      ).bind(now, revision.orderId, revisionId, revisionId, nextVersion, mutationToken),
    );
    statements.push(
      db.prepare(
        `UPDATE order_revisions
        SET state = 'SENT', sent_at = ?
        WHERE id = ? AND version = ? AND mutation_token = ? AND state = 'DRAFT'`,
      ).bind(now, revisionId, nextVersion, mutationToken),
    );
    statements.push(
      db.prepare(
        `UPDATE orders
        SET status = 'QUOTED', updated_at = ?, quoted_at = COALESCE(quoted_at, ?)
        WHERE id = ? AND status IN ('UNDER_REVIEW', 'QUOTED')
          AND EXISTS (
            SELECT 1 FROM order_revisions
            WHERE id = ? AND version = ? AND mutation_token = ? AND state = 'SENT'
          )`,
      ).bind(now, now, revision.orderId, revisionId, nextVersion, mutationToken),
    );
  } else {
    const nextState = action === "accept" ? "ACCEPTED" : "DECLINED";
    const timestampColumn = action === "accept" ? "accepted_at" : "declined_at";
    statements.push(
      db.prepare(
        `UPDATE order_revisions
        SET state = '${nextState}', ${timestampColumn} = ?
        WHERE id = ? AND version = ? AND mutation_token = ? AND state = 'SENT'`,
      ).bind(now, revisionId, nextVersion, mutationToken),
    );
  }

  const eventType =
    action === "send"
      ? "ORDER_REVISION_SENT"
      : action === "accept"
        ? "ORDER_REVISION_ACCEPTED"
        : "ORDER_REVISION_DECLINED";
  const finalState =
    action === "send" ? "SENT" : action === "accept" ? "ACCEPTED" : "DECLINED";

  statements.push(
    db.prepare(
      `INSERT INTO order_events (
        order_id, event_type, from_status, to_status,
        actor_type, actor_id, note, metadata_json, created_at
      )
      SELECT ?, ?, ?, ?, 'admin', ?, NULL, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM order_revisions
        WHERE id = ? AND version = ? AND mutation_token = ? AND state = ?
      )`,
    ).bind(
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
      mutationToken,
      finalState,
    ),
  );

  const results = await db.batch(statements);
  return verifyMutationResult(db, orderReference, revisionId, results);
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

async function verifyMutationResult(
  db: D1DatabaseLike,
  orderReference: string,
  revisionId: string,
  results: unknown[],
): Promise<Record<string, unknown>> {
  if (d1StatementChanged(results[0]) === false) {
    throw new Error("revision_version_conflict");
  }
  const detail = await getOrderRevisionDetail(db, orderReference, revisionId);
  if (!detail) throw new Error("revision_not_found");
  return detail;
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
  const mutationToken = crypto.randomUUID();
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

  const results = await db.batch([
    db
      .prepare(
        `UPDATE order_revisions
        SET version = ?, mutation_token = ?, items_subtotal_minor = ?, final_total_minor = ?
        WHERE id = ? AND version = ? AND state = 'DRAFT'`,
      )
      .bind(
        nextVersion,
        mutationToken,
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
          WHERE id = ? AND version = ? AND mutation_token = ? AND state = 'DRAFT'
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
        mutationToken,
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
          WHERE id = ? AND version = ? AND mutation_token = ?
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
        mutationToken,
      ),
  ]);

  return verifyMutationResult(db, orderReference, revisionId, results);
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
  const mutationToken = crypto.randomUUID();
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

  const results = await db.batch([
    db
      .prepare(
        `UPDATE order_revisions
        SET version = ?, mutation_token = ?, items_subtotal_minor = ?, final_total_minor = ?
        WHERE id = ? AND version = ? AND state = 'DRAFT'`,
      )
      .bind(
        nextVersion,
        mutationToken,
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
            WHERE id = ? AND version = ? AND mutation_token = ? AND state = 'DRAFT'
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
        mutationToken,
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
          WHERE id = ? AND version = ? AND mutation_token = ?
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
        mutationToken,
      ),
  ]);

  return verifyMutationResult(db, orderReference, revisionId, results);
}


export async function removeAddedRevisionLine(
  db: D1DatabaseLike,
  orderReference: string,
  revisionId: string,
  lineNumber: number,
  expectedVersion: number,
  actorEmail: string,
): Promise<Record<string, unknown>> {
  requireExpectedVersion(expectedVersion);
  if (!Number.isInteger(lineNumber) || lineNumber < 1) {
    throw new Error("revision_invalid_line_number");
  }

  const revision = await findRevision(db, orderReference, revisionId);
  if (!revision) throw new Error("revision_not_found");
  if (revision.state !== "DRAFT") throw new Error("revision_not_draft");
  if (revision.version !== expectedVersion) {
    throw new Error("revision_version_conflict");
  }

  const items = await revisionItems(db, revisionId);
  const target = items.find((item) => item.lineNumber === lineNumber);
  if (!target) throw new Error("revision_unknown_line");
  if (target.availabilityStatus !== "ADDED" || target.sourceOrderItemId !== null) {
    throw new Error("revision_remove_requires_added_item");
  }

  const remaining = items.filter((item) => item.lineNumber !== lineNumber);
  if (remaining.length === 0) throw new Error("revision_cannot_remove_all_items");

  const totals = calculateRevisionTotals({
    items: remaining.map((item) => ({
      unitPriceMinor: item.unitPriceMinor,
      requestedQuantity: item.requestedQuantity,
      confirmedQuantity: item.confirmedQuantity,
      availabilityStatus: item.availabilityStatus,
    })),
    deliveryAmountMinor:
      revision.fulfilmentMethod === "collection" ? 0 : revision.deliveryAmountMinor,
    adjustmentAmountMinor: revision.adjustmentAmountMinor,
  });

  const now = new Date().toISOString();
  const nextVersion = revision.version + 1;
  const mutationToken = crypto.randomUUID();

  const results = await db.batch([
    db
      .prepare(
        `UPDATE order_revisions
        SET version = ?, mutation_token = ?, items_subtotal_minor = ?, final_total_minor = ?
        WHERE id = ? AND version = ? AND state = 'DRAFT'`,
      )
      .bind(
        nextVersion,
        mutationToken,
        totals.itemsSubtotalMinor,
        totals.finalTotalMinor,
        revisionId,
        revision.version,
      ),
    db
      .prepare(
        `DELETE FROM order_revision_items
        WHERE revision_id = ? AND line_number = ?
          AND EXISTS (
            SELECT 1 FROM order_revisions
            WHERE id = ? AND version = ? AND mutation_token = ? AND state = 'DRAFT'
          )`,
      )
      .bind(revisionId, lineNumber, revisionId, nextVersion, mutationToken),
    db
      .prepare(
        `INSERT INTO order_events (
          order_id, event_type, from_status, to_status,
          actor_type, actor_id, note, metadata_json, created_at
        )
        SELECT ?, 'ORDER_REVISION_ITEM_REMOVED', NULL, NULL, 'admin', ?, NULL, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM order_revisions
          WHERE id = ? AND version = ? AND mutation_token = ?
        )`,
      )
      .bind(
        revision.orderId,
        actorEmail,
        JSON.stringify({
          revisionId,
          revisionNumber: revision.revisionNumber,
          lineNumber,
          catalogProductId: target.catalogProductId,
          version: nextVersion,
        }),
        now,
        revisionId,
        nextVersion,
        mutationToken,
      ),
  ]);

  return verifyMutationResult(db, orderReference, revisionId, results);
}

export async function restoreOriginalRevisionLine(
  db: D1DatabaseLike,
  orderReference: string,
  revisionId: string,
  lineNumber: number,
  expectedVersion: number,
  actorEmail: string,
): Promise<Record<string, unknown>> {
  requireExpectedVersion(expectedVersion);
  if (!Number.isInteger(lineNumber) || lineNumber < 1) {
    throw new Error("revision_invalid_line_number");
  }

  const revision = await findRevision(db, orderReference, revisionId);
  if (!revision) throw new Error("revision_not_found");
  if (revision.state !== "DRAFT") throw new Error("revision_not_draft");
  if (revision.version !== expectedVersion) {
    throw new Error("revision_version_conflict");
  }

  const items = await revisionItems(db, revisionId);
  const target = items.find((item) => item.lineNumber === lineNumber);
  if (!target) throw new Error("revision_unknown_line");
  if (target.sourceOrderItemId === null) {
    throw new Error("revision_restore_requires_original_item");
  }

  const original = await db
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
      WHERE id = ? AND order_id = ?
      LIMIT 1`,
    )
    .bind(target.sourceOrderItemId, revision.orderId)
    .first<OriginalOrderItemRow>();

  if (!original) throw new Error("revision_original_item_not_found");

  const restored = {
    unitPriceMinor: original.unitPriceMinor,
    requestedQuantity: original.quantity,
    confirmedQuantity: original.quantity,
    availabilityStatus: "CONFIRMED" as const,
  };
  validateRevisionItem(restored);

  const totals = calculateRevisionTotals({
    items: items.map((item) =>
      item.lineNumber === lineNumber
        ? restored
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
  const mutationToken = crypto.randomUUID();

  const results = await db.batch([
    db
      .prepare(
        `UPDATE order_revisions
        SET version = ?, mutation_token = ?, items_subtotal_minor = ?, final_total_minor = ?
        WHERE id = ? AND version = ? AND state = 'DRAFT'`,
      )
      .bind(
        nextVersion,
        mutationToken,
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
            requested_quantity = ?,
            confirmed_quantity = ?,
            availability_status = 'CONFIRMED',
            reason_code = NULL,
            customer_note = NULL,
            internal_note = NULL,
            line_total_minor = ?,
            updated_at = ?
        WHERE revision_id = ? AND line_number = ?
          AND EXISTS (
            SELECT 1 FROM order_revisions
            WHERE id = ? AND version = ? AND mutation_token = ? AND state = 'DRAFT'
          )`,
      )
      .bind(
        original.catalogProductId,
        original.sku,
        original.slug,
        original.productName,
        original.unitPriceMinor,
        original.quantity,
        original.quantity,
        original.unitPriceMinor * original.quantity,
        now,
        revisionId,
        lineNumber,
        revisionId,
        nextVersion,
        mutationToken,
      ),
    db
      .prepare(
        `INSERT INTO order_events (
          order_id, event_type, from_status, to_status,
          actor_type, actor_id, note, metadata_json, created_at
        )
        SELECT ?, 'ORDER_REVISION_ITEM_RESTORED', NULL, NULL, 'admin', ?, NULL, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM order_revisions
          WHERE id = ? AND version = ? AND mutation_token = ?
        )`,
      )
      .bind(
        revision.orderId,
        actorEmail,
        JSON.stringify({
          revisionId,
          revisionNumber: revision.revisionNumber,
          lineNumber,
          catalogProductId: original.catalogProductId,
          version: nextVersion,
        }),
        now,
        revisionId,
        nextVersion,
        mutationToken,
      ),
  ]);

  return verifyMutationResult(db, orderReference, revisionId, results);
}


export interface AddRevisionAdjustmentInput {
  expectedVersion: number;
  kind: "DISCOUNT" | "SURCHARGE" | "MANUAL_CORRECTION";
  label: string;
  amountMinor: number;
  internalReason: string;
}

function validateAdjustmentInput(input: AddRevisionAdjustmentInput): {
  kind: "DISCOUNT" | "SURCHARGE" | "MANUAL_CORRECTION";
  label: string;
  amountMinor: number;
  internalReason: string;
} {
  requireExpectedVersion(input.expectedVersion);
  if (!["DISCOUNT", "SURCHARGE", "MANUAL_CORRECTION"].includes(input.kind)) {
    throw new Error("revision_adjustment_invalid_kind");
  }
  if (
    !Number.isInteger(input.amountMinor) ||
    input.amountMinor === 0 ||
    Math.abs(input.amountMinor) > 10_000_000
  ) {
    throw new Error("revision_adjustment_invalid_amount");
  }
  if (input.kind === "DISCOUNT" && input.amountMinor >= 0) {
    throw new Error("revision_discount_must_be_negative");
  }
  if (input.kind === "SURCHARGE" && input.amountMinor <= 0) {
    throw new Error("revision_surcharge_must_be_positive");
  }

  const label = String(input.label ?? "").trim();
  const internalReason = String(input.internalReason ?? "").trim();
  if (label.length < 1 || label.length > 120) {
    throw new Error("revision_adjustment_invalid_label");
  }
  if (internalReason.length < 1 || internalReason.length > 500) {
    throw new Error("revision_adjustment_reason_required");
  }

  return {
    kind: input.kind,
    label,
    amountMinor: input.amountMinor,
    internalReason,
  };
}

export async function addDraftRevisionAdjustment(
  db: D1DatabaseLike,
  orderReference: string,
  revisionId: string,
  input: AddRevisionAdjustmentInput,
  actorEmail: string,
): Promise<Record<string, unknown>> {
  const validated = validateAdjustmentInput(input);
  const revision = await findRevision(db, orderReference, revisionId);
  if (!revision) throw new Error("revision_not_found");
  if (revision.state !== "DRAFT") throw new Error("revision_not_draft");
  if (revision.version !== input.expectedVersion) {
    throw new Error("revision_version_conflict");
  }

  const nextAdjustmentAmount =
    revision.adjustmentAmountMinor + validated.amountMinor;
  const nextFinal =
    revision.deliveryAmountMinor === null
      ? null
      : revision.itemsSubtotalMinor +
        revision.deliveryAmountMinor +
        nextAdjustmentAmount;
  if (nextFinal !== null && nextFinal < 0) {
    throw new Error("revision_negative_final_total");
  }

  const now = new Date().toISOString();
  const nextVersion = revision.version + 1;
  const mutationToken = crypto.randomUUID();

  const results = await db.batch([
    db
      .prepare(
        `UPDATE order_revisions
        SET version = ?,
            mutation_token = ?,
            adjustment_amount_minor = ?,
            final_total_minor = ?
        WHERE id = ? AND version = ? AND state = 'DRAFT'`,
      )
      .bind(
        nextVersion,
        mutationToken,
        nextAdjustmentAmount,
        nextFinal,
        revisionId,
        revision.version,
      ),
    db
      .prepare(
        `INSERT INTO order_adjustments (
          revision_id, kind, label, amount_minor,
          internal_reason, created_by, created_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM order_revisions
          WHERE id = ? AND version = ? AND mutation_token = ? AND state = 'DRAFT'
        )`,
      )
      .bind(
        revisionId,
        validated.kind,
        validated.label,
        validated.amountMinor,
        validated.internalReason,
        actorEmail,
        now,
        revisionId,
        nextVersion,
        mutationToken,
      ),
    db
      .prepare(
        `INSERT INTO order_events (
          order_id, event_type, from_status, to_status,
          actor_type, actor_id, note, metadata_json, created_at
        )
        SELECT ?, 'ORDER_REVISION_ADJUSTMENT_ADDED', NULL, NULL, 'admin', ?, NULL, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM order_revisions
          WHERE id = ? AND version = ? AND mutation_token = ?
        )`,
      )
      .bind(
        revision.orderId,
        actorEmail,
        JSON.stringify({
          revisionId,
          revisionNumber: revision.revisionNumber,
          kind: validated.kind,
          label: validated.label,
          amountMinor: validated.amountMinor,
          version: nextVersion,
        }),
        now,
        revisionId,
        nextVersion,
        mutationToken,
      ),
  ]);

  return verifyMutationResult(db, orderReference, revisionId, results);
}

export async function removeDraftRevisionAdjustment(
  db: D1DatabaseLike,
  orderReference: string,
  revisionId: string,
  adjustmentId: number,
  expectedVersion: number,
  actorEmail: string,
): Promise<Record<string, unknown>> {
  requireExpectedVersion(expectedVersion);
  if (!Number.isInteger(adjustmentId) || adjustmentId < 1) {
    throw new Error("revision_adjustment_invalid_id");
  }

  const revision = await findRevision(db, orderReference, revisionId);
  if (!revision) throw new Error("revision_not_found");
  if (revision.state !== "DRAFT") throw new Error("revision_not_draft");
  if (revision.version !== expectedVersion) {
    throw new Error("revision_version_conflict");
  }

  const adjustment = await db
    .prepare(
      `SELECT id, kind, label, amount_minor AS amountMinor
      FROM order_adjustments
      WHERE id = ? AND revision_id = ?
      LIMIT 1`,
    )
    .bind(adjustmentId, revisionId)
    .first<{
      id: number;
      kind: string;
      label: string;
      amountMinor: number;
    }>();

  if (!adjustment) throw new Error("revision_adjustment_not_found");

  const nextAdjustmentAmount =
    revision.adjustmentAmountMinor - Number(adjustment.amountMinor);
  const nextFinal =
    revision.deliveryAmountMinor === null
      ? null
      : revision.itemsSubtotalMinor +
        revision.deliveryAmountMinor +
        nextAdjustmentAmount;
  if (nextFinal !== null && nextFinal < 0) {
    throw new Error("revision_negative_final_total");
  }

  const now = new Date().toISOString();
  const nextVersion = revision.version + 1;
  const mutationToken = crypto.randomUUID();

  const results = await db.batch([
    db
      .prepare(
        `UPDATE order_revisions
        SET version = ?,
            mutation_token = ?,
            adjustment_amount_minor = ?,
            final_total_minor = ?
        WHERE id = ? AND version = ? AND state = 'DRAFT'`,
      )
      .bind(
        nextVersion,
        mutationToken,
        nextAdjustmentAmount,
        nextFinal,
        revisionId,
        revision.version,
      ),
    db
      .prepare(
        `DELETE FROM order_adjustments
        WHERE id = ? AND revision_id = ?
          AND EXISTS (
            SELECT 1 FROM order_revisions
            WHERE id = ? AND version = ? AND mutation_token = ? AND state = 'DRAFT'
          )`,
      )
      .bind(adjustmentId, revisionId, revisionId, nextVersion, mutationToken),
    db
      .prepare(
        `INSERT INTO order_events (
          order_id, event_type, from_status, to_status,
          actor_type, actor_id, note, metadata_json, created_at
        )
        SELECT ?, 'ORDER_REVISION_ADJUSTMENT_REMOVED', NULL, NULL, 'admin', ?, NULL, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM order_revisions
          WHERE id = ? AND version = ? AND mutation_token = ?
        )`,
      )
      .bind(
        revision.orderId,
        actorEmail,
        JSON.stringify({
          revisionId,
          revisionNumber: revision.revisionNumber,
          adjustmentId,
          kind: adjustment.kind,
          label: adjustment.label,
          amountMinor: Number(adjustment.amountMinor),
          version: nextVersion,
        }),
        now,
        revisionId,
        nextVersion,
        mutationToken,
      ),
  ]);

  return verifyMutationResult(db, orderReference, revisionId, results);
}
