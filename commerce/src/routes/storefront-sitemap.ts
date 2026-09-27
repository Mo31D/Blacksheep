import type { D1DatabaseLike } from "../data/d1";
import { listPublishedStorefrontNodes } from "../data/storefront-structure";

export interface DynamicSitemapEnv {
  DB?: D1DatabaseLike;
  STOREFRONT_CLEAN_COLLECTION_ROUTES_ENABLED?: string;
}

const STOREFRONT_ORIGIN = "https://theblacksheepshop.co.uk";

function xml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function handleDynamicSitemapRequest(
  request: Request,
  env: DynamicSitemapEnv,
): Promise<Response> {
  if (env.STOREFRONT_CLEAN_COLLECTION_ROUTES_ENABLED !== "true") {
    return new Response("Not found", { status: 404 });
  }
  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { allow: "GET" },
    });
  }
  if (!env.DB) {
    return new Response("Service unavailable", { status: 503 });
  }

  const nodes = (await listPublishedStorefrontNodes(env.DB))
    .filter((node) => !node.legacyPath)
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );

  const urls = nodes
    .map(
      (node) =>
        "  <url><loc>" +
        xml(
          STOREFRONT_ORIGIN +
            "/collections/" +
            encodeURIComponent(node.slug),
        ) +
        "</loc></url>",
    )
    .join("\n");

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    (urls ? urls + "\n" : "") +
    "</urlset>\n";

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
