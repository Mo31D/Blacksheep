import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const arg = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

const catalogPath = arg("--catalog");
const manifestPath = arg("--manifest");
const outDirArg = arg("--out-dir");
const reportPath = arg("--report-out");
const requireBaselineParity = args.includes("--require-baseline-parity");

if (!catalogPath || !manifestPath || !outDirArg) {
  throw new Error("Missing --catalog, --manifest or --out-dir.");
}

const repoRoot = resolve(process.cwd(), "..");
const outDir = resolve(process.cwd(), outDirArg);
const base = "https://theblacksheepshop.co.uk";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function xml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function money(value) {
  return typeof value === "number" ? "£" + value.toFixed(2) : null;
}

function parseCatalogue(path) {
  const raw = readFileSync(resolve(process.cwd(), path), "utf8").trim();
  return JSON.parse(raw.replace(/^window\.CATALOG=/, "").replace(/;$/, ""));
}

function absoluteImage(item) {
  if (!item.img) return null;
  if (/^https?:\/\//i.test(item.img)) return item.img;
  if (String(item.img).startsWith("/")) return base + item.img;
  return base + "/images/" + item.img;
}

function pageImage(item) {
  if (!item.img) return null;
  if (/^https?:\/\//i.test(item.img) || String(item.img).startsWith("/")) {
    return item.img;
  }
  return "../images/" + item.img;
}

function availability(item) {
  if (item.availabilityStatus === "arriving-soon") {
    return { code: "arriving-soon", label: "Arriving soon" };
  }
  if (item.stockStatus === "out-of-stock") {
    return { code: "out-of-stock", label: "Out of stock" };
  }
  if (item.sellStatus === "NOT_FOR_SALE") {
    return { code: "not-for-sale", label: "Not available to order" };
  }
  if (typeof item.price !== "number" || !Number.isFinite(item.price)) {
    return { code: "price-unavailable", label: "Price not confirmed" };
  }
  if (item.onlineOrderingEnabled === false) {
    return { code: "not-online", label: "Not available to order online" };
  }
  return { code: "available", label: null };
}

function schemaOffer(item) {
  if (typeof item.price !== "number" || !Number.isFinite(item.price)) {
    return null;
  }
  if (item.sellStatus === "NOT_FOR_SALE") return null;
  if (item.onlineOrderingEnabled === false) return null;

  let availabilityUrl = "https://schema.org/InStock";
  if (item.availabilityStatus === "arriving-soon") {
    availabilityUrl = "https://schema.org/PreOrder";
  } else if (item.stockStatus === "out-of-stock") {
    availabilityUrl = "https://schema.org/OutOfStock";
  }

  return {
    "@type": "Offer",
    priceCurrency: "GBP",
    price: item.price.toFixed(2),
    availability: availabilityUrl,
    url: base + "/products/" + item.slug + ".html",
    seller: { "@id": base + "/#store" },
  };
}

function regexEscape(value) {
  return String(value).replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");
}

function setMeta(html, attr, key, next) {
  const re = new RegExp(
    "<meta\\s+([^>]*" + attr + "=[\"']" + regexEscape(key) + "[\"'][^>]*)>",
    "i",
  );
  if (!re.test(html)) return html;
  return html.replace(re, (tag) => {
    if (/content=["'][^"']*["']/i.test(tag)) {
      return tag.replace(/content=["'][^"']*["']/i, 'content="' + esc(next) + '"');
    }
    return tag.replace(/>$/, ' content="' + esc(next) + '">');
  });
}

function setCanonical(html, href) {
  const re = /<link\s+[^>]*rel=["']canonical["'][^>]*>/i;
  if (!re.test(html)) return html;
  return html.replace(re, (tag) =>
    tag.replace(/href=["'][^"']*["']/i, 'href="' + esc(href) + '"'),
  );
}

function setInfoRow(html, labels, next) {
  if (next == null) return html;
  const pattern = labels.map(regexEscape).join("|");
  const re = new RegExp(
    '(<div class="info-row[^"]*"[^>]*>\\s*<strong>(?:' +
      pattern +
      ')<\\/strong>\\s*<span>)[\\s\\S]*?(<\\/span>\\s*<\\/div>)',
    "i",
  );
  return html.replace(re, "$1" + esc(next) + "$2");
}

function patchPrimaryImage(html, item) {
  const src = pageImage(item);
  if (!src) return html;
  const mediaRe = /(<div class="detail-media[^"]*"[^>]*>)([\s\S]*?)(<\/div>)/i;
  return html.replace(mediaRe, (_, open, inner, close) => {
    const imageRe = /<img\b[^>]*>/i;
    if (!imageRe.test(inner)) return open + inner + close;
    const next = inner.replace(imageRe, (tag) => {
      let updated = /\bsrc=["'][^"']*["']/i.test(tag)
        ? tag.replace(/\bsrc=["'][^"']*["']/i, 'src="' + esc(src) + '"')
        : tag.replace(/<img/i, '<img src="' + esc(src) + '"');
      const alt = item.gallery?.[0]?.alt || item.official?.imageAlt || item.name;
      updated = /\balt=["'][^"']*["']/i.test(updated)
        ? updated.replace(/\balt=["'][^"']*["']/i, 'alt="' + esc(alt) + '"')
        : updated.replace(/<img/i, '<img alt="' + esc(alt) + '"');
      return updated;
    });
    return open + next + close;
  });
}

function patchJsonLd(html, item, publication) {
  const url = base + "/products/" + item.slug + ".html";
  const images = (
    Array.isArray(item.gallery) && item.gallery.length
      ? item.gallery.map((entry) =>
          /^https?:\/\//i.test(entry.src)
            ? entry.src
            : base + "/images/" + entry.src,
        )
      : absoluteImage(item)
        ? [absoluteImage(item)]
        : []
  ).filter(Boolean);

  return html.replace(
    /(<script[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
    (_, open, body, close) => {
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        return open + body + close;
      }

      const graph = Array.isArray(data?.["@graph"]) ? data["@graph"] : [];
      for (const node of graph) {
        const type = node?.["@type"];
        if (type === "WebPage") {
          node["@id"] = url + "#webpage";
          node.url = url;
          node.name = publication.seoTitle || item.name + " | The Black Sheep Shop";
          node.description = publication.seoDescription || item.desc || "";
          node.about = { "@id": url + "#product" };
          if (images[0]) {
            node.primaryImageOfPage = { "@type": "ImageObject", url: images[0] };
          } else {
            delete node.primaryImageOfPage;
          }
        } else if (type === "BreadcrumbList") {
          node["@id"] = url + "#breadcrumbs";
          const list = Array.isArray(node.itemListElement) ? node.itemListElement : [];
          if (list.length) {
            list[list.length - 1].name = item.name;
            list[list.length - 1].item = url;
          }
        } else if (type === "Product") {
          node["@id"] = url + "#product";
          node.name = item.name;
          node.description = item.desc || "";
          node.url = url;
          if (images.length) node.image = images;
          else delete node.image;
          if (item.brand) node.brand = { "@type": "Brand", name: item.brand };
          else delete node.brand;
          if (item.sku) node.sku = String(item.sku);
          else delete node.sku;
          node.category = item.label || item.category || item.type;
          const priceText = money(item.price);
          if (Array.isArray(node.additionalProperty) && priceText) {
            for (const prop of node.additionalProperty) {
              if (/price/i.test(String(prop?.name || ""))) prop.value = priceText;
            }
          }
          const offer = schemaOffer(item);
          if (offer) node.offers = offer;
          else delete node.offers;
        }
      }
      return open + JSON.stringify(data).replace(/</g, "\\u003c") + close;
    },
  );
}

function patchDetailOrderButton(html, item) {
  const state = availability(item);
  const purchasable = state.code === "available";
  return html.replace(
    /<button\b([^>]*\blist-detail-add\b[^>]*)>([\s\S]*?)<\/button>/i,
    (_, attrs, body) => {
      let next = attrs
        .replace(/\sdisabled(?:=["'][^"']*["'])?/gi, "")
        .replace(/\saria-disabled=["'][^"']*["']/gi, "");
      if (purchasable) {
        return "<button" + next + ">" + body + "</button>";
      }
      next += ' disabled aria-disabled="true"';
      return (
        "<button" +
        next +
        ">" +
        esc(state.label || "Not available to order") +
        "</button>"
      );
    },
  );
}

function patchExistingPage(source, item, publication) {
  const url = base + "/products/" + item.slug + ".html";
  const title = publication.seoTitle || item.name + " | The Black Sheep Shop Ambleside";
  let html = source;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, "<title>" + esc(title) + "</title>");
  html = setMeta(html, "name", "description", publication.seoDescription || item.desc || "");
  html = setCanonical(html, url);
  html = setMeta(html, "property", "og:title", title);
  html = setMeta(html, "property", "og:description", publication.seoDescription || item.desc || "");
  html = setMeta(html, "property", "og:url", url);
  const image = absoluteImage(item);
  if (image) html = setMeta(html, "property", "og:image", image);

  html = html.replace(/<h1>[\s\S]*?<\/h1>/i, "<h1>" + esc(item.name) + "</h1>");

  if (/<p class="romneys-intro">/i.test(html)) {
    html = html.replace(
      /<p class="romneys-intro">[\s\S]*?<\/p>/i,
      '<p class="romneys-intro">' + esc(item.desc || "") + "</p>",
    );
  } else {
    html = html.replace(
      /(<div class="detail-copy[^"]*"[^>]*>[\s\S]*?<h1>[\s\S]*?<\/h1>)([\s\S]*?)(<p(?:\s+class="[^"]*")?>)[\s\S]*?(<\/p>)/i,
      "$1$2$3" + esc(item.desc || "") + "$4",
    );
  }

  const priceText = money(item.price);
  if (/<div class="romneys-price">/i.test(html)) {
    html = priceText
      ? html.replace(
          /<div class="romneys-price">[\s\S]*?<\/div>/i,
          '<div class="romneys-price">' + esc(priceText) + "</div>",
        )
      : html.replace(/<div class="romneys-price">[\s\S]*?<\/div>/i, "");
  }

  html = setInfoRow(html, ["Brand"], item.brand || "");
  if (priceText) {
    html = setInfoRow(html, ["Black Sheep price", "Shop price", "Price"], priceText);
  }
  if (item.sku) html = setInfoRow(html, ["Product code", "SKU"], item.sku);

  const state = availability(item);
  if (state.label) html = setInfoRow(html, ["Availability"], state.label);

  html = patchPrimaryImage(html, item);
  html = html.replace(
    /addToBlackSheepList\(event,\s*["'][^"']+["'],\s*["'][^"']+["']\)/,
    'addToBlackSheepList(event,"' + item.type + '","' + item.slug + '")',
  );
  html = patchDetailOrderButton(html, item);
  html = patchJsonLd(html, item, publication);
  return html;
}

function genericPage(item, publication) {
  const url = base + "/products/" + item.slug + ".html";
  const title = publication.seoTitle || item.name + " | The Black Sheep Shop Ambleside";
  const description = publication.seoDescription || item.desc || "";
  const image = absoluteImage(item);
  const imageSrc = pageImage(item);
  const priceText = money(item.price);
  const state = availability(item);

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Store", "@id": base + "/#store", name: "The Black Sheep Shop", url: base + "/" },
      { "@type": "WebSite", "@id": base + "/#website", url: base + "/", name: "The Black Sheep Shop" },
      {
        "@type": "WebPage",
        "@id": url + "#webpage",
        url,
        name: title,
        description,
        about: { "@id": url + "#product" },
      },
      {
        "@type": "BreadcrumbList",
        "@id": url + "#breadcrumbs",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: base + "/" },
          { "@type": "ListItem", position: 2, name: "Full range", item: base + "/all-products.html" },
          { "@type": "ListItem", position: 3, name: item.name, item: url },
        ],
      },
      {
        "@type": "Product",
        "@id": url + "#product",
        name: item.name,
        description,
        url,
        ...(image ? { image: [image] } : {}),
        ...(item.brand ? { brand: { "@type": "Brand", name: item.brand } } : {}),
        ...(item.sku ? { sku: String(item.sku) } : {}),
        category: item.label || item.category || item.type,
        ...(schemaOffer(item) ? { offers: schemaOffer(item) } : {}),
      },
    ],
  };

  const facts = [
    item.brand
      ? '<div class="info-row"><strong>Brand</strong><span>' + esc(item.brand) + "</span></div>"
      : "",
    priceText
      ? '<div class="info-row"><strong>Shop price</strong><span>' + esc(priceText) + "</span></div>"
      : "",
    item.sku
      ? '<div class="info-row"><strong>Product code</strong><span>' + esc(item.sku) + "</span></div>"
      : "",
    '<div class="info-row"><strong>Availability</strong><span>' +
      esc(state.label || "Available to order") +
      "</span></div>",
  ].join("");

  const media = imageSrc
    ? '<div class="detail-media ' +
      esc(item.imageFit || "contain") +
      '"><img src="' +
      esc(imageSrc) +
      '" alt="' +
      esc(item.gallery?.[0]?.alt || item.official?.imageAlt || item.name) +
      '" decoding="async" fetchpriority="high"></div>'
    : '<div class="detail-media contain product-img--placeholder"><span class="product-placeholder-media"><strong>Image coming soon</strong></span></div>';

  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>" + esc(title) + "</title>" +
    '<meta name="description" content="' + esc(description) + '">' +
    '<meta name="robots" content="index,follow,max-image-preview:large">' +
    '<meta name="theme-color" content="#151512">' +
    '<link rel="canonical" href="' + esc(url) + '">' +
    '<meta property="og:type" content="product">' +
    '<meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(description) + '">' +
    '<meta property="og:url" content="' + esc(url) + '">' +
    (image ? '<meta property="og:image" content="' + esc(image) + '">' : "") +
    '<meta name="twitter:card" content="' + (image ? "summary_large_image" : "summary") + '">' +
    '<link rel="icon" href="../assets/sheep-icon.png">' +
    '<link rel="stylesheet" href="../assets/style.css">' +
    '<script type="application/ld+json">' +
    JSON.stringify(schema).replace(/</g, "\\u003c") +
    "</script></head><body>" +
    '<header class="header"><div class="wrap nav"><a class="brand" href="/" aria-label="The Black Sheep Shop home">' +
    '<img class="brand-mark" src="../assets/sheep-icon.png" alt=""><span class="brand-type"><strong>The Black Sheep</strong><small>Shop · Ambleside</small></span></a>' +
    '<nav class="menu"><a href="/">Home</a><a href="/gifts.html">Gifts &amp; Souvenirs</a><a href="/icecream.html">Ice Cream</a><a href="/romneys.html">Romney\'s</a><a href="/hawkshead-relish.html">Hawkshead Relish</a><a href="/all-products.html">Full range</a><a href="/about.html">About</a><a href="/visit.html">Visit</a></nav></div></header>' +
    '<main><nav class="wrap breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">›</span><a href="/all-products.html">Full range</a><span aria-hidden="true">›</span><span aria-current="page">' +
    esc(item.name) +
    '</span></nav><article class="wrap detail-layout product-static">' +
    media +
    '<div class="detail-copy"><div class="eyebrow">' +
    esc(item.label || item.type) +
    "</div><h1>" +
    esc(item.name) +
    "</h1><p>" +
    esc(item.desc || "") +
    '</p><div class="info-list">' +
    facts +
    '</div><div class="actions"><button class="btn primary list-detail-add" type="button" onclick=\'addToBlackSheepList(event,"' +
    esc(item.type) +
    '","' +
    esc(item.slug) +
    '")\'' +
    (state.code === "available" ? "" : ' disabled aria-disabled="true"') +
    '>' +
    esc(state.code === "available" ? "Add to basket" : state.label || "Not available to order") +
    '</button><a class="btn secondary" href="/visit.html">Visit the shop</a><a class="btn secondary" href="/all-products.html">Back to full range</a></div></div></article></main>' +
    '<script src="../assets/catalog.js"></script><script src="../assets/site.js"></script></body></html>'
  );
}

function pageProblems(html, item) {
  const problems = [];
  const url = base + "/products/" + item.slug + ".html";
  if (!html.includes('<link rel="canonical" href="' + url + '">')) problems.push("canonical");
  if (!html.includes("<h1>" + esc(item.name) + "</h1>")) problems.push("h1");
  if (!html.includes('name="description" content="' + esc(item.desc || "") + '"')) {
    problems.push("meta_description");
  }

  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let product = null;
  for (const match of blocks) {
    try {
      const data = JSON.parse(match[1]);
      const graph = Array.isArray(data?.["@graph"]) ? data["@graph"] : [];
      product = graph.find((node) => node?.["@type"] === "Product") || product;
    } catch {
      problems.push("invalid_jsonld");
    }
  }
  if (!product) problems.push("product_schema");
  else {
    if (product.name !== item.name) problems.push("schema_name");
    if (product.url !== url) problems.push("schema_url");
    if ((product.sku ?? null) !== (item.sku ?? null)) problems.push("schema_sku");
    const expectedOffer = schemaOffer(item);
    if (!expectedOffer) {
      if (product.offers != null) problems.push("schema_offer_should_be_absent");
    } else {
      const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
      if (!offer) problems.push("schema_offer_missing");
      else {
        if (String(offer.priceCurrency || "") !== "GBP") problems.push("schema_offer_currency");
        if (String(offer.price || "") !== expectedOffer.price) problems.push("schema_offer_price");
        if (String(offer.availability || "") !== expectedOffer.availability) problems.push("schema_offer_availability");
        if (String(offer.url || "") !== expectedOffer.url) problems.push("schema_offer_url");
      }
    }
    const detailButton =
      html.match(/<button\b[^>]*\blist-detail-add\b[^>]*>/i)?.[0] || "";
    const shouldDisable = availability(item).code !== "available";
    const isDisabled = /\sdisabled(?:\s|=|>)/i.test(detailButton);
    if (shouldDisable !== isDisabled) problems.push("static_order_button_state");
  }
  return problems;
}

const catalog = parseCatalogue(catalogPath);
const manifest = JSON.parse(readFileSync(resolve(process.cwd(), manifestPath), "utf8"));
const publicationById = new Map(manifest.products.map((entry) => [entry.id, entry.publication]));
const items = Object.values(catalog).flat();

mkdirSync(outDir, { recursive: true });
mkdirSync(resolve(outDir, "assets"), { recursive: true });
mkdirSync(resolve(outDir, "products"), { recursive: true });
cpSync(resolve(process.cwd(), catalogPath), resolve(outDir, "assets/catalog.js"));

const coreMismatches = [];
const specialistDetailRegressions = [];
let existingTemplates = 0;
let genericPages = 0;

for (const item of items) {
  const publication = publicationById.get(item.id);
  if (!publication) {
    coreMismatches.push({ id: item.id, problems: ["manifest_missing"] });
    continue;
  }

  const sourcePath = resolve(repoRoot, "products", item.slug + ".html");
  let html;
  if (existsSync(sourcePath)) {
    existingTemplates += 1;
    const source = readFileSync(sourcePath, "utf8");
    const beforeDetails = (source.match(/<details\b/gi) || []).length;
    html = patchExistingPage(source, item, publication);
    const afterDetails = (html.match(/<details\b/gi) || []).length;
    if (beforeDetails !== afterDetails) {
      specialistDetailRegressions.push({
        id: item.id,
        beforeDetails,
        afterDetails,
      });
    }
  } else {
    genericPages += 1;
    html = genericPage(item, publication);
  }

  const problems = pageProblems(html, item);
  if (problems.length) coreMismatches.push({ id: item.id, problems });
  writeFileSync(resolve(outDir, "products", item.slug + ".html"), html, "utf8");
}

const sitemapSource = readFileSync(resolve(repoRoot, "sitemap.xml"), "utf8");
const existingBlocks = sitemapSource.match(/<url>[\s\S]*?<\/url>/g) || [];
const nonProductBlocks = existingBlocks.filter((block) => !/<loc>[^<]*\/products\//.test(block));
const opening = sitemapSource.slice(0, sitemapSource.indexOf("<url>"));

const productBlocks = items.map((item) => {
  const publication = publicationById.get(item.id);
  const lastmod = String(publication?.productUpdatedAt || "").slice(0, 10);
  const image = absoluteImage(item);
  return (
    "<url><loc>" +
    xml(base + "/products/" + item.slug + ".html") +
    "</loc>" +
    (lastmod ? "<lastmod>" + xml(lastmod) + "</lastmod>" : "") +
    (image
      ? "<image:image><image:loc>" +
        xml(image) +
        "</image:loc><image:title>" +
        xml(item.name) +
        "</image:title></image:image>"
      : "") +
    "</url>"
  );
});

const sitemap = opening + [...nonProductBlocks, ...productBlocks].join("\n  ") + "\n</urlset>\n";
writeFileSync(resolve(outDir, "sitemap.xml"), sitemap, "utf8");

const report = {
  ok:
    coreMismatches.length === 0 &&
    specialistDetailRegressions.length === 0 &&
    items.length === manifest.products.length,
  candidateProducts: items.length,
  manifestProducts: manifest.products.length,
  productPages: items.length,
  existingTemplates,
  genericPages,
  specialistDetailRegressions,
  coreMismatches,
  sitemapNonProductUrls: nonProductBlocks.length,
  sitemapProductUrls: productBlocks.length,
};

if (reportPath) {
  writeFileSync(resolve(process.cwd(), reportPath), JSON.stringify(report, null, 2) + "\n", "utf8");
}
console.log(JSON.stringify(report, null, 2));
if (requireBaselineParity && !report.ok) process.exit(1);
