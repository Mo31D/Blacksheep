import type { D1DatabaseLike } from "../data/d1";
import {
  createSubmittedOrder,
  findOrderByIdempotencyKey,
} from "../data/orders";
import { priceRequestedCartFromD1 } from "../data/commerce-pricing";
import { createPublicOrderReference } from "../domain/order-reference";
import {
  OrderRequestValidationError,
  readOrderRequest,
  validateIdempotencyKey,
} from "../http/order-request";
import { verifyTurnstile } from "../security/turnstile";
import { notifyOrderSubmitted, type NotificationEnv } from "../notifications/service";

export interface RateLimiterLike {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

export interface OrdersEnv extends NotificationEnv {
  ENVIRONMENT?: string;
  DB?: D1DatabaseLike;
  ORDER_RATE_LIMITER?: RateLimiterLike;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_ALLOWED_HOSTNAMES?: string;
  TURNSTILE_EXPECTED_ACTION?: string;
}

interface RouteDependencies {
  verifyTurnstileFn: typeof verifyTurnstile;
  notifyOrderSubmittedFn: typeof notifyOrderSubmitted;
  randomUUID: () => string;
  createReference: () => string;
  priceRequestedCartFromD1Fn: typeof priceRequestedCartFromD1;
}

const defaultDependencies: RouteDependencies = {
  verifyTurnstileFn: verifyTurnstile,
  notifyOrderSubmittedFn: notifyOrderSubmitted,
  randomUUID: () => crypto.randomUUID(),
  createReference: () => createPublicOrderReference(),
  priceRequestedCartFromD1Fn: priceRequestedCartFromD1,
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
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

function catalogueErrorResponse(error: unknown): Response | null {
  if (!(error instanceof Error)) return null;
  const conflictCodes = new Set([
    "arriving_soon",
    "out_of_stock",
    "price_unavailable",
    "catalog_product_not_purchasable",
  ]);
  if (error.message === "catalog_product_not_found") {
    return json({ error: { code: "product_not_found", message: "A requested product is no longer available." } }, 409);
  }
  if (conflictCodes.has(error.message)) {
    return json({ error: { code: "product_not_purchasable", message: "A requested product cannot currently be ordered." } }, 409);
  }
  if (error.message === "duplicate_cart_product" || error.message === "invalid_quantity" || error.message === "cart_empty") {
    return json({ error: { code: error.message, message: "The requested basket is invalid." } }, 400);
  }
  return null;
}

export async function handleCreateOrder(
  request: Request,
  env: OrdersEnv,
  dependencies: Partial<RouteDependencies> = {},
): Promise<Response> {
  const deps = { ...defaultDependencies, ...dependencies };

  if (!env.DB) {
    return json({ error: { code: "database_unavailable", message: "Order service is temporarily unavailable." } }, 503);
  }

  let idempotencyKey: string;
  try {
    idempotencyKey = validateIdempotencyKey(request.headers.get("idempotency-key"));
  } catch (error) {
    if (error instanceof OrderRequestValidationError) {
      return json({ error: { code: error.code, message: error.message } }, 400);
    }
    throw error;
  }

  const existing = await findOrderByIdempotencyKey(env.DB, idempotencyKey);
  if (existing) {
    return json(
      {
        order: {
          reference: existing.publicReference,
          status: existing.status,
          createdAt: existing.createdAt,
        },
        idempotentReplay: true,
      },
      200,
    );
  }

  let input;
  try {
    input = await readOrderRequest(request);
  } catch (error) {
    if (error instanceof OrderRequestValidationError) {
      const status = error.code === "unsupported_media_type" ? 415 : error.code === "payload_too_large" ? 413 : 400;
      return json({ error: { code: error.code, message: error.message } }, status);
    }
    throw error;
  }

  if (env.ORDER_RATE_LIMITER) {
    const key = await sha256Hex(input.customerEmail);
    const rate = await env.ORDER_RATE_LIMITER.limit({ key });
    if (!rate.success) {
      return json(
        { error: { code: "rate_limited", message: "Too many order requests. Please try again shortly." } },
        429,
      );
    }
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    return json(
      { error: { code: "turnstile_not_configured", message: "Order service is temporarily unavailable." } },
      503,
    );
  }

  let turnstileResult;
  try {
    turnstileResult = await deps.verifyTurnstileFn({
      secret: env.TURNSTILE_SECRET_KEY,
      token: input.turnstileToken,
      remoteIp: request.headers.get("cf-connecting-ip"),
      idempotencyKey,
      expectedHostnames: (env.TURNSTILE_ALLOWED_HOSTNAMES ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      expectedAction: env.TURNSTILE_EXPECTED_ACTION ?? "order_request",
    });
  } catch {
    return json(
      { error: { code: "turnstile_unavailable", message: "Security verification is temporarily unavailable." } },
      503,
    );
  }

  if (!turnstileResult.success) {
    return json(
      { error: { code: "turnstile_failed", message: "Security verification failed. Please try again." } },
      403,
    );
  }

  let priced;
  try {
    priced = await deps.priceRequestedCartFromD1Fn(
      env.DB,
      input.items,
    );
  } catch (error) {
    const response = catalogueErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const createdAt = new Date().toISOString();
  const orderInput = {
    id: deps.randomUUID(),
    publicReference: deps.createReference(),
    idempotencyKey,
    dataClass: env.ENVIRONMENT === "staging" ? ("TEST" as const) : ("BUSINESS" as const),
    currency: priced.currency,
    fulfilmentMethod: input.fulfilmentMethod,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    deliveryAddress: input.deliveryAddress,
    customerNote: input.customerNote,
    itemsSubtotalMinor: priced.itemsSubtotalMinor,
    items: priced.lines.map((line) => ({
      catalogProductId: line.productId,
      sku: line.sku,
      slug: line.slug,
      productName: line.productName,
      unitPriceMinor: line.unitPriceMinor,
      quantity: line.quantity,
      lineTotalMinor: line.lineTotalMinor,
      optionsJson: "{}",
    })),
    createdAt,
  };

  try {
    const created = await createSubmittedOrder(env.DB, orderInput);
    await deps.notifyOrderSubmittedFn(env, orderInput, created);
    return json(
      {
        order: {
          reference: created.publicReference,
          status: created.status,
          createdAt: created.createdAt,
          currency: priced.currency,
          itemsSubtotalMinor: priced.itemsSubtotalMinor,
          fulfilmentMethod: input.fulfilmentMethod,
          items: priced.lines.map((line) => ({
            productId: line.productId,
            name: line.productName,
            quantity: line.quantity,
            unitPriceMinor: line.unitPriceMinor,
            lineTotalMinor: line.lineTotalMinor,
          })),
        },
        paymentTaken: false,
      },
      201,
    );
  } catch (error) {
    // Handles the rare concurrent retry where another request with the same
    // idempotency key wins the unique constraint between lookup and insert.
    const raced = await findOrderByIdempotencyKey(env.DB, idempotencyKey);
    if (raced) {
      return json(
        {
          order: {
            reference: raced.publicReference,
            status: raced.status,
            createdAt: raced.createdAt,
          },
          idempotentReplay: true,
        },
        200,
      );
    }
    throw error;
  }
}
