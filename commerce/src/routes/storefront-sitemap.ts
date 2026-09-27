import type { D1DatabaseLike } from "../data/d1";
import {
  listPublicCommerceProducts,
  type PublicCommerceProduct,
} from "../data/public-catalog";
import { listPublishedStorefrontNodes } from "../data/storefront-structure";

export interface DynamicSitemapEnv {
  DB?: D1DatabaseLike;
  STOREFRONT_CLEAN_COLLECTION_ROUTES_ENABLED?: string;
}

const STOREFRONT_ORIGIN = "https://theblacksheepshop.co.uk";

const CORE_PATHS = [
  "/",
  "/all-products.html",
  "/about.html",
  "/visit.html",
  "/privacy.html",
  "/delivery-returns.html",
  "/terms.html",
];

function xml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function allPublishedProducts(
  db: D1DatabaseLike,
): Promise<PublicCommerceProduct[]> {
  const products: PublicCommerceProduct[] = [];
  let cursor = 0;

  for (let page = 0; page < 50; page += 1) {
    const result = await listPublicCommerceProducts(db, {
      limit: 200,
      cursor,
    });
    products.push(...result.products);
    if (result.nextCursor == null) break;
    cursor = result.nextCursor;
  }

  return products;
}

function productCanonical(product: PublicCommerceProduct): string | null {
  // Legacy/imported products already have indexed .html pages. Preserve those
  // canonicals during CARD 12 so Google equity is not moved unnecessarily.
  if (product.id !== product.productId) {
    return "/products/" + encodeURIComponent(product.slug) + ".html";
  }

  // Admin-native products use the clean D1 route. This route remains staged
  // until the production clean-product cutover is independently proven.
  return "/products/" + encodeURIComponent(product.slug);
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

  const [nodes, products] = await Promise.all([
    listPublishedStorefrontNodes(env.DB),
    allPublishedProducts(env.DB),
  ]);

  const paths = new Set<string>(CORE_PATHS);

  for (const node of nodes) {
    paths.add(
      node.legacyPath ||
        "/collections/" + encodeURIComponent(node.slug),
    );
  }

  for (const product of products) {
    const path = productCanonical(product);
    if (path) paths.add(path);
  }

  const ordered = [...paths].sort((a, b) => {
    const aCore = CORE_PATHS.indexOf(a);
    const bCore = CORE_PATHS.indexOf(b);
    if (aCore >= 0 || bCore >= 0) {
      if (aCore >= 0 && bCore >= 0) return aCore - bCore;
      return aCore >= 0 ? -1 : 1;
    }
    return a.localeCompare(b);
  });

  const urls = ordered
    .map(
      (path) =>
        "  <url><loc>" +
        xml(STOREFRONT_ORIGIN + path) +
        "</loc></url>",
    )
    .join("\n");

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls +
    "\n</urlset>\n";

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
