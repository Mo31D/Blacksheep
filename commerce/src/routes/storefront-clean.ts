import type { D1DatabaseLike } from "../data/d1";
import {
  listPublicCommerceProducts,
  type PublicCommerceProduct,
} from "../data/public-catalog";
import {
  listPublishedStorefrontNodes,
  type StorefrontNodeSnapshot,
} from "../data/storefront-structure";

export interface CleanCollectionEnv {
  DB?: D1DatabaseLike;
  STOREFRONT_CLEAN_COLLECTION_ROUTES_ENABLED?: string;
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

function cleanPath(slug: string): string {
  return "/collections/" + encodeURIComponent(slug);
}

function productUrl(product: PublicCommerceProduct): string {
  if (product.id !== product.productId) {
    return "/products/" + encodeURIComponent(product.slug) + ".html";
  }
  return "/products/" + encodeURIComponent(product.slug);
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

function productCard(product: PublicCommerceProduct): string {
  const href = productUrl(product);
  const image = imageUrl(product.primaryImageUrl);
  const status =
    product.status === "arriving-soon"
      ? "Arriving soon"
      : product.status === "out-of-stock"
        ? "Out of stock"
        : product.status === "not-for-sale"
          ? "Not for sale"
          : "";
  return (
    '<article class="product-card">' +
    '<a class="product-img" href="' +
    esc(href) +
    '">' +
    (image
      ? '<img src="' + esc(image) + '" alt="' + esc(product.name) + '" loading="lazy">'
      : '<span class="product-img--placeholder">Image being added</span>') +
    "</a>" +
    '<div class="product-info">' +
    (product.brand ? '<div class="brand-line">' + esc(product.brand) + "</div>" : "") +
    '<a class="product-title" href="' +
    esc(href) +
    '">' +
    esc(product.name) +
    "</a>" +
    (product.shortDescription
      ? '<p class="product-desc">' + esc(product.shortDescription) + "</p>"
      : "") +
    '<div class="product-buyline"><strong class="product-price">' +
    esc(money(product.priceMinor)) +
    "</strong>" +
    (status ? '<span class="availability-card-label">' + esc(status) + "</span>" : "") +
    "</div></div></article>"
  );
}

export function renderCleanCollectionHtml(input: {
  node: StorefrontNodeSnapshot;
  parent: StorefrontNodeSnapshot | null;
  children: StorefrontNodeSnapshot[];
  products: PublicCommerceProduct[];
}): string {
  const { node, parent, children, products } = input;
  const path = cleanPath(node.slug);
  const canonical = STOREFRONT_ORIGIN + path;
  const description =
    node.shortDescription ||
    "Browse " + node.name + " from The Black Sheep Shop in Ambleside.";
  const itemList = products.map((product, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: STOREFRONT_ORIGIN + productUrl(product),
    name: product.name,
  }));
  const graph = {
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
        "@type": "CollectionPage",
        "@id": canonical + "#webpage",
        url: canonical,
        name: node.name + " | The Black Sheep Shop",
        description,
        isPartOf: { "@id": STOREFRONT_ORIGIN + "/#website" },
        about: { "@id": STOREFRONT_ORIGIN + "/#store" },
        mainEntity: { "@id": canonical + "#items" },
      },
      {
        "@type": "ItemList",
        "@id": canonical + "#items",
        name: node.name,
        numberOfItems: products.length,
        itemListElement: itemList,
      },
    ],
  };
  const childLinks = children
    .map(
      (child) =>
        '<a class="chip" href="' +
        esc(cleanPath(child.slug)) +
        '">' +
        esc(child.name) +
        "</a>",
    )
    .join("");
  const heroImage = imageUrl(node.imageUrl);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(node.name)} | The Black Sheep Shop Ambleside</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#151512">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(node.name)} | The Black Sheep Shop Ambleside">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<link rel="icon" href="/assets/sheep-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css">
<script type="application/ld+json">${jsonEsc(graph)}</script>
</head>
<body class="catalog-body">
<div class="topbar"><div class="wrap"><span>Independent gift &amp; souvenir shop in Ambleside, Lake District</span><span class="right"><a href="/visit.html">Find us in Ambleside</a></span></div></div>
<header class="header"><div class="wrap nav"><a aria-label="The Black Sheep Shop home" class="brand" href="/"><img alt="" class="brand-mark" src="/assets/sheep-icon.png"><span class="brand-type"><strong>The Black Sheep</strong><small>Shop · Ambleside</small></span></a><nav class="menu"><a href="/">Home</a><a href="/gifts.html">Gifts &amp; Souvenirs</a><a href="/icecream.html">Ice Cream</a><a href="/romneys.html">Romney's</a><a href="/hawkshead-relish.html">Hawkshead Relish</a><a href="/all-products.html">Full range</a><a href="/about.html">About</a><a href="/visit.html">Visit</a></nav><a class="nav-cta" href="/gifts.html">Browse gifts</a><button aria-label="Open menu" class="hamb" onclick="toggleMenu()">☰</button></div><nav class="mobile-menu" id="mobileMenu"><a href="/">Home</a><a href="/gifts.html">Gifts &amp; Souvenirs</a><a href="/icecream.html">Ice Cream</a><a href="/romneys.html">Romney's</a><a href="/hawkshead-relish.html">Hawkshead Relish</a><a href="/all-products.html">Full range</a><a href="/about.html">About</a><a href="/visit.html">Visit</a></nav></header>
<main class="catalog-page">
<section class="page-hero"><div class="wrap inner"><div><div class="eyebrow">${esc(parent?.name || "Shop collection")}</div><h1>${esc(node.name)}</h1><p class="lead">${esc(description)}</p>${childLinks ? '<div class="chips">' + childLinks + "</div>" : ""}</div>${heroImage ? '<div class="media"><img src="' + esc(heroImage) + '" alt="' + esc(node.name) + '"></div>' : ""}</div></section>
<section style="padding-top:20px"><div class="wrap"><div class="catalog-intro"><div class="catalog-title-row"><h2>Products</h2><span class="catalog-count">${products.length} ${products.length === 1 ? "product" : "products"}</span></div></div><div class="catalog shopping-catalog gift-grid">${products.map(productCard).join("")}</div></div></section>
</main>
<div aria-hidden="true" class="brand-strip brand-strip-featured"></div>
<footer><div class="wrap"><div class="footer-grid"><div class="footer-brand"><a aria-label="The Black Sheep Shop home" class="footer-wordmark" href="/"><img alt="" class="footer-mark" src="/assets/sheep-icon.png"><span><strong>The Black Sheep</strong><small>Shop · Ambleside</small></span></a><p>Independent gift &amp; souvenir shop in Ambleside, Lake District.</p></div><div class="footer-col"><h4>Shop</h4><a href="/all-products.html">Full range</a><a href="/gifts.html">Gifts &amp; Souvenirs</a><a href="/romneys.html">Romney's</a></div><div class="footer-col"><h4>Find us</h4><a href="/visit.html">2 Lancaster House<br>Lake Road, Ambleside<br>LA22 0AD</a><a href="tel:+447776185647">07776 185647</a></div></div><div class="copyright">© 2026 The Black Sheep Shop. All rights reserved.</div></div></footer>
<script src="/assets/catalog.js"></script>
<script src="/assets/site.js"></script>
</body></html>`;
}

async function allPublicProducts(db: D1DatabaseLike): Promise<PublicCommerceProduct[]> {
  const products: PublicCommerceProduct[] = [];
  let cursor = 0;
  for (let page = 0; page < 20; page += 1) {
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

export async function handleCleanCollectionRequest(
  request: Request,
  env: CleanCollectionEnv,
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

  const url = new URL(request.url);
  const match = url.pathname.match(/^\/collections\/([^/]+)\/?$/);
  if (!match) return new Response("Not found", { status: 404 });

  const slug = decodeURIComponent(match[1]);
  const canonicalPath = cleanPath(slug);

  if (
    url.hostname.toLowerCase() === "www.theblacksheepshop.co.uk" ||
    url.pathname.endsWith("/")
  ) {
    const target = new URL(request.url);
    target.hostname =
      target.hostname.toLowerCase() === "www.theblacksheepshop.co.uk"
        ? "theblacksheepshop.co.uk"
        : target.hostname;
    target.pathname = canonicalPath;
    target.search = "";
    return Response.redirect(target.toString(), 301);
  }

  const nodes = await listPublishedStorefrontNodes(env.DB);
  const node = nodes.find((row) => row.slug === slug);
  if (!node) {
    return new Response(
      '<!doctype html><meta name="robots" content="noindex,follow"><title>Collection not found</title><h1>Collection not found</h1>',
      {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
      },
    );
  }

  if (node.legacyPath) {
    return Response.redirect(STOREFRONT_ORIGIN + node.legacyPath, 301);
  }

  const parent = node.parentNodeId
    ? nodes.find((row) => row.id === node.parentNodeId) ?? null
    : null;
  const children = nodes
    .filter((row) => row.parentNodeId === node.id)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const targetIds = new Set([node.id, ...(node.parentNodeId ? [] : children.map((row) => row.id))]);
  const products = (await allPublicProducts(env.DB))
    .filter((product) =>
      product.storefrontNodeIds.some((id) => targetIds.has(id)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return new Response(
    renderCleanCollectionHtml({ node, parent, children, products }),
    {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
