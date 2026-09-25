import type { D1DatabaseLike } from "../src/data/d1";
import { handleCreateOrder } from "../src/routes/orders";
import { getPublicCommerceProduct } from "../src/data/public-catalog";

interface Env {
  DB: D1DatabaseLike;
  QA_TOKEN: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error("QA_ASSERT:" + message);
}

async function run(
  db: D1DatabaseLike,
  sql: string,
  ...values: unknown[]
): Promise<void> {
  await db.prepare(sql).bind(...values).run();
}

async function first<T>(
  db: D1DatabaseLike,
  sql: string,
  ...values: unknown[]
): Promise<T | null> {
  return db.prepare(sql).bind(...values).first<T>();
}

function orderRequest(
  publicId: string,
  quantity: number,
  idempotencyKey: string,
): Request {
  return new Request("https://phase6.qa.invalid/v1/orders", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({
      turnstileToken: "phase6-qa-token",
      fulfilmentMethod: "collection",
      customer: {
        name: "Phase 6 QA",
        email: "phase6.qa@example.com",
      },
      items: [
        {
          productId: publicId,
          quantity,
          priceMinor: 1,
        },
      ],
    }),
  });
}

async function runProof(db: D1DatabaseLike): Promise<Record<string, unknown>> {
  const runId = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  const productId = "qa6_prd_" + runId;
  const publicId = "QA6-" + runId.toUpperCase();
  const variantId = "qa6_var_" + runId;
  const publishedVersionId = "qa6_pver_pub_" + runId;
  const draftVersionId = "qa6_pver_draft_" + runId;
  const slug = "phase6-qa-" + runId;
  const balanceToken = "qa6_bal_" + runId;
  const createdAt = new Date().toISOString();
  const orderIds: string[] = [];

  try {
    await db.batch([
      db.prepare(
        `INSERT INTO products (
          id, legacy_catalog_id, current_slug, publication_status, sell_status,
          online_ordering_enabled, featured, current_published_version_id,
          current_draft_version_id, version, created_at, updated_at, archived_at
        ) VALUES (?, ?, ?, 'ACTIVE', 'AUTO', 1, 0, ?, ?, 1, ?, ?, NULL)`,
      ).bind(
        productId,
        publicId,
        slug,
        publishedVersionId,
        draftVersionId,
        createdAt,
        createdAt,
      ),
      db.prepare(
        `INSERT INTO product_versions (
          id, product_id, version_number, title, short_description,
          long_description, brand, collection_label, product_type,
          public_note, seo_title, seo_description, created_by,
          created_at, published_at, superseded_at
        ) VALUES (?, ?, 1, '[PHASE6 QA] Published Product',
          'Published description', NULL, 'QA', NULL, 'gifts',
          NULL, NULL, NULL, 'phase6-qa', ?, ?, NULL)`,
      ).bind(
        publishedVersionId,
        productId,
        createdAt,
        createdAt,
      ),
      db.prepare(
        `INSERT INTO product_versions (
          id, product_id, version_number, title, short_description,
          long_description, brand, collection_label, product_type,
          public_note, seo_title, seo_description, created_by,
          created_at, published_at, superseded_at
        ) VALUES (?, ?, 2, '[PHASE6 QA] SECRET DRAFT',
          'Draft must never be public', NULL, 'QA', NULL, 'gifts',
          NULL, NULL, NULL, 'phase6-qa', ?, NULL, NULL)`,
      ).bind(
        draftVersionId,
        productId,
        createdAt,
      ),
      db.prepare(
        `INSERT INTO product_variants (
          id, product_id, title, sku, barcode, price_minor,
          compare_at_price_minor, cost_minor, currency, track_inventory,
          low_stock_threshold, active, is_default, version,
          created_at, updated_at, inventory_mutation_token
        ) VALUES (?, ?, 'Default', ?, NULL, 777, NULL, NULL,
          'GBP', 1, 0, 1, 1, 1, ?, ?, ?)`,
      ).bind(
        variantId,
        productId,
        "QA6-" + runId,
        createdAt,
        createdAt,
        balanceToken,
      ),
      db.prepare(
        `INSERT INTO inventory_balances (
          variant_id, location_id, on_hand, reserved, safety_stock,
          version, mutation_token, updated_at
        ) VALUES (?, 'loc_ambleside', 1, 0, 0, 1, ?, ?)`,
      ).bind(
        variantId,
        balanceToken,
        createdAt,
      ),
    ]);

    const publicProduct = await getPublicCommerceProduct(db, publicId);
    assert(publicProduct, "seeded product missing from public D1 query");
    assert(
      publicProduct.name === "[PHASE6 QA] Published Product",
      "Draft content leaked into public Product",
    );
    assert(
      !publicProduct.name.includes("SECRET DRAFT"),
      "Draft title leaked",
    );
    assert(publicProduct.priceMinor === 777, "initial D1 price mismatch");
    assert(publicProduct.inventory.tracked === true, "QA product not tracked");
    assert(publicProduct.inventory.available === 1, "initial Available must be 1");
    assert(publicProduct.purchasable === true, "initial QA product must be purchasable");

    let orderSequence = 0;
    const submit = async (quantity: number) => {
      orderSequence += 1;
      const orderId = "qa6_ord_" + runId + "_" + orderSequence;
      const reference =
        "QA6-" + runId.toUpperCase() + "-" + String(orderSequence);
      const response = await handleCreateOrder(
        orderRequest(publicId, quantity, crypto.randomUUID()),
        {
          DB: db,
          D1_COMMERCE_AUTHORITY_ENABLED: "true",
          TURNSTILE_SECRET_KEY: "phase6-qa",
          TURNSTILE_ALLOWED_HOSTNAMES: "phase6.qa.invalid",
          TURNSTILE_EXPECTED_ACTION: "order_request",
        },
        {
          verifyTurnstileFn: async () => ({
            success: true,
            hostname: "phase6.qa.invalid",
            action: "order_request",
          }),
          notifyOrderSubmittedFn: async () => {},
          randomUUID: () => orderId,
          createReference: () => reference,
        },
      );
      if (response.status === 201) orderIds.push(orderId);
      return {
        response,
        payload: (await response.json()) as Record<string, any>,
        orderId,
      };
    };

    const firstOrder = await submit(1);
    assert(firstOrder.response.status === 201, "quantity 1 order must succeed");
    assert(
      firstOrder.payload.order?.itemsSubtotalMinor === 777,
      "first order did not use D1 price 777",
    );
    const firstItem = await first<{
      unitPriceMinor: number;
      quantity: number;
      lineTotalMinor: number;
    }>(
      db,
      `SELECT unit_price_minor AS unitPriceMinor, quantity,
        line_total_minor AS lineTotalMinor
      FROM order_items
      WHERE order_id = ? AND line_number = 1`,
      firstOrder.orderId,
    );
    assert(firstItem?.unitPriceMinor === 777, "persisted order price is not D1 price");
    assert(firstItem?.lineTotalMinor === 777, "persisted line total is wrong");

    const tooMany = await submit(2);
    assert(
      tooMany.response.status === 409 &&
        tooMany.payload.error?.code === "product_not_purchasable",
      "quantity above live Available must be rejected",
    );
    const rejectedExists = await first<{ count: number }>(
      db,
      "SELECT COUNT(*) AS count FROM orders WHERE id = ?",
      tooMany.orderId,
    );
    assert(Number(rejectedExists?.count ?? 0) === 0, "rejected order was persisted");

    await run(
      db,
      `UPDATE product_variants
       SET price_minor = 888, version = version + 1, updated_at = ?
       WHERE id = ?`,
      new Date().toISOString(),
      variantId,
    );
    const repriced = await getPublicCommerceProduct(db, publicId);
    assert(repriced?.priceMinor === 888, "price edit did not reach public D1 state");

    const secondOrder = await submit(1);
    assert(secondOrder.response.status === 201, "repriced order must succeed");
    assert(
      secondOrder.payload.order?.itemsSubtotalMinor === 888,
      "second order did not use updated D1 price 888",
    );
    const secondItem = await first<{ unitPriceMinor: number }>(
      db,
      "SELECT unit_price_minor AS unitPriceMinor FROM order_items WHERE order_id = ? AND line_number = 1",
      secondOrder.orderId,
    );
    assert(secondItem?.unitPriceMinor === 888, "updated D1 price not persisted");

    await run(
      db,
      `UPDATE inventory_balances
       SET reserved = 1, version = version + 1,
           mutation_token = ?, updated_at = ?
       WHERE variant_id = ? AND location_id = 'loc_ambleside'`,
      "qa6_reserved_" + runId,
      new Date().toISOString(),
      variantId,
    );
    const reservedProduct = await getPublicCommerceProduct(db, publicId);
    assert(
      reservedProduct?.inventory.available === 0,
      "Reserved quantity did not reduce public Available",
    );
    assert(
      reservedProduct?.purchasable === false &&
        reservedProduct?.nonPurchasableReason === "out_of_stock",
      "Available 0 did not block public orderability",
    );

    await run(
      db,
      `UPDATE inventory_balances
       SET reserved = 0, version = version + 1,
           mutation_token = ?, updated_at = ?
       WHERE variant_id = ? AND location_id = 'loc_ambleside'`,
      "qa6_unreserved_" + runId,
      new Date().toISOString(),
      variantId,
    );

    await run(
      db,
      "UPDATE products SET online_ordering_enabled = 0, version = version + 1, updated_at = ? WHERE id = ?",
      new Date().toISOString(),
      productId,
    );
    const offline = await submit(1);
    assert(
      offline.response.status === 409,
      "online-ordering disabled product was accepted",
    );

    await run(
      db,
      `UPDATE products
       SET online_ordering_enabled = 1, sell_status = 'OUT_OF_STOCK',
           version = version + 1, updated_at = ?
       WHERE id = ?`,
      new Date().toISOString(),
      productId,
    );
    const manualOut = await submit(1);
    assert(
      manualOut.response.status === 409,
      "manual OUT_OF_STOCK product was accepted",
    );

    await run(
      db,
      `UPDATE products
       SET sell_status = 'AUTO', publication_status = 'ARCHIVED',
           online_ordering_enabled = 0, archived_at = ?,
           version = version + 1, updated_at = ?
       WHERE id = ?`,
      new Date().toISOString(),
      new Date().toISOString(),
      productId,
    );
    const archived = await getPublicCommerceProduct(db, publicId);
    assert(archived === null, "Archived product remained in public catalogue");

    return {
      runId,
      publishedOnly: true,
      initialPriceMinor: 777,
      updatedPriceMinor: 888,
      trackedAvailableInitial: 1,
      quantityOneAccepted: true,
      quantityTwoRejected: true,
      reservedReducedAvailableToZero: true,
      onlineOrderingOffRejected: true,
      manualOutOfStockRejected: true,
      archiveRemovedFromPublic: true,
      persistedOrders: orderIds.length,
    };
  } finally {
    for (const orderId of orderIds) {
      await run(db, "DELETE FROM orders WHERE id = ?", orderId);
    }
    await run(
      db,
      "DELETE FROM inventory_balances WHERE variant_id = ?",
      variantId,
    );
    await run(db, "DELETE FROM products WHERE id = ?", productId);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (
      request.method !== "POST" ||
      request.headers.get("x-phase6-qa-token") !== env.QA_TOKEN
    ) {
      return json({ error: "forbidden" }, 403);
    }

    try {
      const result = await runProof(env.DB);
      return json({ ok: true, result });
    } catch (error) {
      return json(
        {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : null,
        },
        500,
      );
    }
  },
};
