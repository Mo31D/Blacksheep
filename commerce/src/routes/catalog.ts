import type { D1DatabaseLike } from "../data/d1";
import {
  getPublicCommerceProduct,
  listPublicCommerceProducts,
} from "../data/public-catalog";

export interface PublicCatalogEnv {
  DB?: D1DatabaseLike;
  D1_PUBLIC_CATALOG_ENABLED?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function handlePublicCatalogRequest(
  request: Request,
  env: PublicCatalogEnv,
): Promise<Response> {
  if (env.D1_PUBLIC_CATALOG_ENABLED !== "true") {
    return json(
      { error: { code: "not_found", message: "Route not found." } },
      404,
    );
  }

  if (request.method !== "GET") {
    return json(
      {
        error: {
          code: "method_not_allowed",
          message: "Method not allowed.",
        },
      },
      405,
    );
  }

  if (!env.DB) {
    return json(
      {
        error: {
          code: "database_unavailable",
          message: "Catalogue service is temporarily unavailable.",
        },
      },
      503,
    );
  }

  const url = new URL(request.url);
  const detail = url.pathname.match(/^\/v1\/catalog\/([^/]+)$/);

  if (detail) {
    const publicId = decodeURIComponent(detail[1]);
    const product = await getPublicCommerceProduct(env.DB, publicId);
    return product
      ? json({ product })
      : json(
          {
            error: {
              code: "product_not_found",
              message: "Product not found.",
            },
          },
          404,
        );
  }

  if (url.pathname !== "/v1/catalog") {
    return json(
      { error: { code: "not_found", message: "Route not found." } },
      404,
    );
  }

  const query = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? "100");
  const cursor = Number(url.searchParams.get("cursor") ?? "0");

  const result = await listPublicCommerceProducts(env.DB, {
    query,
    limit,
    cursor,
  });

  return json(result);
}
