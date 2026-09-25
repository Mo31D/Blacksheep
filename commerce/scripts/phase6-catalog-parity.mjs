import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function readGeneratedCatalogue() {
  const file = resolve(process.cwd(), "src/generated/catalog.ts");
  const source = readFileSync(file, "utf8");
  const marker = "export const COMMERCE_CATALOG = ";
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error("generated_catalog_marker_missing");
  }
  const start = source.indexOf("[", markerIndex);
  const end = source.lastIndexOf("] as const satisfies");
  if (start < 0 || end < start) {
    throw new Error("generated_catalog_array_missing");
  }
  return JSON.parse(source.slice(start, end + 1));
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
    nonPurchasableReason: product.nonPurchasableReason ?? null,
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
  const staticById = new Map(staticProducts.map((p) => [p.id, normalize(p)]));
  const d1ById = new Map(d1Products.map((p) => [p.id, normalize(p)]));
  const ids = [...new Set([...staticById.keys(), ...d1ById.keys()])].sort();
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
          generated: expected[field],
          d1: actual[field],
        });
      }
    }
  }

  return {
    generatedCount: staticProducts.length,
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

const endpoint = arg("--endpoint") || process.env.PHASE6_PUBLIC_CATALOG_ENDPOINT;
if (!endpoint) {
  throw new Error(
    "Provide --endpoint or PHASE6_PUBLIC_CATALOG_ENDPOINT.",
  );
}

const generated = readGeneratedCatalogue();
const d1 = await fetchD1Catalogue(endpoint);
const report = compare(generated, d1);

const output = arg("--output");
if (output) {
  writeFileSync(resolve(process.cwd(), output), JSON.stringify(report, null, 2) + "\n");
}

console.log(JSON.stringify(report, null, 2));

if (!report.passed) {
  process.exitCode = 1;
}
