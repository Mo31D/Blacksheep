import type { D1DatabaseLike } from "../data/d1";
import {
  applyAdminOrderUpdate,
  getAdminOrderDetail,
  getAdminOrderState,
  getPaymentNotificationSnapshot,
  listAdminOrders,
} from "../data/admin-orders";
import { validateAdminOrderAction } from "../domain/admin-order";
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

export interface AdminEnv extends AdminAccessEnv, PaymentNotificationEnv {
  DB?: D1DatabaseLike;
}

interface AdminDependencies {
  verifyAccessFn: typeof verifyAdminAccess;
}

const defaults: AdminDependencies = {
  verifyAccessFn: verifyAdminAccess,
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

  // Non-browser clients do not always send Origin/Referer.
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
    request.method === "POST" &&
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
        if (actionName === "send_payment_request" || actionName === "mark_paid") {
          const snapshot = await getPaymentNotificationSnapshot(env.DB, reference);
          if (snapshot) {
            if (actionName === "send_payment_request") {
              await notifyPaymentRequest(env, snapshot);
            } else {
              await notifyPaymentConfirmed(env, snapshot);
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
