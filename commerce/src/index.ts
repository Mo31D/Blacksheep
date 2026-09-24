import type { D1DatabaseLike } from "./data/d1";
import { handleCreateOrder, type RateLimiterLike } from "./routes/orders";

interface Env {
  ENVIRONMENT?: string;
  ALLOWED_ORIGINS?: string;
  DB?: D1DatabaseLike;
  ORDER_RATE_LIMITER?: RateLimiterLike;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_ALLOWED_HOSTNAMES?: string;
  TURNSTILE_EXPECTED_ACTION?: string;
}

const SERVICE = "black-sheep-commerce-api";

function json(
  body: unknown,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function allowedOrigins(env: Env): Set<string> {
  return new Set(
    (env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function applyCors(request: Request, response: Response, env: Env): Response {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins(env).has(origin)) return response;

  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-allow-headers", "content-type,idempotency-key");
  headers.set("access-control-max-age", "86400");
  headers.append("vary", "Origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function preflight(request: Request, env: Env): Response {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins(env).has(origin)) {
    return json(
      { error: { code: "origin_not_allowed", message: "Origin is not allowed." } },
      { status: 403 },
    );
  }

  return applyCors(request, new Response(null, { status: 204 }), env);
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") return preflight(request, env);

  if (url.pathname === "/health") {
    if (request.method !== "GET") {
      return json(
        { error: { code: "method_not_allowed", message: "Method not allowed." } },
        { status: 405, headers: { allow: "GET, OPTIONS" } },
      );
    }

    return json({
      service: SERVICE,
      status: "ok",
      environment: env.ENVIRONMENT ?? "unknown",
      database: env.DB ? "bound" : "unbound",
    });
  }

  if (url.pathname === "/v1/orders") {
    if (request.method !== "POST") {
      return json(
        { error: { code: "method_not_allowed", message: "Method not allowed." } },
        { status: 405, headers: { allow: "POST, OPTIONS" } },
      );
    }
    return handleCreateOrder(request, env);
  }

  return json(
    { error: { code: "not_found", message: "Route not found." } },
    { status: 404 },
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const response = await route(request, env);
      return applyCors(request, response, env);
    } catch {
      return applyCors(
        request,
        json(
          { error: { code: "internal_error", message: "Unexpected server error." } },
          { status: 500 },
        ),
        env,
      );
    }
  },
};
