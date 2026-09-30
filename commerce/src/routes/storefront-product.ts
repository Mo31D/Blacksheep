import type { D1DatabaseLike } from "../data/d1";
import {
  getPublicCommerceProductBySlug,
  type PublicCommerceProduct,
} from "../data/public-catalog";
import {
  listPublishedStorefrontNodes,
  type StorefrontNodeSnapshot,
} from "../data/storefront-structure";
import { renderStorefrontNavigation } from "./storefront-navigation";

export interface CleanProductEnv {
  DB?: D1DatabaseLike;
  STOREFRONT_CLEAN_PRODUCT_ROUTES_ENABLED?: string;
}

const STOREFRONT_ORIGIN = "https://theblacksheepshop.co.uk";
const API_ORIGIN = "https://api.theblacksheepshop.co.uk";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function jsonEsc(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function imageUrl(value: string | null): string | null {
  if (!value) return null;
  if (/^https:\/\//i.test(value)) return value;
  if (value.startsWith("/media/")) return API_ORIGIN + value;
  return STOREFRONT_ORIGIN + (value.startsWith("/") ? value : "/" + value);
}

function money(minor: number | null): string {
  return minor == null ? "Ask in store" : "£" + (minor / 100).toFixed(2);
}

function cleanProductPath(slug: string): string {
  return "/products/" + encodeURIComponent(slug);
}

function collectionPath(node: StorefrontNodeSnapshot | null): string {
  if (!node) return "/all-products.html";
  if (node.legacyPath) return node.legacyPath;
  return "/collections/" + encodeURIComponent(node.slug);
}

function availability(product: PublicCommerceProduct): string {
  if (product.status === "out-of-stock") return "https://schema.org/OutOfStock";
  if (product.status === "arriving-soon") return "https://schema.org/PreOrder";
  if (product.status === "not-for-sale") return "https://schema.org/LimitedAvailability";
  return "https://schema.org/InStock";
}

function availabilityLabel(product: PublicCommerceProduct): string {
  if (product.status === "out-of-stock") return "Out of stock";
  if (product.status === "arriving-soon") return "Awaiting delivery";
  if (product.status === "not-for-sale") return "Not currently for sale";
  return "Available";
}

export function renderCleanProductHtml(input: {
  product: PublicCommerceProduct;
  collection: StorefrontNodeSnapshot | null;
  nodes?: StorefrontNodeSnapshot[];
}): string {
  const { product, collection } = input;
  const navigation = renderStorefrontNavigation(input.nodes ?? (collection ? [collection] : []), collection?.id ?? null);
  const path = cleanProductPath(product.slug);
  const canonical = STOREFRONT_ORIGIN + path;
  const description =
    product.shortDescription ||
    "View " + product.name + " from The Black Sheep Shop in Ambleside.";
  const image = imageUrl(product.primaryImageUrl);
  const backHref = collectionPath(collection);
  const backLabel = collection?.name || "Full range";

  const graph: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Store",
        "@id": STOREFRONT_ORIGIN + "/#store",
        name: "The Black Sheep Shop",
        url: STOREFRONT_ORIGIN + "/",
      },
      {
        "@type": "WebSite",
        "@id": STOREFRONT_ORIGIN + "/#website",
        url: STOREFRONT_ORIGIN + "/",
        name: "The Black Sheep Shop",
      },
      {
        "@type": "WebPage",
        "@id": canonical + "#webpage",
        url: canonical,
        name: product.name + " | The Black Sheep Shop",
        description,
        isPartOf: { "@id": STOREFRONT_ORIGIN + "/#website" },
        about: { "@id": canonical + "#product" },
      },
      {
        "@type": "BreadcrumbList",
        "@id": canonical + "#breadcrumbs",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: STOREFRONT_ORIGIN + "/",
          },
          ...(collection
            ? [
                {
                  "@type": "ListItem",
                  position: 2,
                  name: collection.name,
                  item: STOREFRONT_ORIGIN + collectionPath(collection),
                },
              ]
            : []),
          {
            "@type": "ListItem",
            position: collection ? 3 : 2,
            name: product.name,
            item: canonical,
          },
        ],
      },
      {
        "@type": "Product",
        "@id": canonical + "#product",
        name: product.name,
        description,
        url: canonical,
        ...(image ? { image: [image] } : {}),
        ...(product.brand
          ? { brand: { "@type": "Brand", name: product.brand } }
          : {}),
        ...(product.sku ? { sku: product.sku } : {}),
        ...(product.primaryCategory ? { category: product.primaryCategory } : {}),
        ...(product.priceMinor != null
          ? {
              offers: {
                "@type": "Offer",
                priceCurrency: "GBP",
                price: (product.priceMinor / 100).toFixed(2),
                availability: availability(product),
                url: canonical,
                seller: { "@id": STOREFRONT_ORIGIN + "/#store" },
              },
            }
          : {}),
      },
    ],
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(product.name)} | The Black Sheep Shop Ambleside</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#151512">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="product">
<meta property="og:title" content="${esc(product.name)} | The Black Sheep Shop Ambleside">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
${image ? '<meta property="og:image" content="' + esc(image) + '">' : ""}
<link rel="icon" href="/assets/sheep-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css">
<script type="application/ld+json">${jsonEsc(graph)}</script>
</head>
<body>
<div class="topbar"><div class="wrap"><span>Independent gift &amp; souvenir shop in Ambleside, Lake District</span><span class="right"><a href="/visit.html">Find us in Ambleside</a></span></div></div>
<header class="header"><div class="wrap nav"><a class="brand" href="/" aria-label="The Black Sheep Shop home"><img class="brand-mark" src="/assets/sheep-icon.png" alt=""><span class="brand-type"><strong>The Black Sheep</strong><small>Shop · Ambleside</small></span></a><nav class="menu">${navigation.desktop}</nav><a class="nav-cta" href="${esc(navigation.ctaPath)}">Browse gifts</a><button class="hamb" onclick="toggleMenu()" aria-label="Open menu" aria-expanded="false">☰</button></div><nav class="mobile-menu" id="mobileMenu">${navigation.mobile}</nav></header>
<main>
<nav class="wrap breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">›</span><a href="${esc(backHref)}">${esc(backLabel)}</a><span aria-hidden="true">›</span><span aria-current="page">${esc(product.name)}</span></nav>
<article class="wrap detail-layout product-static">
<div class="detail-media contain">${image ? '<img src="' + esc(image) + '" alt="' + esc(product.name) + '" decoding="async" fetchpriority="high">' : '<div class="product-img--placeholder">Image being added</div>'}</div>
<div class="detail-copy"><div class="eyebrow">${esc(collection?.name || product.primaryCategory || "Product")}</div><h1>${esc(product.name)}</h1><p>${esc(description)}</p>
<div class="info-list">
${product.brand ? '<div class="info-row"><strong>Brand</strong><span>' + esc(product.brand) + "</span></div>" : ""}
<div class="info-row"><strong>Shop price</strong><span>${esc(money(product.priceMinor))}</span></div>
${product.sku ? '<div class="info-row"><strong>Product code</strong><span>' + esc(product.sku) + "</span></div>" : ""}
<div class="info-row"><strong>Availability</strong><span>${esc(availabilityLabel(product))}</span></div>
</div>
<div class="actions">${product.purchasable ? '<button class="btn primary list-detail-add" type="button" onclick="addToBlackSheepList(event,\'' + esc(product.type) + '\',\'' + esc(product.slug) + '\')">Add to my list</button>' : ""}<a class="btn secondary" href="/visit.html">Visit the shop</a><a class="btn secondary" href="${esc(backHref)}">Back to ${esc(backLabel)}</a></div>
</div></article>
</main>
<div class="brand-strip" aria-hidden="true"></div>
<footer><div class="wrap"><div class="footer-grid"><div class="footer-brand"><a class="footer-wordmark" href="/" aria-label="The Black Sheep Shop home"><img class="footer-mark" src="/assets/sheep-icon.png" alt=""><span><strong>The Black Sheep</strong><small>Shop · Ambleside</small></span></a><p>Independent gift &amp; souvenir shop in Ambleside, Lake District.</p></div><div class="footer-col"><h4>Shop</h4><a href="/all-products.html">Full range</a><a href="/gifts.html">Gifts &amp; Souvenirs</a><a href="/romneys.html">Romney's</a></div><div class="footer-col"><h4>Find us</h4><a href="/visit.html">2 Lancaster House<br>Lake Road, Ambleside<br>LA22 0AD</a><a href="tel:+447776185647">07776 185647</a></div></div><div class="copyright">© 2026 The Black Sheep Shop. All rights reserved.</div></div></footer>
<script src="/assets/catalog.js"></script><script src="/assets/site.js"></script>
</body></html>`;
}

export async function handleCleanProductRequest(
  request: Request,
  env: CleanProductEnv,
): Promise<Response> {
  if (env.STOREFRONT_CLEAN_PRODUCT_ROUTES_ENABLED !== "true") {
    return new Response("Not found", { status: 404 });
  }
  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { allow: "GET" },
    });
  }
  if (!env.DB) return new Response("Service unavailable", { status: 503 });

  const url = new URL(request.url);
  const match = url.pathname.match(/^\/products\/([^/.]+)\/?$/);
  if (!match) return new Response("Not found", { status: 404 });

  const slug = decodeURIComponent(match[1]);
  const cleanPath = cleanProductPath(slug);

  if (
    url.hostname.toLowerCase() === "www.theblacksheepshop.co.uk" ||
    url.pathname.endsWith("/")
  ) {
    const target = new URL(request.url);
    target.hostname =
      target.hostname.toLowerCase() === "www.theblacksheepshop.co.uk"
        ? "theblacksheepshop.co.uk"
        : target.hostname;
    target.pathname = cleanPath;
    target.search = "";
    return Response.redirect(target.toString(), 301);
  }

  const product = await getPublicCommerceProductBySlug(env.DB, slug);
  if (!product) {
    return new Response(
      '<!doctype html><meta name="robots" content="noindex,follow"><title>Product not found</title><h1>Product not found</h1>',
      {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
      },
    );
  }

  if (product.id !== product.productId) {
    return Response.redirect(
      STOREFRONT_ORIGIN +
        "/products/" +
        encodeURIComponent(product.slug) +
        ".html",
      301,
    );
  }

  const nodes = await listPublishedStorefrontNodes(env.DB);
  const collection =
    nodes.find((node) => node.id === product.primaryStorefrontNodeId) ?? null;

  return new Response(renderCleanProductHtml({ product, collection, nodes }), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
