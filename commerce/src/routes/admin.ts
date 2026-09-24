import type { D1DatabaseLike } from "../data/d1";
import {
  applyAdminOrderUpdate,
  getAdminOrderDetail,
  getAdminOrderState,
  listAdminOrders,
} from "../data/admin-orders";
import { validateAdminOrderAction } from "../domain/admin-order";
import {
  verifyAdminAccess,
  type AdminAccessEnv,
  type AdminIdentity,
} from "../security/admin-access";
import { adminHtml } from "../admin/ui";

export interface AdminEnv extends AdminAccessEnv {
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

export async function handleAdminRequest(
  request: Request,
  env: AdminEnv,
  dependencies: Partial<AdminDependencies> = {},
): Promise<Response> {
  const deps = { ...defaults, ...dependencies };
  const access = await deps.verifyAccessFn(request, env);
  if (!access.ok || !access.identity) {
    return error(
      access.code ?? "admin_forbidden",
      access.status,
      access.status === 404 ? "Not found." : "Admin access denied.",
    );
  }

  if (!env.DB) return error("database_unavailable", 503, "Order database unavailable.");

  const url = new URL(request.url);
  const identity: AdminIdentity = access.identity;

  if ((url.pathname === "/" || url.pathname === "/admin") && request.method === "GET") {
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

  if (url.pathname === "/api/orders" && request.method === "GET") {
    const status = url.searchParams.get("status");
    const orders = await listAdminOrders(env.DB, status);
    return json({ orders });
  }

  const match = url.pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (match && request.method === "GET") {
    const reference = decodeURIComponent(match[1]);
    const order = await getAdminOrderDetail(env.DB, reference);
    return order ? json({ order }) : error("order_not_found", 404, "Order not found.");
  }

  const actionMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/actions$/);
  if (actionMatch && request.method === "POST") {
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
