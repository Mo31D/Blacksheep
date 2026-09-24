import type { RequestedCartLine } from "../domain/pricing";
import type { DeliveryAddress, FulfilmentMethod } from "../domain/order";

const MAX_BODY_BYTES = 32 * 1024;
const MAX_ITEMS = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTCODE_PATTERN = /^[A-Z0-9][A-Z0-9 ]{1,8}[A-Z0-9]$/i;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class OrderRequestValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface ParsedOrderRequest {
  turnstileToken: string;
  fulfilmentMethod: FulfilmentMethod;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  deliveryAddress: DeliveryAddress | null;
  customerNote: string | null;
  items: RequestedCartLine[];
}

function object(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OrderRequestValidationError(code, "Expected an object.");
  }
  return value as Record<string, unknown>;
}

function stringValue(
  value: unknown,
  code: string,
  max: number,
  required = true,
): string | null {
  if (value === undefined || value === null || value === "") {
    if (required) throw new OrderRequestValidationError(code, "Field is required.");
    return null;
  }
  if (typeof value !== "string") {
    throw new OrderRequestValidationError(code, "Expected a string.");
  }
  const normalized = value.trim();
  if (required && !normalized) {
    throw new OrderRequestValidationError(code, "Field is required.");
  }
  if (normalized.length > max) {
    throw new OrderRequestValidationError(code, "Field is too long.");
  }
  return normalized || null;
}

export function validateIdempotencyKey(value: string | null): string {
  if (!value || !UUID_PATTERN.test(value)) {
    throw new OrderRequestValidationError(
      "invalid_idempotency_key",
      "A UUID Idempotency-Key header is required.",
    );
  }
  return value.toLowerCase();
}

export async function readOrderRequest(request: Request): Promise<ParsedOrderRequest> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new OrderRequestValidationError(
      "unsupported_media_type",
      "Content-Type must be application/json.",
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new OrderRequestValidationError("payload_too_large", "Request body is too large.");
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new OrderRequestValidationError("payload_too_large", "Request body is too large.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new OrderRequestValidationError("invalid_json", "Request body is not valid JSON.");
  }

  const root = object(parsed, "invalid_request");
  const turnstileToken = stringValue(root.turnstileToken, "turnstile_token_required", 2048)!;

  if (root.fulfilmentMethod !== "delivery" && root.fulfilmentMethod !== "collection") {
    throw new OrderRequestValidationError(
      "invalid_fulfilment_method",
      "Fulfilment method must be delivery or collection.",
    );
  }
  const fulfilmentMethod = root.fulfilmentMethod;

  const customer = object(root.customer, "invalid_customer");
  const customerName = stringValue(customer.name, "customer_name_required", 120)!;
  const customerEmail = stringValue(customer.email, "customer_email_required", 254)!.toLowerCase();
  if (!EMAIL_PATTERN.test(customerEmail)) {
    throw new OrderRequestValidationError("invalid_customer_email", "Email address is invalid.");
  }
  const customerPhone = stringValue(customer.phone, "invalid_customer_phone", 40, false);

  let deliveryAddress: DeliveryAddress | null = null;
  if (fulfilmentMethod === "delivery") {
    const address = object(root.deliveryAddress, "delivery_address_required");
    const line1 = stringValue(address.line1, "delivery_line1_required", 160)!;
    const line2 = stringValue(address.line2, "invalid_delivery_line2", 160, false);
    const town = stringValue(address.town, "delivery_town_required", 120)!;
    const county = stringValue(address.county, "invalid_delivery_county", 120, false);
    const postcode = stringValue(address.postcode, "delivery_postcode_required", 16)!.toUpperCase();
    if (!POSTCODE_PATTERN.test(postcode)) {
      throw new OrderRequestValidationError("invalid_delivery_postcode", "Postcode is invalid.");
    }
    const country = stringValue(address.country, "delivery_country_required", 2)!.toUpperCase();
    if (country !== "GB") {
      throw new OrderRequestValidationError(
        "delivery_country_not_supported",
        "Commerce V1 delivery is currently limited to the United Kingdom.",
      );
    }
    deliveryAddress = { line1, line2, town, county, postcode, country };
  }

  const customerNote = stringValue(root.note, "invalid_customer_note", 1000, false);

  if (!Array.isArray(root.items) || root.items.length < 1 || root.items.length > MAX_ITEMS) {
    throw new OrderRequestValidationError(
      "invalid_items",
      `Order must contain between 1 and ${MAX_ITEMS} product lines.`,
    );
  }

  const items = root.items.map((rawItem, index): RequestedCartLine => {
    const item = object(rawItem, `invalid_item_${index + 1}`);
    const productId = stringValue(item.productId, "product_id_required", 80)!;
    if (!Number.isInteger(item.quantity) || (item.quantity as number) < 1 || (item.quantity as number) > 99) {
      throw new OrderRequestValidationError(
        "invalid_quantity",
        "Quantity must be an integer between 1 and 99.",
      );
    }
    return { productId, quantity: item.quantity as number };
  });

  return {
    turnstileToken,
    fulfilmentMethod,
    customerName,
    customerEmail,
    customerPhone,
    deliveryAddress,
    customerNote,
    items,
  };
}
