import type { D1DatabaseLike } from "./d1";
import type {
  CreatedOrder,
  ExistingOrderByIdempotency,
  SubmittedOrderInput,
} from "../domain/order";

function assertIntegerMoney(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer amount in minor units.`);
  }
}

function validateOrderForPersistence(input: SubmittedOrderInput): void {
  if (!input.items.length) throw new Error("Order must contain at least one item.");

  let subtotal = 0;
  for (const item of input.items) {
    assertIntegerMoney(item.unitPriceMinor, "unitPriceMinor");
    assertIntegerMoney(item.lineTotalMinor, "lineTotalMinor");

    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      throw new Error("quantity must be an integer between 1 and 99.");
    }

    if (item.lineTotalMinor !== item.unitPriceMinor * item.quantity) {
      throw new Error("lineTotalMinor does not match unit price multiplied by quantity.");
    }

    subtotal += item.lineTotalMinor;
  }

  assertIntegerMoney(input.itemsSubtotalMinor, "itemsSubtotalMinor");
  if (subtotal !== input.itemsSubtotalMinor) {
    throw new Error("itemsSubtotalMinor does not match the order item snapshots.");
  }

  if (input.fulfilmentMethod === "delivery") {
    const address = input.deliveryAddress;
    if (
      !address?.line1?.trim() ||
      !address.town?.trim() ||
      !address.postcode?.trim() ||
      !address.country?.trim()
    ) {
      throw new Error("Delivery orders require a complete delivery address.");
    }
  }
}

export async function findOrderByIdempotencyKey(
  db: D1DatabaseLike,
  idempotencyKey: string,
): Promise<ExistingOrderByIdempotency | null> {
  const row = await db
    .prepare(
      `SELECT
         id,
         public_reference AS publicReference,
         status,
         created_at AS createdAt
       FROM orders
       WHERE idempotency_key = ?
       LIMIT 1`,
    )
    .bind(idempotencyKey)
    .first<ExistingOrderByIdempotency>();

  return row ?? null;
}

export async function createSubmittedOrder(
  db: D1DatabaseLike,
  input: SubmittedOrderInput,
): Promise<CreatedOrder> {
  validateOrderForPersistence(input);

  const createdAt = input.createdAt ?? new Date().toISOString();
  const address = input.deliveryAddress ?? null;

  const statements = [
    db
      .prepare(
        `INSERT INTO orders (
          id,
          public_reference,
          idempotency_key,
          data_class,
          status,
          currency,
          fulfilment_method,
          customer_name,
          customer_email,
          customer_phone,
          delivery_address_line1,
          delivery_address_line2,
          delivery_town,
          delivery_county,
          delivery_postcode,
          delivery_country,
          customer_note,
          items_subtotal_minor,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, 'SUBMITTED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        input.id,
        input.publicReference,
        input.idempotencyKey,
        input.dataClass ?? "BUSINESS",
        input.currency,
        input.fulfilmentMethod,
        input.customerName,
        input.customerEmail,
        input.customerPhone ?? null,
        address?.line1 ?? null,
        address?.line2 ?? null,
        address?.town ?? null,
        address?.county ?? null,
        address?.postcode ?? null,
        address?.country ?? null,
        input.customerNote ?? null,
        input.itemsSubtotalMinor,
        createdAt,
        createdAt,
      ),
    ...input.items.map((item, index) =>
      db
        .prepare(
          `INSERT INTO order_items (
            order_id,
            line_number,
            catalog_product_id,
            sku,
            slug,
            product_name,
            unit_price_minor,
            quantity,
            line_total_minor,
            options_json,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          input.id,
          index + 1,
          item.catalogProductId,
          item.sku ?? null,
          item.slug,
          item.productName,
          item.unitPriceMinor,
          item.quantity,
          item.lineTotalMinor,
          item.optionsJson ?? "{}",
          createdAt,
        ),
    ),
    db
      .prepare(
        `INSERT INTO order_events (
          order_id,
          event_type,
          from_status,
          to_status,
          actor_type,
          metadata_json,
          created_at
        ) VALUES (?, 'ORDER_SUBMITTED', NULL, 'SUBMITTED', 'system', '{}', ?)`,
      )
      .bind(input.id, createdAt),
  ];

  await db.batch(statements);

  return {
    id: input.id,
    publicReference: input.publicReference,
    status: "SUBMITTED",
    createdAt,
  };
}
