import type { D1DatabaseLike } from "../data/d1";
import {
  applyAdminOrderUpdate,
  getAdminOrderDetail,
  getAdminOrderState,
  getAdminReports,
  getPaymentNotificationSnapshot,
  listAdminOrders,
} from "../data/admin-orders";
import { validateAdminOrderAction } from "../domain/admin-order";
import { listPurchasableProducts } from "../domain/catalog";
import {
  addCatalogItemToDraftRevision,
  createDraftRevisionFromOriginal,
  getOrderRevisionDetail,
  listOrderRevisions,
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

export interface AdminEnv extends AdminAccessEnv, PaymentNotificationEnv {
  DB?: D1DatabaseLike;
}

interface AdminDependencies {
  verifyAccessFn: typeof verifyAdminAccess;
  listOrderRevisionsFn: typeof listOrderRevisions;
  createDraftRevisionFromOriginalFn: typeof createDraftRevisionFromOriginal;
  getOrderRevisionDetailFn: typeof getOrderRevisionDetail;
  updateDraftRevisionFn: typeof updateDraftRevision;
  addCatalogItemToDraftRevisionFn: typeof addCatalogItemToDraftRevision;
  substituteDraftRevisionLineFn: typeof substituteDraftRevisionLine;
  transitionOrderRevisionFn: typeof transitionOrderRevision;
}

const defaults: AdminDependencies = {
  verifyAccessFn: verifyAdminAccess,
  listOrderRevisionsFn: listOrderRevisions,
  createDraftRevisionFromOriginalFn: createDraftRevisionFromOriginal,
  getOrderRevisionDetailFn: getOrderRevisionDetail,
  updateDraftRevisionFn: updateDraftRevision,
  addCatalogItemToDraftRevisionFn: addCatalogItemToDraftRevision,
  substituteDraftRevisionLineFn: substituteDraftRevisionLine,
  transitionOrderRevisionFn: transitionOrderRevision,
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
    return new Response(adminHtml(identity.email), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
        "content-security-policy":
          "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      },
    });
  }

  if (url.pathname === "/admin/api/orders" && request.method === "GET") {
    const status = url.searchParams.get("status");
    const orders = await listAdminOrders(env.DB, status);
    return json({ orders });
  }

  if (url.pathname === "/admin/api/reports" && request.method === "GET") {
    const days = Number(url.searchParams.get("days") ?? "30");
    const reports = await getAdminReports(env.DB, Number.isFinite(days) ? days : 30);
    return json(reports);
  }

  if (url.pathname === "/admin/api/catalog" && request.method === "GET") {
    const query = url.searchParams.get("q") ?? "";
    const products = listPurchasableProducts(query, 60).map((product) => ({
      id: product.id,
      sku: product.sku,
      slug: product.slug,
      name: product.name,
      type: product.type,
      priceMinor: product.priceMinor,
    }));
    return json({ products });
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
    return revision
      ? json({ revision })
      : error("revision_not_found", 404, "Revision not found.");
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
      );
      return json({ revision });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "revision_action_failed";
      const status =
        code === "revision_not_found"
          ? 404
          : code === "revision_version_conflict" ||
              code.startsWith("revision_send_requires") ||
              code.startsWith("revision_accept_requires") ||
              code.startsWith("revision_decline_requires")
            ? 409
            : 400;
      return error(code, status, status === 409 ? "Revision action is no longer valid. Reload and try again." : "Unable to update revision.");
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
      await applyAdminOrderUpdate(env.DB, order, action, identity.email);

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
              await notifyPaymentRequest(env, snapshot);
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
      const status = code.startsWith("admin_transition_not_allowed") ? 409 : 400;
      return error(code, status, "This order action is not allowed.");
    }
  }

  return error("not_found", 404, "Not found.");
}
