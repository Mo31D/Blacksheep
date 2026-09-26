import type { D1DatabaseLike } from "../data/d1";
import {
  applyAdminOrderUpdate,
  getAdminOrderDetail,
  getAdminOrderState,
  getAdminReports,
  getPaymentNotificationSnapshot,
  resetAdminTestOrders,
  listAdminOrders,
} from "../data/admin-orders";
import { validateAdminOrderAction } from "../domain/admin-order";
import { listPublicCommerceProducts } from "../data/public-catalog";
import {
  getOrderRefundSummary,
  recordManualRefund,
} from "../data/refunds";
import {
  createCustomerReviewToken,
  listOrderMessages,
} from "../data/customer-review";
import {
  addCatalogItemToDraftRevision,
  addDraftRevisionAdjustment,
  createDraftRevisionFromOriginal,
  getOrderRevisionDetail,
  listOrderRevisions,
  removeAddedRevisionLine,
  removeDraftRevisionAdjustment,
  restoreOriginalRevisionLine,
  substituteDraftRevisionLine,
  transitionOrderRevision,
  updateDraftRevision,
} from "../data/order-revisions";
import {
  adminSessionCookie,
  clearAdminSessionCookie,
  requestAdminLoginCode,
  revokeAdminSession,
  verifyAdminAccess,
  verifyAdminLoginCode,
  type AdminAccessEnv,
  type AdminIdentity,
} from "../security/admin-access";
import { adminHtml, adminLoginHtml } from "../admin/ui";
import { notifyPaymentConfirmed, notifyPaymentRequest, type PaymentNotificationEnv } from "../notifications/payment";
import { notifyLifecycleUpdate } from "../notifications/status";
import { notifyRefundRecorded } from "../notifications/refund";
import { sendOwnerCustomerMessage } from "../notifications/customer-message";
import {
  getAdminProductDetail,
  listAdminProducts,
} from "../data/products";
import {
  archiveAdminCategory,
  archiveAdminProduct,
  createAdminCategory,
  createAdminProduct,
  duplicateAdminProduct,
  listAdminCategories,
  moveAdminCategory,
  publishAdminProduct,
  restoreAdminCategory,
  quickEditAdminProduct,
  saveAdminProductDraft,
  updateAdminCategory,
  updateAdminProductOperations,
  updateAdminVariant,
} from "../data/product-editor";
import {
  addAdminProductMedia,
  removeAdminProductMedia,
  reorderAdminProductMedia,
  replaceAdminProductMedia,
  updateAdminProductMedia,
  type R2BucketLike,
} from "../data/product-media";
import {
  adjustInventory,
  bulkInventoryCount,
  initialInventoryCount,
  listAdminInventory,
  listInventoryHistory,
  listInventoryLocations,
  physicalInventoryCount,
} from "../data/inventory";
import {
  expireDueReservations,
  getRevisionReservationAdminView,
  returnConsumedReservationToStock,
} from "../data/order-reservations";

export interface AdminEnv extends AdminAccessEnv, PaymentNotificationEnv {
  ENVIRONMENT?: string;
  DB?: D1DatabaseLike;
  PRODUCT_MEDIA?: R2BucketLike;
  ORDER_RESERVATIONS_ENABLED?: string;
}

interface AdminDependencies {
  verifyAccessFn: typeof verifyAdminAccess;
  listOrderRevisionsFn: typeof listOrderRevisions;
  createDraftRevisionFromOriginalFn: typeof createDraftRevisionFromOriginal;
  getOrderRevisionDetailFn: typeof getOrderRevisionDetail;
  getRevisionReservationAdminViewFn: typeof getRevisionReservationAdminView;
  returnConsumedReservationToStockFn: typeof returnConsumedReservationToStock;
  updateDraftRevisionFn: typeof updateDraftRevision;
  addCatalogItemToDraftRevisionFn: typeof addCatalogItemToDraftRevision;
  addDraftRevisionAdjustmentFn: typeof addDraftRevisionAdjustment;
  substituteDraftRevisionLineFn: typeof substituteDraftRevisionLine;
  removeAddedRevisionLineFn: typeof removeAddedRevisionLine;
  removeDraftRevisionAdjustmentFn: typeof removeDraftRevisionAdjustment;
  restoreOriginalRevisionLineFn: typeof restoreOriginalRevisionLine;
  transitionOrderRevisionFn: typeof transitionOrderRevision;
  getOrderRefundSummaryFn: typeof getOrderRefundSummary;
  recordManualRefundFn: typeof recordManualRefund;
  createCustomerReviewTokenFn: typeof createCustomerReviewToken;
  listAdminProductsFn: typeof listAdminProducts;
  getAdminProductDetailFn: typeof getAdminProductDetail;
  listAdminCategoriesFn: typeof listAdminCategories;
  createAdminCategoryFn: typeof createAdminCategory;
  updateAdminCategoryFn: typeof updateAdminCategory;
  archiveAdminCategoryFn: typeof archiveAdminCategory;
  restoreAdminCategoryFn: typeof restoreAdminCategory;
  moveAdminCategoryFn: typeof moveAdminCategory;
  createAdminProductFn: typeof createAdminProduct;
  duplicateAdminProductFn: typeof duplicateAdminProduct;
  archiveAdminProductFn: typeof archiveAdminProduct;
  saveAdminProductDraftFn: typeof saveAdminProductDraft;
  publishAdminProductFn: typeof publishAdminProduct;
  quickEditAdminProductFn: typeof quickEditAdminProduct;
  updateAdminProductOperationsFn: typeof updateAdminProductOperations;
  updateAdminVariantFn: typeof updateAdminVariant;
  addAdminProductMediaFn: typeof addAdminProductMedia;
  updateAdminProductMediaFn: typeof updateAdminProductMedia;
  reorderAdminProductMediaFn: typeof reorderAdminProductMedia;
  replaceAdminProductMediaFn: typeof replaceAdminProductMedia;
  removeAdminProductMediaFn: typeof removeAdminProductMedia;
  listAdminInventoryFn: typeof listAdminInventory;
  listInventoryLocationsFn: typeof listInventoryLocations;
  initialInventoryCountFn: typeof initialInventoryCount;
  adjustInventoryFn: typeof adjustInventory;
  physicalInventoryCountFn: typeof physicalInventoryCount;
  bulkInventoryCountFn: typeof bulkInventoryCount;
  listInventoryHistoryFn: typeof listInventoryHistory;
}

const defaults: AdminDependencies = {
  verifyAccessFn: verifyAdminAccess,
  listOrderRevisionsFn: listOrderRevisions,
  createDraftRevisionFromOriginalFn: createDraftRevisionFromOriginal,
  getOrderRevisionDetailFn: getOrderRevisionDetail,
  getRevisionReservationAdminViewFn: getRevisionReservationAdminView,
  returnConsumedReservationToStockFn: returnConsumedReservationToStock,
  updateDraftRevisionFn: updateDraftRevision,
  addCatalogItemToDraftRevisionFn: addCatalogItemToDraftRevision,
  addDraftRevisionAdjustmentFn: addDraftRevisionAdjustment,
  substituteDraftRevisionLineFn: substituteDraftRevisionLine,
  removeAddedRevisionLineFn: removeAddedRevisionLine,
  removeDraftRevisionAdjustmentFn: removeDraftRevisionAdjustment,
  restoreOriginalRevisionLineFn: restoreOriginalRevisionLine,
  transitionOrderRevisionFn: transitionOrderRevision,
  getOrderRefundSummaryFn: getOrderRefundSummary,
  recordManualRefundFn: recordManualRefund,
  createCustomerReviewTokenFn: createCustomerReviewToken,
  listAdminProductsFn: listAdminProducts,
  getAdminProductDetailFn: getAdminProductDetail,
  listAdminCategoriesFn: listAdminCategories,
  createAdminCategoryFn: createAdminCategory,
  updateAdminCategoryFn: updateAdminCategory,
  archiveAdminCategoryFn: archiveAdminCategory,
  restoreAdminCategoryFn: restoreAdminCategory,
  moveAdminCategoryFn: moveAdminCategory,
  createAdminProductFn: createAdminProduct,
  duplicateAdminProductFn: duplicateAdminProduct,
  archiveAdminProductFn: archiveAdminProduct,
  saveAdminProductDraftFn: saveAdminProductDraft,
  publishAdminProductFn: publishAdminProduct,
  quickEditAdminProductFn: quickEditAdminProduct,
  updateAdminProductOperationsFn: updateAdminProductOperations,
  updateAdminVariantFn: updateAdminVariant,
  addAdminProductMediaFn: addAdminProductMedia,
  updateAdminProductMediaFn: updateAdminProductMedia,
  reorderAdminProductMediaFn: reorderAdminProductMedia,
  replaceAdminProductMediaFn: replaceAdminProductMedia,
  removeAdminProductMediaFn: removeAdminProductMedia,
  listAdminInventoryFn: listAdminInventory,
  listInventoryLocationsFn: listInventoryLocations,
  initialInventoryCountFn: initialInventoryCount,
  adjustInventoryFn: adjustInventory,
  physicalInventoryCountFn: physicalInventoryCount,
  bulkInventoryCountFn: bulkInventoryCount,
  listInventoryHistoryFn: listInventoryHistory,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

function error(code: string, status: number, message = code): Response {
  return json({ error: { code, message } }, status);
}
function categoryMutationError(cause: unknown): Response {
  const code = cause instanceof Error ? cause.message : "category_update_failed";
  const messages: Record<string, string> = {
    category_name_required: "Category name is required.",
    category_name_too_long: "Category name must be 80 characters or fewer.",
    category_name_conflict: "A category with that name already exists.",
    category_type_invalid: "Choose a valid category group.",
    category_sort_order_invalid: "Category order is invalid.",
    category_move_invalid: "Category move is invalid.",
    category_archived: "Restore this category before changing its order.",
    category_slug_unavailable: "A unique category address could not be created.",
    category_not_found: "Category not found.",
  };
  const status =
    code === "category_not_found" ? 404 :
    code === "category_name_conflict" ? 409 :
    400;
  return error(code, status, messages[code] ?? "Unable to update category.");
}

function productMutationError(cause: unknown): Response {
  const code = cause instanceof Error ? cause.message : "product_update_failed";
  const conflictCodes = new Set([
    "product_version_conflict",
    "product_variant_version_conflict",
    "product_sku_conflict",
    "product_barcode_conflict",
    "product_no_draft",
    "product_publish_requires_category",
    "product_publish_requires_price",
    "product_category_archived",
    "product_already_archived",
    "product_media_requires_draft",
    "product_media_primary_required",
    "product_media_order_mismatch",
  ]);
  const notFoundCodes = new Set([
    "product_not_found",
    "product_variant_not_found",
    "product_category_not_found",
    "product_media_not_found",
  ]);
  const status = notFoundCodes.has(code) ? 404 : conflictCodes.has(code) ? 409 : 400;
  const messages: Record<string, string> = {
    product_version_conflict: "This product changed while you were editing it. Reload and try again.",
    product_variant_version_conflict: "Price or product code changed while you were editing it. Reload and try again.",
    product_sku_conflict: "That SKU is already used by another product.",
    product_barcode_conflict: "That barcode is already used by another product.",
    product_no_draft: "There are no draft changes to publish.",
    product_publish_requires_category: "Add at least one category before publishing.",
    product_publish_requires_price: "Add a price or disable online ordering before publishing.",
    product_already_archived: "This product is already archived.",
    product_not_found: "Product not found.",
    product_variant_not_found: "Product variant not found.",
    product_category_not_found: "One of the selected categories no longer exists.",
    product_category_archived: "That category is archived. Restore it before adding it to another product.",
    product_media_not_found: "That image is no longer attached to this product.",
    product_media_requires_draft: "A product draft is required before changing images.",
    product_media_primary_required: "Choose another primary image before clearing this one.",
    product_media_order_mismatch: "The gallery changed while you were editing it. Reload and try again.",
    product_media_order_invalid: "The gallery order is invalid.",
    product_media_primary_invalid: "Primary image value is invalid.",
    product_media_archived: "Archived products cannot be edited.",
  };
  return error(code, status, messages[code] ?? "Unable to update product.");
}

const PRODUCT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const PRODUCT_IMAGE_TYPES: Record<string, { extension: string; signature: (bytes: Uint8Array) => boolean }> = {
  "image/jpeg": {
    extension: "jpg",
    signature: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  "image/png": {
    extension: "png",
    signature: (bytes) =>
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a,
  },
  "image/webp": {
    extension: "webp",
    signature: (bytes) =>
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP",
  },
};

async function readProductImageUpload(request: Request): Promise<{
  expectedVersion: number;
  altText: string | null;
  mimeType: string;
  extension: string;
  bytes: Uint8Array;
  checksumSha256: string;
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new Error("product_media_multipart_required");
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("product_media_file_required");
  if (file.size <= 0) throw new Error("product_media_file_empty");
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) throw new Error("product_media_file_too_large");

  const config = PRODUCT_IMAGE_TYPES[file.type.toLowerCase()];
  if (!config) throw new Error("product_media_type_invalid");

  const expectedVersion = Number(form.get("expectedVersion"));
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new Error("product_expected_version_invalid");
  }

  const rawAlt = String(form.get("altText") ?? "").trim();
  if (rawAlt.length > 240) throw new Error("product_media_alt_text_too_long");

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (!config.signature(bytes)) throw new Error("product_media_signature_invalid");

  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
  const checksumSha256 = Array.from(digest)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

  return {
    expectedVersion,
    altText: rawAlt || null,
    mimeType: file.type.toLowerCase(),
    extension: config.extension,
    bytes,
    checksumSha256,
  };
}

async function ensureMediaDraft(
  deps: AdminDependencies,
  db: D1DatabaseLike,
  productId: string,
  expected: number,
  actorEmail: string,
): Promise<Record<string, unknown>> {
  let product = await deps.getAdminProductDetailFn(db, productId);
  if (!product) throw new Error("product_not_found");
  if (Number(product.version) !== expected) throw new Error("product_version_conflict");
  if (product.publicationStatus === "ARCHIVED") throw new Error("product_media_archived");

  if (!product.draftVersionId) {
    await deps.saveAdminProductDraftFn(
      db,
      productId,
      { expectedVersion: expected, changes: {} },
      actorEmail,
    );
    product = await deps.getAdminProductDetailFn(db, productId);
    if (!product) throw new Error("product_not_found");
  }

  return product;
}

function productMediaInputError(cause: unknown): Response {
  const code = cause instanceof Error ? cause.message : "product_media_failed";
  const messages: Record<string, string> = {
    product_media_multipart_required: "Image upload must use multipart form data.",
    product_media_file_required: "Choose an image to upload.",
    product_media_file_empty: "The selected image is empty.",
    product_media_file_too_large: "Image must be 8 MB or smaller.",
    product_media_type_invalid: "Use a JPEG, PNG or WebP image.",
    product_media_signature_invalid: "The file content does not match its image type.",
    product_media_alt_text_too_long: "Alt text must be 240 characters or fewer.",
    product_media_archived: "Archived products cannot be edited.",
  };
  if (messages[code]) return error(code, 400, messages[code]);
  return productMutationError(cause);
}

function inventoryMutationError(cause: unknown): Response {
  const code = cause instanceof Error ? cause.message : "inventory_update_failed";
  const notFound = new Set([
    "inventory_variant_not_found",
    "inventory_location_not_found",
  ]);
  const conflicts = new Set([
    "inventory_already_tracked",
    "inventory_balance_exists",
    "inventory_not_tracked",
    "inventory_balance_version_conflict",
    "inventory_concurrency_conflict",
    "inventory_idempotency_conflict",
    "inventory_product_archived",
  ]);
  const impossible = new Set([
    "inventory_negative_on_hand",
    "inventory_adjustment_sign_invalid",
  ]);
  const status = notFound.has(code)
    ? 404
    : conflicts.has(code)
      ? 409
      : impossible.has(code)
        ? 422
        : 400;
  const messages: Record<string, string> = {
    inventory_variant_not_found: "Product variant not found.",
    inventory_location_not_found: "Stock location not found.",
    inventory_already_tracked: "Inventory tracking is already active. Use a stock count or adjustment instead.",
    inventory_balance_exists: "A stock balance already exists for this product and location.",
    inventory_not_tracked: "Start with an Initial Count before adjusting this product.",
    inventory_balance_version_conflict: "Stock changed while you were editing it. Reload the latest quantity and try again.",
    inventory_concurrency_conflict: "Stock changed during this operation. Reload and try again.",
    inventory_idempotency_conflict: "This request key was already used for a different stock operation.",
    inventory_product_archived: "Archived products cannot start inventory tracking.",
    inventory_negative_on_hand: "This adjustment would make On hand negative.",
    inventory_adjustment_sign_invalid: "The adjustment direction does not match the selected reason.",
    inventory_reason_code_invalid: "Choose a valid stock adjustment reason.",
    inventory_idempotency_key_invalid: "The stock operation key is invalid.",
    inventory_bulk_items_invalid: "Bulk count must contain between 1 and 250 products.",
    inventory_bulk_duplicate_variant: "A product appears more than once in this stock count.",
  };
  return error(code, status, messages[code] ?? "Unable to update inventory.");
}

async function readProductJson(request: Request): Promise<Record<string, unknown>> {
  const raw = await readJson(request);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("product_invalid_request");
  }
  return raw as Record<string, unknown>;
}

async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new Error("admin_json_required");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 16 * 1024) {
    throw new Error("admin_payload_too_large");
  }
  return JSON.parse(text);
}

function adminOriginAllowed(request: Request, url: URL): boolean {
  const origin = request.headers.get("origin");
  if (origin) return origin === url.origin;

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === url.origin;
    } catch {
      return false;
    }
  }

  return true;
}

export async function handleAdminRequest(
  request: Request,
  env: AdminEnv,
  dependencies: Partial<AdminDependencies> = {},
): Promise<Response> {
  const deps = { ...defaults, ...dependencies };
  const url = new URL(request.url);

  if (
    ["POST", "PATCH", "PUT", "DELETE"].includes(request.method) &&
    url.pathname.startsWith("/admin/") &&
    !adminOriginAllowed(request, url)
  ) {
    return error("admin_origin_forbidden", 403, "Admin request origin is not allowed.");
  }

  if (url.pathname === "/admin/auth/request" && request.method === "POST") {
    const result = await requestAdminLoginCode(env);
    if (!result.ok) {
      return error(result.code ?? "admin_login_failed", result.status, "Unable to send login code.");
    }
    return json({ ok: true });
  }

  if (url.pathname === "/admin/auth/verify" && request.method === "POST") {
    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch {
      return error("admin_invalid_request", 400, "Invalid login code.");
    }
    const code =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? String((raw as Record<string, unknown>).code ?? "").trim()
        : "";
    const result = await verifyAdminLoginCode(code, env);
    if (!result.ok) {
      return error(result.code, result.status, "Invalid or expired login code.");
    }
    const response = json({ ok: true });
    response.headers.append("set-cookie", adminSessionCookie(result.token));
    return response;
  }

  if (url.pathname === "/admin/auth/logout" && request.method === "POST") {
    await revokeAdminSession(request, env);
    const response = json({ ok: true });
    response.headers.append("set-cookie", clearAdminSessionCookie());
    return response;
  }

  const access = await deps.verifyAccessFn(request, env);

  if (
    (url.pathname === "/admin" || url.pathname === "/admin/") &&
    request.method === "GET" &&
    (!access.ok || !access.identity)
  ) {
    return new Response(adminLoginHtml(), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
        "content-security-policy":
          "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      },
    });
  }

  if (!access.ok || !access.identity) {
    return error(
      access.code ?? "admin_forbidden",
      access.status,
      "Admin sign-in required.",
    );
  }

  if (!env.DB) return error("database_unavailable", 503, "Order database unavailable.");

  const identity: AdminIdentity = access.identity;

  if ((url.pathname === "/admin" || url.pathname === "/admin/") && request.method === "GET") {
    return new Response(adminHtml(identity.email, env.ENVIRONMENT ?? "production"), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
        "content-security-policy":
          "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data: https://theblacksheepshop.co.uk https://www.theblacksheepshop.co.uk; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      },
    });
  }

  if (url.pathname === "/admin/api/orders" && request.method === "GET") {
    const status = url.searchParams.get("status");
    const requestedClass = url.searchParams.get("dataClass");
    const dataClass =
      env.ENVIRONMENT !== "production" && requestedClass === "TEST"
        ? "TEST"
        : "BUSINESS";
    const orders = await listAdminOrders(env.DB, status, dataClass);
    return json({ orders, dataClass });
  }

  if (url.pathname === "/admin/api/test-orders/reset" && request.method === "POST") {
    if (env.ENVIRONMENT === "production") {
      return error("test_order_reset_forbidden", 403, "Test-order reset is not available in Production.");
    }
    try {
      const raw = (await readProductJson(request)) as Record<string, unknown>;
      if (raw.confirmation !== "RESET TEST ORDERS") {
        return error(
          "test_order_reset_confirmation_required",
          400,
          "Type RESET TEST ORDERS to confirm.",
        );
      }
      return json(await resetAdminTestOrders(env.DB));
    } catch (cause) {
      return error(
        "test_order_reset_failed",
        400,
        cause instanceof Error ? cause.message : "Unable to reset test orders.",
      );
    }
  }

  if (url.pathname === "/admin/api/reports" && request.method === "GET") {
    const days = Number(url.searchParams.get("days") ?? "30");
    const reports = await getAdminReports(env.DB, Number.isFinite(days) ? days : 30);
    return json(reports);
  }

  if (url.pathname === "/admin/api/catalog" && request.method === "GET") {
    const query = url.searchParams.get("q") ?? "";
    const result = await listPublicCommerceProducts(env.DB, {
      query,
      limit: 60,
    });
    const products = result.products
      .filter((product) => product.purchasable)
      .map((product) => ({
        id: product.id,
        sku: product.sku,
        slug: product.slug,
        name: product.name,
        type: product.type,
        priceMinor: product.priceMinor,
      }));
    return json({ products });
  }

  if (url.pathname === "/admin/api/inventory/locations" && request.method === "GET") {
    const locations = await deps.listInventoryLocationsFn(env.DB);
    return json({ locations });
  }

  if (url.pathname === "/admin/api/inventory" && request.method === "GET") {
    const result = await deps.listAdminInventoryFn(env.DB, {
      q: url.searchParams.get("q") ?? "",
      category: url.searchParams.get("category"),
      state: url.searchParams.get("state"),
      locationId: url.searchParams.get("location"),
      cursor: url.searchParams.get("cursor"),
      limit: Number(url.searchParams.get("limit") ?? "60"),
    });
    return json(result);
  }

  if (url.pathname === "/admin/api/inventory/initial-count" && request.method === "POST") {
    try {
      const raw = await readProductJson(request);
      const result = await deps.initialInventoryCountFn(
        env.DB,
        raw as unknown as Parameters<typeof initialInventoryCount>[1],
        identity.email,
      );
      return json(result, 201);
    } catch (cause) {
      return inventoryMutationError(cause);
    }
  }

  if (url.pathname === "/admin/api/inventory/adjustments" && request.method === "POST") {
    try {
      const raw = await readProductJson(request);
      const result = await deps.adjustInventoryFn(
        env.DB,
        raw as unknown as Parameters<typeof adjustInventory>[1],
        identity.email,
      );
      return json(result, 201);
    } catch (cause) {
      return inventoryMutationError(cause);
    }
  }

  if (url.pathname === "/admin/api/inventory/count" && request.method === "POST") {
    try {
      const raw = await readProductJson(request);
      const result = await deps.physicalInventoryCountFn(
        env.DB,
        raw as unknown as Parameters<typeof physicalInventoryCount>[1],
        identity.email,
      );
      return json(result, 201);
    } catch (cause) {
      return inventoryMutationError(cause);
    }
  }

  if (url.pathname === "/admin/api/inventory/bulk-count" && request.method === "POST") {
    try {
      const raw = await readProductJson(request);
      const result = await deps.bulkInventoryCountFn(
        env.DB,
        raw as unknown as Parameters<typeof bulkInventoryCount>[1],
        identity.email,
      );
      return json(result);
    } catch (cause) {
      return inventoryMutationError(cause);
    }
  }

  const inventoryHistoryMatch = url.pathname.match(
    /^\/admin\/api\/variants\/([^/]+)\/inventory\/history$/,
  );
  if (inventoryHistoryMatch && request.method === "GET") {
    const variantId = decodeURIComponent(inventoryHistoryMatch[1]);
    const history = await deps.listInventoryHistoryFn(env.DB, variantId, {
      locationId: url.searchParams.get("location"),
      cursor: url.searchParams.get("cursor"),
      limit: Number(url.searchParams.get("limit") ?? "40"),
    });
    return json(history);
  }

  if (url.pathname === "/admin/api/products" && request.method === "GET") {
    const result = await deps.listAdminProductsFn(env.DB, {
      q: url.searchParams.get("q") ?? "",
      publication: url.searchParams.get("publication"),
      sellStatus: url.searchParams.get("sellStatus"),
      stock: url.searchParams.get("stock"),
      category: url.searchParams.get("category"),
      quality: url.searchParams.get("quality"),
      sort: url.searchParams.get("sort"),
      cursor: url.searchParams.get("cursor"),
      limit: Number(url.searchParams.get("limit") ?? "60"),
    });
    return json(result);
  }

  if (url.pathname === "/admin/api/categories" && request.method === "GET") {
    const categories = await deps.listAdminCategoriesFn(env.DB, {
      includeArchived: url.searchParams.get("includeArchived") === "1",
    });
    return json({ categories });
  }

  if (url.pathname === "/admin/api/categories" && request.method === "POST") {
    try {
      const raw = await readProductJson(request);
      const created = await deps.createAdminCategoryFn(
        env.DB,
        raw as unknown as Parameters<typeof createAdminCategory>[1],
      );
      const categories = await deps.listAdminCategoriesFn(env.DB, {
        includeArchived: true,
      });
      return json(
        { category: categories.find((category) => category.id === created.id) ?? null },
        201,
      );
    } catch (cause) {
      return categoryMutationError(cause);
    }
  }

  const categoryMatch = url.pathname.match(/^\/admin\/api\/categories\/([^/]+)$/);
  if (categoryMatch && request.method === "PATCH") {
    const categoryId = decodeURIComponent(categoryMatch[1]);
    try {
      const raw = await readProductJson(request);
      await deps.updateAdminCategoryFn(
        env.DB,
        categoryId,
        raw as unknown as Parameters<typeof updateAdminCategory>[2],
      );
      const categories = await deps.listAdminCategoriesFn(env.DB, {
        includeArchived: true,
      });
      return json({
        category: categories.find((category) => category.id === categoryId) ?? null,
      });
    } catch (cause) {
      return categoryMutationError(cause);
    }
  }

  const categoryMoveMatch = url.pathname.match(
    /^\/admin\/api\/categories\/([^/]+)\/move$/,
  );
  if (categoryMoveMatch && request.method === "POST") {
    const categoryId = decodeURIComponent(categoryMoveMatch[1]);
    try {
      const raw = await readProductJson(request);
      const direction = String(raw.direction ?? "").toUpperCase() as "UP" | "DOWN";
      await deps.moveAdminCategoryFn(env.DB, categoryId, direction);
      return json({ ok: true });
    } catch (cause) {
      return categoryMutationError(cause);
    }
  }

  const categoryArchiveMatch = url.pathname.match(
    /^\/admin\/api\/categories\/([^/]+)\/archive$/,
  );
  if (categoryArchiveMatch && request.method === "POST") {
    const categoryId = decodeURIComponent(categoryArchiveMatch[1]);
    try {
      await deps.archiveAdminCategoryFn(env.DB, categoryId);
      return json({ ok: true });
    } catch (cause) {
      return categoryMutationError(cause);
    }
  }

  const categoryRestoreMatch = url.pathname.match(
    /^\/admin\/api\/categories\/([^/]+)\/restore$/,
  );
  if (categoryRestoreMatch && request.method === "POST") {
    const categoryId = decodeURIComponent(categoryRestoreMatch[1]);
    try {
      await deps.restoreAdminCategoryFn(env.DB, categoryId);
      return json({ ok: true });
    } catch (cause) {
      return categoryMutationError(cause);
    }
  }

  if (url.pathname === "/admin/api/products" && request.method === "POST") {
    try {
      const raw = await readProductJson(request);
      const created = await deps.createAdminProductFn(
        env.DB,
        raw as unknown as Parameters<typeof createAdminProduct>[1],
        identity.email,
      );
      const product = await deps.getAdminProductDetailFn(env.DB, created.id);
      return json({ product }, 201);
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith("admin_")) {
        return error(
          cause.message,
          cause.message === "admin_payload_too_large" ? 413 : 400,
          "Invalid product request.",
        );
      }
      return productMutationError(cause);
    }
  }

  const productDuplicateMatch = url.pathname.match(
    /^\/admin\/api\/products\/([^/]+)\/duplicate$/,
  );
  if (productDuplicateMatch && request.method === "POST") {
    const productId = decodeURIComponent(productDuplicateMatch[1]);
    try {
      const raw = await readProductJson(request);
      const created = await deps.duplicateAdminProductFn(
        env.DB,
        productId,
        raw as unknown as Parameters<typeof duplicateAdminProduct>[2],
        identity.email,
      );
      const product = await deps.getAdminProductDetailFn(env.DB, created.id);
      return json({ product }, 201);
    } catch (cause) {
      return productMutationError(cause);
    }
  }

  const productArchiveMatch = url.pathname.match(
    /^\/admin\/api\/products\/([^/]+)\/archive$/,
  );
  if (productArchiveMatch && request.method === "POST") {
    const productId = decodeURIComponent(productArchiveMatch[1]);
    try {
      const raw = await readProductJson(request);
      await deps.archiveAdminProductFn(
        env.DB,
        productId,
        raw as unknown as Parameters<typeof archiveAdminProduct>[2],
        identity.email,
      );
      const product = await deps.getAdminProductDetailFn(env.DB, productId);
      return json({ product });
    } catch (cause) {
      return productMutationError(cause);
    }
  }

  const productMediaOrderMatch = url.pathname.match(
    /^\/admin\/api\/products\/([^/]+)\/media-order$/,
  );
  if (productMediaOrderMatch && request.method === "PATCH") {
    const productId = decodeURIComponent(productMediaOrderMatch[1]);
    try {
      const raw = await readProductJson(request);
      const expected = Number(raw.expectedVersion);
      const product = await ensureMediaDraft(
        deps,
        env.DB,
        productId,
        expected,
        identity.email,
      );
      await deps.reorderAdminProductMediaFn(
        env.DB,
        productId,
        {
          ...raw,
          expectedVersion: Number(product.version),
        } as unknown as Parameters<typeof reorderAdminProductMedia>[2],
        identity.email,
      );
      const updated = await deps.getAdminProductDetailFn(env.DB, productId);
      return json({ product: updated });
    } catch (cause) {
      return productMediaInputError(cause);
    }
  }

  const productMediaReplaceMatch = url.pathname.match(
    /^\/admin\/api\/products\/([^/]+)\/media\/([^/]+)\/replace$/,
  );
  if (productMediaReplaceMatch && request.method === "POST") {
    const productId = decodeURIComponent(productMediaReplaceMatch[1]);
    const oldMediaId = decodeURIComponent(productMediaReplaceMatch[2]);
    if (!env.PRODUCT_MEDIA) {
      return error(
        "product_media_storage_unavailable",
        503,
        "Product image storage is not configured.",
      );
    }

    let newStorageKey: string | null = null;
    try {
      const upload = await readProductImageUpload(request);
      const product = await ensureMediaDraft(
        deps,
        env.DB,
        productId,
        upload.expectedVersion,
        identity.email,
      );
      const mediaId = "med_" + crypto.randomUUID();
      const month = new Date().toISOString().slice(0, 7);
      newStorageKey =
        "products/" +
        productId +
        "/" +
        month +
        "/" +
        mediaId +
        "." +
        upload.extension;

      await env.PRODUCT_MEDIA.put(newStorageKey, upload.bytes, {
        httpMetadata: {
          contentType: upload.mimeType,
          cacheControl: "public, max-age=31536000, immutable",
        },
        customMetadata: {
          productId,
          mediaId,
          checksumSha256: upload.checksumSha256,
          replacesMediaId: oldMediaId,
        },
      });

      const replaced = await deps.replaceAdminProductMediaFn(
        env.DB,
        productId,
        oldMediaId,
        {
          expectedVersion: Number(product.version),
          mediaId,
          storageKey: newStorageKey,
          publicUrl: "/media/" + encodeURIComponent(mediaId),
          mimeType: upload.mimeType,
          width: null,
          height: null,
          fileSize: upload.bytes.byteLength,
          checksumSha256: upload.checksumSha256,
          altText: upload.altText,
        },
        identity.email,
      );

      let storageCleanupPending = false;
      if (
        replaced.shouldDeleteOldObject &&
        replaced.oldStorageProvider === "R2"
      ) {
        try {
          await env.PRODUCT_MEDIA.delete(replaced.oldStorageKey);
        } catch {
          storageCleanupPending = true;
        }
      }

      const updated = await deps.getAdminProductDetailFn(env.DB, productId);
      return json({ product: updated, storageCleanupPending }, 201);
    } catch (cause) {
      if (newStorageKey && env.PRODUCT_MEDIA) {
        try {
          await env.PRODUCT_MEDIA.delete(newStorageKey);
        } catch {
          // Preserve the original error; orphan cleanup can be handled separately.
        }
      }
      return productMediaInputError(cause);
    }
  }

  const productMediaItemMatch = url.pathname.match(
    /^\/admin\/api\/products\/([^/]+)\/media\/([^/]+)$/,
  );
  if (productMediaItemMatch && request.method === "PATCH") {
    const productId = decodeURIComponent(productMediaItemMatch[1]);
    const mediaId = decodeURIComponent(productMediaItemMatch[2]);
    try {
      const raw = await readProductJson(request);
      const expected = Number(raw.expectedVersion);
      const product = await ensureMediaDraft(
        deps,
        env.DB,
        productId,
        expected,
        identity.email,
      );
      await deps.updateAdminProductMediaFn(
        env.DB,
        productId,
        mediaId,
        {
          ...raw,
          expectedVersion: Number(product.version),
        } as unknown as Parameters<typeof updateAdminProductMedia>[3],
        identity.email,
      );
      const updated = await deps.getAdminProductDetailFn(env.DB, productId);
      return json({ product: updated });
    } catch (cause) {
      return productMediaInputError(cause);
    }
  }

  if (productMediaItemMatch && request.method === "DELETE") {
    const productId = decodeURIComponent(productMediaItemMatch[1]);
    const mediaId = decodeURIComponent(productMediaItemMatch[2]);
    try {
      const raw = await readProductJson(request);
      const expected = Number(raw.expectedVersion);
      const product = await ensureMediaDraft(
        deps,
        env.DB,
        productId,
        expected,
        identity.email,
      );
      const removed = await deps.removeAdminProductMediaFn(
        env.DB,
        productId,
        mediaId,
        {
          expectedVersion: Number(product.version),
        },
        identity.email,
      );
      let storageCleanupPending = false;
      if (
        removed.shouldDeleteObject &&
        removed.storageProvider === "R2" &&
        env.PRODUCT_MEDIA
      ) {
        try {
          await env.PRODUCT_MEDIA.delete(removed.storageKey);
        } catch {
          storageCleanupPending = true;
        }
      }
      const updated = await deps.getAdminProductDetailFn(env.DB, productId);
      return json({ product: updated, storageCleanupPending });
    } catch (cause) {
      return productMediaInputError(cause);
    }
  }

  const productMediaUploadMatch = url.pathname.match(
    /^\/admin\/api\/products\/([^/]+)\/media$/,
  );
  if (productMediaUploadMatch && request.method === "POST") {
    const productId = decodeURIComponent(productMediaUploadMatch[1]);
    if (!env.PRODUCT_MEDIA) {
      return error(
        "product_media_storage_unavailable",
        503,
        "Product image storage is not configured.",
      );
    }

    let storageKey: string | null = null;
    try {
      const upload = await readProductImageUpload(request);
      const product = await ensureMediaDraft(
        deps,
        env.DB,
        productId,
        upload.expectedVersion,
        identity.email,
      );
      const mediaId = "med_" + crypto.randomUUID();
      const month = new Date().toISOString().slice(0, 7);
      storageKey =
        "products/" +
        productId +
        "/" +
        month +
        "/" +
        mediaId +
        "." +
        upload.extension;

      await env.PRODUCT_MEDIA.put(storageKey, upload.bytes, {
        httpMetadata: {
          contentType: upload.mimeType,
          cacheControl: "public, max-age=31536000, immutable",
        },
        customMetadata: {
          productId,
          mediaId,
          checksumSha256: upload.checksumSha256,
        },
      });

      await deps.addAdminProductMediaFn(
        env.DB,
        productId,
        {
          expectedVersion: Number(product.version),
          mediaId,
          storageKey,
          publicUrl: "/media/" + encodeURIComponent(mediaId),
          mimeType: upload.mimeType,
          width: null,
          height: null,
          fileSize: upload.bytes.byteLength,
          checksumSha256: upload.checksumSha256,
          altText: upload.altText,
        },
        identity.email,
      );

      const updated = await deps.getAdminProductDetailFn(env.DB, productId);
      return json({ product: updated }, 201);
    } catch (cause) {
      if (storageKey && env.PRODUCT_MEDIA) {
        try {
          await env.PRODUCT_MEDIA.delete(storageKey);
        } catch {
          // Orphan cleanup is preferable to masking the original mutation error.
        }
      }
      return productMediaInputError(cause);
    }
  }

  const productQuickEditMatch = url.pathname.match(
    /^\/admin\/api\/products\/([^/]+)\/quick-edit$/,
  );
  if (productQuickEditMatch && request.method === "PATCH") {
    const productId = decodeURIComponent(productQuickEditMatch[1]);
    try {
      const raw = await readProductJson(request);
      await deps.quickEditAdminProductFn(
        env.DB,
        productId,
        raw as unknown as Parameters<typeof quickEditAdminProduct>[2],
        identity.email,
      );
      const product = await deps.getAdminProductDetailFn(env.DB, productId);
      return json({ product });
    } catch (cause) {
      return productMutationError(cause);
    }
  }

  const productOperationsMatch = url.pathname.match(
    /^\/admin\/api\/products\/([^/]+)\/operations$/,
  );
  if (productOperationsMatch && request.method === "PATCH") {
    const productId = decodeURIComponent(productOperationsMatch[1]);
    try {
      const raw = await readProductJson(request);
      await deps.updateAdminProductOperationsFn(
        env.DB,
        productId,
        raw as unknown as Parameters<typeof updateAdminProductOperations>[2],
        identity.email,
      );
      const product = await deps.getAdminProductDetailFn(env.DB, productId);
      return json({ product });
    } catch (cause) {
      return productMutationError(cause);
    }
  }

  const productDraftMatch = url.pathname.match(
    /^\/admin\/api\/products\/([^/]+)\/draft$/,
  );
  if (productDraftMatch && request.method === "PATCH") {
    const productId = decodeURIComponent(productDraftMatch[1]);
    try {
      const raw = await readProductJson(request);
      await deps.saveAdminProductDraftFn(
        env.DB,
        productId,
        raw as unknown as Parameters<typeof saveAdminProductDraft>[2],
        identity.email,
      );
      const product = await deps.getAdminProductDetailFn(env.DB, productId);
      return json({ product });
    } catch (cause) {
      return productMutationError(cause);
    }
  }

  const productPublishMatch = url.pathname.match(
    /^\/admin\/api\/products\/([^/]+)\/publish$/,
  );
  if (productPublishMatch && request.method === "POST") {
    const productId = decodeURIComponent(productPublishMatch[1]);
    try {
      const raw = await readProductJson(request);
      await deps.publishAdminProductFn(
        env.DB,
        productId,
        raw as unknown as Parameters<typeof publishAdminProduct>[2],
        identity.email,
      );
      const product = await deps.getAdminProductDetailFn(env.DB, productId);
      return json({ product });
    } catch (cause) {
      return productMutationError(cause);
    }
  }

  const variantUpdateMatch = url.pathname.match(
    /^\/admin\/api\/variants\/([^/]+)$/,
  );
  if (variantUpdateMatch && request.method === "PATCH") {
    const variantId = decodeURIComponent(variantUpdateMatch[1]);
    try {
      const raw = await readProductJson(request);
      const updated = await deps.updateAdminVariantFn(
        env.DB,
        variantId,
        raw as unknown as Parameters<typeof updateAdminVariant>[2],
        identity.email,
      );
      const product = await deps.getAdminProductDetailFn(
        env.DB,
        updated.productId,
      );
      return json({ product });
    } catch (cause) {
      return productMutationError(cause);
    }
  }

  const productDetailMatch = url.pathname.match(
    /^\/admin\/api\/products\/([^/]+)$/,
  );
  if (productDetailMatch && request.method === "GET") {
    const productId = decodeURIComponent(productDetailMatch[1]);
    const product = await deps.getAdminProductDetailFn(env.DB, productId);
    return product
      ? json({ product })
      : error("product_not_found", 404, "Product not found.");
  }

  const revisionsMatch = url.pathname.match(
    /^\/admin\/api\/orders\/([^/]+)\/revisions$/,
  );
  if (revisionsMatch && request.method === "GET") {
    const reference = decodeURIComponent(revisionsMatch[1]);
    const revisions = await deps.listOrderRevisionsFn(env.DB, reference);
    return json({ revisions });
  }

  if (revisionsMatch && request.method === "POST") {
    const reference = decodeURIComponent(revisionsMatch[1]);
    try {
      const revision = await deps.createDraftRevisionFromOriginalFn(
        env.DB,
        reference,
        identity.email,
      );
      return json({ revision }, 201);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "revision_create_failed";
      if (code === "revision_order_not_found") {
        return error(code, 404, "Order not found.");
      }
      if (code === "revision_draft_already_exists") {
        return error(code, 409, "A draft revision already exists for this order.");
      }
      return error(code, 400, "Unable to create order revision.");
    }
  }

  const revisionDetailMatch = url.pathname.match(
    /^\/admin\/api\/orders\/([^/]+)\/revisions\/([^/]+)$/,
  );
  if (revisionDetailMatch && request.method === "GET") {
    const reference = decodeURIComponent(revisionDetailMatch[1]);
    const revisionId = decodeURIComponent(revisionDetailMatch[2]);
    const revision = await deps.getOrderRevisionDetailFn(env.DB, reference, revisionId);
    if (!revision) {
      return error("revision_not_found", 404, "Revision not found.");
    }
    const inventory =
      env.ORDER_RESERVATIONS_ENABLED === "true"
        ? await deps.getRevisionReservationAdminViewFn(env.DB, revisionId)
        : null;
    return json({
      revision: inventory ? { ...revision, inventory } : revision,
    });
  }

  if (revisionDetailMatch && request.method === "PATCH") {
    const reference = decodeURIComponent(revisionDetailMatch[1]);
    const revisionId = decodeURIComponent(revisionDetailMatch[2]);
    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "admin_invalid_request";
      return error(code, code === "admin_payload_too_large" ? 413 : 400, "Invalid revision update.");
    }

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return error("revision_invalid_update", 400, "Invalid revision update.");
    }

    try {
      const revision = await deps.updateDraftRevisionFn(
        env.DB,
        reference,
        revisionId,
        raw as Parameters<typeof updateDraftRevision>[3],
        identity.email,
      );
      return json({ revision });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "revision_update_failed";
      const status =
        code === "revision_not_found"
          ? 404
          : code === "revision_version_conflict" || code === "revision_not_draft"
            ? 409
            : 400;
      return error(code, status, status === 409 ? "Revision changed. Reload before editing again." : "Unable to update revision.");
    }
  }

  const revisionAddItemMatch = url.pathname.match(
    /^\/admin\/api\/orders\/([^/]+)\/revisions\/([^/]+)\/items$/,
  );
  if (revisionAddItemMatch && request.method === "POST") {
    const reference = decodeURIComponent(revisionAddItemMatch[1]);
    const revisionId = decodeURIComponent(revisionAddItemMatch[2]);

    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "admin_invalid_request";
      return error(code, code === "admin_payload_too_large" ? 413 : 400, "Invalid revision item.");
    }

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return error("revision_invalid_item", 400, "Invalid revision item.");
    }

    try {
      const revision = await deps.addCatalogItemToDraftRevisionFn(
        env.DB,
        reference,
        revisionId,
        raw as Parameters<typeof addCatalogItemToDraftRevision>[3],
        identity.email,
      );
      return json({ revision }, 201);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "revision_item_add_failed";
      const status =
        code === "revision_not_found"
          ? 404
          : code === "revision_version_conflict" ||
              code === "revision_not_draft" ||
              code === "revision_product_already_present"
            ? 409
            : code === "catalog_product_not_found" ||
                code === "catalog_product_not_purchasable" ||
                code === "arriving_soon" ||
                code === "out_of_stock" ||
                code === "price_unavailable"
              ? 409
              : 400;
      return error(code, status, status === 409 ? "The draft changed or that product cannot be added." : "Unable to add product.");
    }
  }

  const revisionSubstituteMatch = url.pathname.match(
    /^\/admin\/api\/orders\/([^/]+)\/revisions\/([^/]+)\/items\/(\d+)\/substitute$/,
  );
  if (revisionSubstituteMatch && request.method === "POST") {
    const reference = decodeURIComponent(revisionSubstituteMatch[1]);
    const revisionId = decodeURIComponent(revisionSubstituteMatch[2]);
    const lineNumber = Number(revisionSubstituteMatch[3]);

    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "admin_invalid_request";
      return error(code, code === "admin_payload_too_large" ? 413 : 400, "Invalid substitute item.");
    }

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return error("revision_invalid_item", 400, "Invalid substitute item.");
    }

    try {
      const revision = await deps.substituteDraftRevisionLineFn(
        env.DB,
        reference,
        revisionId,
        {
          ...(raw as Record<string, unknown>),
          lineNumber,
        } as Parameters<typeof substituteDraftRevisionLine>[3],
        identity.email,
      );
      return json({ revision });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "revision_substitute_failed";
      const status =
        code === "revision_not_found" || code === "revision_unknown_line"
          ? 404
          : code === "revision_version_conflict" ||
              code === "revision_not_draft" ||
              code === "revision_substitute_must_change_product"
            ? 409
            : code === "catalog_product_not_found" ||
                code === "catalog_product_not_purchasable" ||
                code === "arriving_soon" ||
                code === "out_of_stock" ||
                code === "price_unavailable"
              ? 409
              : 400;
      return error(code, status, status === 409 ? "The draft changed or that substitute cannot be used." : "Unable to substitute product.");
    }
  }

  const revisionLineMutationMatch = url.pathname.match(
    /^\/admin\/api\/orders\/([^/]+)\/revisions\/([^/]+)\/items\/(\d+)\/(reset)$/,
  );
  if (revisionLineMutationMatch && request.method === "POST") {
    const reference = decodeURIComponent(revisionLineMutationMatch[1]);
    const revisionId = decodeURIComponent(revisionLineMutationMatch[2]);
    const lineNumber = Number(revisionLineMutationMatch[3]);

    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "admin_invalid_request";
      return error(code, code === "admin_payload_too_large" ? 413 : 400, "Invalid revision reset.");
    }

    const expectedVersion =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? Number((raw as Record<string, unknown>).expectedVersion)
        : NaN;

    try {
      const revision = await deps.restoreOriginalRevisionLineFn(
        env.DB,
        reference,
        revisionId,
        lineNumber,
        expectedVersion,
        identity.email,
      );
      return json({ revision });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "revision_restore_failed";
      const status =
        code === "revision_not_found" ||
        code === "revision_unknown_line" ||
        code === "revision_original_item_not_found"
          ? 404
          : code === "revision_version_conflict" ||
              code === "revision_not_draft" ||
              code === "revision_restore_requires_original_item"
            ? 409
            : 400;
      return error(code, status, status === 409 ? "The reviewed version changed. Reload and try again." : "Unable to restore requested item.");
    }
  }

  const revisionLineDeleteMatch = url.pathname.match(
    /^\/admin\/api\/orders\/([^/]+)\/revisions\/([^/]+)\/items\/(\d+)$/,
  );
  if (revisionLineDeleteMatch && request.method === "DELETE") {
    const reference = decodeURIComponent(revisionLineDeleteMatch[1]);
    const revisionId = decodeURIComponent(revisionLineDeleteMatch[2]);
    const lineNumber = Number(revisionLineDeleteMatch[3]);

    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "admin_invalid_request";
      return error(code, code === "admin_payload_too_large" ? 413 : 400, "Invalid revision item removal.");
    }

    const expectedVersion =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? Number((raw as Record<string, unknown>).expectedVersion)
        : NaN;

    try {
      const revision = await deps.removeAddedRevisionLineFn(
        env.DB,
        reference,
        revisionId,
        lineNumber,
        expectedVersion,
        identity.email,
      );
      return json({ revision });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "revision_remove_failed";
      const status =
        code === "revision_not_found" || code === "revision_unknown_line"
          ? 404
          : code === "revision_version_conflict" ||
              code === "revision_not_draft" ||
              code === "revision_remove_requires_added_item"
            ? 409
            : 400;
      return error(code, status, status === 409 ? "The reviewed version changed. Reload and try again." : "Unable to remove reviewed item.");
    }
  }

  const revisionAdjustmentsMatch = url.pathname.match(
    /^\/admin\/api\/orders\/([^/]+)\/revisions\/([^/]+)\/adjustments$/,
  );
  if (revisionAdjustmentsMatch && request.method === "POST") {
    const reference = decodeURIComponent(revisionAdjustmentsMatch[1]);
    const revisionId = decodeURIComponent(revisionAdjustmentsMatch[2]);

    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch (cause) {
      const code =
        cause instanceof Error ? cause.message : "admin_invalid_request";
      return error(
        code,
        code === "admin_payload_too_large" ? 413 : 400,
        "Invalid revision adjustment.",
      );
    }

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return error(
        "revision_adjustment_invalid_request",
        400,
        "Invalid revision adjustment.",
      );
    }

    try {
      const revision = await deps.addDraftRevisionAdjustmentFn(
        env.DB,
        reference,
        revisionId,
        raw as Parameters<typeof addDraftRevisionAdjustment>[3],
        identity.email,
      );
      return json({ revision }, 201);
    } catch (cause) {
      const code =
        cause instanceof Error ? cause.message : "revision_adjustment_add_failed";
      const status =
        code === "revision_not_found"
          ? 404
          : code === "revision_version_conflict" ||
              code === "revision_not_draft"
            ? 409
            : 400;
      return error(
        code,
        status,
        status === 409
          ? "The reviewed version changed. Reload before adjusting the total."
          : "Unable to add adjustment.",
      );
    }
  }

  const revisionAdjustmentDeleteMatch = url.pathname.match(
    /^\/admin\/api\/orders\/([^/]+)\/revisions\/([^/]+)\/adjustments\/(\d+)$/,
  );
  if (revisionAdjustmentDeleteMatch && request.method === "DELETE") {
    const reference = decodeURIComponent(revisionAdjustmentDeleteMatch[1]);
    const revisionId = decodeURIComponent(revisionAdjustmentDeleteMatch[2]);
    const adjustmentId = Number(revisionAdjustmentDeleteMatch[3]);

    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch (cause) {
      const code =
        cause instanceof Error ? cause.message : "admin_invalid_request";
      return error(
        code,
        code === "admin_payload_too_large" ? 413 : 400,
        "Invalid adjustment removal.",
      );
    }

    const expectedVersion =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? Number((raw as Record<string, unknown>).expectedVersion)
        : NaN;

    try {
      const revision = await deps.removeDraftRevisionAdjustmentFn(
        env.DB,
        reference,
        revisionId,
        adjustmentId,
        expectedVersion,
        identity.email,
      );
      return json({ revision });
    } catch (cause) {
      const code =
        cause instanceof Error
          ? cause.message
          : "revision_adjustment_remove_failed";
      const status =
        code === "revision_not_found" ||
        code === "revision_adjustment_not_found"
          ? 404
          : code === "revision_version_conflict" ||
              code === "revision_not_draft"
            ? 409
            : 400;
      return error(
        code,
        status,
        status === 409
          ? "The reviewed version changed. Reload before removing the adjustment."
          : "Unable to remove adjustment.",
      );
    }
  }

  const revisionActionMatch = url.pathname.match(
    /^\/admin\/api\/orders\/([^/]+)\/revisions\/([^/]+)\/(send|accept|decline)$/,
  );
  if (revisionActionMatch && request.method === "POST") {
    const reference = decodeURIComponent(revisionActionMatch[1]);
    const revisionId = decodeURIComponent(revisionActionMatch[2]);
    const action = revisionActionMatch[3] as "send" | "accept" | "decline";

    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "admin_invalid_request";
      return error(code, code === "admin_payload_too_large" ? 413 : 400, "Invalid revision action.");
    }

    const expectedVersion =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? Number((raw as Record<string, unknown>).expectedVersion)
        : NaN;

    try {
      const revision = await deps.transitionOrderRevisionFn(
        env.DB,
        reference,
        revisionId,
        action,
        expectedVersion,
        identity.email,
        {
          inventoryReservations:
            env.ORDER_RESERVATIONS_ENABLED === "true",
        },
      );
      return json({ revision });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "revision_action_failed";
      const status =
        code === "revision_not_found"
          ? 404
          : code === "revision_version_conflict" ||
              code === "reservation_insufficient_stock" ||
              code === "reservation_concurrency_conflict" ||
              code === "reservation_supersede_balance_version_mismatch" ||
              code.startsWith("revision_send_requires") ||
              code.startsWith("revision_accept_requires") ||
              code.startsWith("revision_decline_requires")
            ? 409
            : 400;
      return error(code, status, status === 409 ? "Revision action is no longer valid. Reload and try again." : "Unable to update revision.");
    }
  }

  const messagesMatch = url.pathname.match(
    /^\/admin\/api\/orders\/([^/]+)\/messages$/,
  );
  if (messagesMatch && request.method === "GET") {
    const reference = decodeURIComponent(messagesMatch[1]);
    const messages = await listOrderMessages(env.DB, reference);
    return json({ messages });
  }

  if (messagesMatch && request.method === "POST") {
    const reference = decodeURIComponent(messagesMatch[1]);
    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch (cause) {
      const code =
        cause instanceof Error ? cause.message : "admin_invalid_request";
      return error(
        code,
        code === "admin_payload_too_large" ? 413 : 400,
        "Invalid customer message.",
      );
    }

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return error(
        "customer_message_invalid_request",
        400,
        "Invalid customer message.",
      );
    }

    const input = raw as Record<string, unknown>;
    const kind = String(input.kind ?? "CUSTOM_MESSAGE");
    if (
      !["CUSTOM_MESSAGE", "AVAILABILITY_UPDATE", "PAYMENT_REMINDER"].includes(
        kind,
      )
    ) {
      return error(
        "customer_message_invalid_kind",
        400,
        "Invalid customer message type.",
      );
    }

    const snapshot = await getPaymentNotificationSnapshot(env.DB, reference);
    const detail = await getAdminOrderDetail(env.DB, reference);
    if (!snapshot || !detail) {
      return error("order_not_found", 404, "Order not found.");
    }

    if (
      kind === "PAYMENT_REMINDER" &&
      String(detail.paymentStatus) !== "PAYMENT_REQUESTED"
    ) {
      return error(
        "payment_reminder_not_available",
        409,
        "A payment reminder can only be sent while payment is requested.",
      );
    }

    if (kind === "AVAILABILITY_UPDATE" && !snapshot.revisionNumber) {
      return error(
        "availability_update_requires_revision",
        409,
        "Create and finalize a reviewed version before sending an availability update.",
      );
    }

    let reviewUrl: string | null = null;
    if (
      snapshot.revisionNumber &&
      (kind === "AVAILABILITY_UPDATE" || kind === "PAYMENT_REMINDER")
    ) {
      const review = await deps.createCustomerReviewTokenFn(env.DB, reference);
      reviewUrl =
        url.origin + "/review/" + encodeURIComponent(review.token);
    }

    const defaultSubject =
      kind === "PAYMENT_REMINDER"
        ? "Payment reminder for " + reference
        : kind === "AVAILABILITY_UPDATE"
          ? "Order update for " + reference
          : "Message about order " + reference;
    const defaultBody =
      kind === "PAYMENT_REMINDER"
        ? "This is a reminder that your order has been reviewed and is waiting for payment. Please use the secure link below when you are ready. If you need to change anything, reply to this email."
        : kind === "AVAILABILITY_UPDATE"
          ? "We have reviewed your order request and made an update. Please use the secure link below to review the confirmed version. You can ask us a question from that page if anything needs changing."
          : "";

    try {
      const sent = await sendOwnerCustomerMessage(env, snapshot, {
        kind: kind as
          | "CUSTOM_MESSAGE"
          | "AVAILABILITY_UPDATE"
          | "PAYMENT_REMINDER",
        subject: String(input.subject ?? defaultSubject),
        body: String(input.body ?? defaultBody),
        actorEmail: identity.email,
        reviewUrl,
      });
      const messages = await listOrderMessages(env.DB, reference);
      return json({ sent, messages }, 201);
    } catch (cause) {
      const code =
        cause instanceof Error ? cause.message : "customer_message_failed";
      const status = code === "customer_message_send_failed" ? 502 : 400;
      return error(
        code,
        status,
        status === 502
          ? "The customer message could not be sent."
          : "Invalid customer message.",
      );
    }
  }

  const returnStockMatch = url.pathname.match(
    /^\/admin\/api\/orders\/([^/]+)\/return-stock$/,
  );
  if (returnStockMatch && request.method === "POST") {
    if (env.ORDER_RESERVATIONS_ENABLED !== "true") {
      return error(
        "return_to_stock_unavailable",
        409,
        "Return to stock is not enabled in this environment.",
      );
    }
    const reference = decodeURIComponent(returnStockMatch[1]);
    try {
      const result = await deps.returnConsumedReservationToStockFn(
        env.DB,
        reference,
        identity.email,
      );
      const order = await getAdminOrderDetail(env.DB, reference);
      return json({ result, order });
    } catch (cause) {
      const code =
        cause instanceof Error ? cause.message : "return_to_stock_failed";
      const status =
        code === "return_to_stock_not_available"
          ? 404
          : code === "return_to_stock_requires_refund" ||
              code === "return_to_stock_conflict"
            ? 409
            : 400;
      return error(
        code,
        status,
        code === "return_to_stock_requires_refund"
          ? "Refund the order before returning fulfilled stock."
          : code === "return_to_stock_conflict"
            ? "Stock changed while the return was being recorded. Reload and try again."
            : "Unable to return this order to stock.",
      );
    }
  }

  const refundsMatch = url.pathname.match(
    /^\/admin\/api\/orders\/([^/]+)\/refunds$/,
  );
  if (refundsMatch && request.method === "GET") {
    const reference = decodeURIComponent(refundsMatch[1]);
    const refunds = await deps.getOrderRefundSummaryFn(env.DB, reference);
    return refunds
      ? json({ refunds })
      : error("order_not_found", 404, "Order not found.");
  }

  if (refundsMatch && request.method === "POST") {
    const reference = decodeURIComponent(refundsMatch[1]);
    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch (cause) {
      const code =
        cause instanceof Error ? cause.message : "admin_invalid_request";
      return error(
        code,
        code === "admin_payload_too_large" ? 413 : 400,
        "Invalid refund record.",
      );
    }

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return error("refund_invalid_request", 400, "Invalid refund record.");
    }

    try {
      const summary = await deps.recordManualRefundFn(
        env.DB,
        reference,
        raw as Parameters<typeof recordManualRefund>[2],
        identity.email,
      );

      const newest = summary.idempotentReplay
        ? null
        : summary.refunds.find(
            (refund) => refund.id === summary.recordedRefundId,
          ) ?? summary.refunds[0];
      const snapshot = await getPaymentNotificationSnapshot(env.DB, reference);
      if (snapshot && newest) {
        await notifyRefundRecorded(env, snapshot, {
          refundId: newest.id,
          amountMinor: newest.amountMinor,
          reasonCode: newest.reasonCode,
          refundMethod: newest.refundMethod,
          externalReference: newest.externalReference,
          remainingRefundableMinor: summary.remainingRefundableMinor,
          fullyRefunded: summary.fullyRefunded,
          cancelled: Boolean(
            (raw as Record<string, unknown>).cancelOrder,
          ),
        });
      }

      const order = await getAdminOrderDetail(env.DB, reference);
      return json({ refunds: summary, order });
    } catch (cause) {
      const code =
        cause instanceof Error ? cause.message : "refund_record_failed";
      const status =
        code === "refund_order_not_found"
          ? 404
          : code === "refund_exceeds_remaining_amount" ||
              code === "refund_requires_paid_order" ||
              code === "refund_completed_order_cannot_cancel" ||
              code === "refund_version_conflict"
            ? 409
            : 400;
      const message =
        code === "refund_exceeds_remaining_amount"
          ? "Refund exceeds the amount still refundable."
          : code === "refund_requires_paid_order"
            ? "A refund can only be recorded for a paid order."
            : code === "refund_completed_order_cannot_cancel"
              ? "A completed order can be refunded but its completed history is preserved."
              : code === "refund_version_conflict"
                ? "This order changed while the refund was being recorded. Reload the order and try again."
                : "Unable to record refund.";
      return error(code, status, message);
    }
  }

  const match = url.pathname.match(/^\/admin\/api\/orders\/([^/]+)$/);
  if (match && request.method === "GET") {
    const reference = decodeURIComponent(match[1]);
    const order = await getAdminOrderDetail(env.DB, reference);
    return order ? json({ order }) : error("order_not_found", 404, "Order not found.");
  }

  const actionMatch = url.pathname.match(/^\/admin\/api\/orders\/([^/]+)\/actions$/);
  if (actionMatch && request.method === "POST") {
    const requestOrigin = request.headers.get("origin");
    if (requestOrigin && requestOrigin !== url.origin) {
      return error("admin_origin_forbidden", 403, "Admin request origin is not allowed.");
    }

    const reference = decodeURIComponent(actionMatch[1]);
    if (env.ORDER_RESERVATIONS_ENABLED === "true") {
      await expireDueReservations(env.DB);
    }
    const order = await getAdminOrderState(env.DB, reference);
    if (!order) return error("order_not_found", 404, "Order not found.");

    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "admin_invalid_request";
      return error(code, code === "admin_payload_too_large" ? 413 : 400, "Invalid admin action.");
    }

    try {
      const action = validateAdminOrderAction(order, raw);
      await applyAdminOrderUpdate(
        env.DB,
        order,
        action,
        identity.email,
        {
          inventoryReservations:
            env.ORDER_RESERVATIONS_ENABLED === "true",
        },
      );

      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const actionName = (raw as Record<string, unknown>).action;
        const notificationActions = new Set([
          "send_payment_request",
          "mark_paid",
          "ready_for_collection",
          "mark_shipped",
          "cancel",
          "record_refund",
          "refund_and_cancel",
        ]);
        if (typeof actionName === "string" && notificationActions.has(actionName)) {
          const snapshot = await getPaymentNotificationSnapshot(env.DB, reference);
          if (snapshot) {
            if (actionName === "send_payment_request") {
              if (snapshot.revisionNumber) {
                const review = await deps.createCustomerReviewTokenFn(
                  env.DB,
                  reference,
                );
                await notifyPaymentRequest(env, {
                  ...snapshot,
                  reviewUrl:
                    url.origin +
                    "/review/" +
                    encodeURIComponent(review.token),
                });
              } else {
                await notifyPaymentRequest(env, snapshot);
              }
            } else if (actionName === "mark_paid") {
              await notifyPaymentConfirmed(env, snapshot);
            } else if (actionName === "ready_for_collection") {
              await notifyLifecycleUpdate(env, snapshot, "ready_for_collection");
            } else if (actionName === "mark_shipped") {
              await notifyLifecycleUpdate(env, snapshot, "shipped");
            } else if (actionName === "cancel") {
              await notifyLifecycleUpdate(env, snapshot, "cancelled");
            } else if (actionName === "record_refund") {
              await notifyLifecycleUpdate(env, snapshot, "refunded");
            } else if (actionName === "refund_and_cancel") {
              await notifyLifecycleUpdate(env, snapshot, "refunded_and_cancelled");
            }
          }
        }
      }

      const updated = await getAdminOrderDetail(env.DB, reference);
      return json({ order: updated });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "admin_action_failed";
      const status =
        code.startsWith("admin_transition_not_allowed") ||
        code === "reservation_order_transition_conflict"
          ? 409
          : 400;
      return error(code, status, "This order action is not allowed.");
    }
  }

  return error("not_found", 404, "Not found.");
}
