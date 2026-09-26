import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function readStaticStorefrontCatalogue() {
  const file = resolve(process.cwd(), "../assets/catalog.js");
  const raw = readFileSync(file, "utf8").trim();
  const prefix = "window.CATALOG=";
  if (!raw.startsWith(prefix)) {
    throw new Error("static_catalog_format_invalid");
  }

  const catalogue = JSON.parse(
    raw.slice(prefix.length).replace(/;$/, ""),
  );
  const products = [];

  for (const section of Object.values(catalogue)) {
    for (const item of section || []) {
      const status =
        item.availabilityStatus ||
        item.stockStatus ||
        "available";
      const hasPrice =
        typeof item.price === "number" &&
        Number.isFinite(item.price);

      let nonPurchasableReason = null;
      if (status === "arriving-soon") {
        nonPurchasableReason = "arriving_soon";
      } else if (status === "out-of-stock") {
        nonPurchasableReason = "out_of_stock";
      } else if (!hasPrice) {
        nonPurchasableReason = "price_unavailable";
      }

      products.push({
        id: item.id,
        slug: item.slug,
        name: item.name,
        type: item.type,
        sku: item.sku ?? null,
        priceMinor: hasPrice ? Math.round(item.price * 100) : null,
        status,
        purchasable: nonPurchasableReason === null,
        nonPurchasableReason,
      });
    }
  }

  return products.sort((a, b) => a.id.localeCompare(b.id));
}

function normalize(product) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    type: product.type,
    sku: product.sku ?? null,
    priceMinor: product.priceMinor ?? null,
    status: product.status,
    purchasable: Boolean(product.purchasable),
    nonPurchasableReason:
      product.nonPurchasableReason ?? null,
  };
}

async function fetchD1Catalogue(endpoint) {
  const url = new URL("/v1/catalog", endpoint);
  url.searchParams.set("limit", "200");
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      `public_catalog_fetch_failed:${response.status}:${await response.text()}`,
    );
  }
  const payload = await response.json();
  if (!Array.isArray(payload.products)) {
    throw new Error("public_catalog_payload_invalid");
  }
  return payload.products;
}

function compare(staticProducts, d1Products) {
  const staticById = new Map(
    staticProducts.map((product) => [
      product.id,
      normalize(product),
    ]),
  );
  const d1ById = new Map(
    d1Products.map((product) => [
      product.id,
      normalize(product),
    ]),
  );
  const ids = [
    ...new Set([
      ...staticById.keys(),
      ...d1ById.keys(),
    ]),
  ].sort();
  const fields = [
    "slug",
    "name",
    "type",
    "sku",
    "priceMinor",
    "status",
    "purchasable",
    "nonPurchasableReason",
  ];

  const mismatches = [];
  const missingInD1 = [];
  const extraInD1 = [];

  for (const id of ids) {
    const expected = staticById.get(id);
    const actual = d1ById.get(id);
    if (!expected) {
      extraInD1.push(id);
      continue;
    }
    if (!actual) {
      missingInD1.push(id);
      continue;
    }
    for (const field of fields) {
      if (expected[field] !== actual[field]) {
        mismatches.push({
          id,
          field,
          static: expected[field],
          d1: actual[field],
        });
      }
    }
  }

  return {
    staticCount: staticProducts.length,
    d1Count: d1Products.length,
    missingInD1,
    extraInD1,
    mismatches,
    passed:
      missingInD1.length === 0 &&
      extraInD1.length === 0 &&
      mismatches.length === 0,
  };
}

const endpoint =
  arg("--endpoint") ||
  process.env.PHASE6_PUBLIC_CATALOG_ENDPOINT;
if (!endpoint) {
  throw new Error(
    "Provide --endpoint or PHASE6_PUBLIC_CATALOG_ENDPOINT.",
  );
}

const staticProducts = readStaticStorefrontCatalogue();
const d1 = await fetchD1Catalogue(endpoint);
const report = compare(staticProducts, d1);

const output = arg("--output");
if (output) {
  writeFileSync(
    resolve(process.cwd(), output),
    JSON.stringify(report, null, 2) + "\n",
  );
}

console.log(JSON.stringify(report, null, 2));

if (!report.passed) {
  process.exitCode = 1;
}
