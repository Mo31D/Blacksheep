import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const sourcePath = path.join(repoRoot, "assets", "catalog.js");
const outputPath = path.join(repoRoot, "commerce", "src", "generated", "catalog.ts");
const checkOnly = process.argv.includes("--check");

function readCatalogue() {
  const raw = fs.readFileSync(sourcePath, "utf8").trim();
  const prefix = "window.CATALOG=";
  if (!raw.startsWith(prefix)) throw new Error("assets/catalog.js has an unexpected format.");
  return JSON.parse(raw.slice(prefix.length).replace(/;$/, ""));
}

function normalize(catalogue) {
  const seenIds = new Set();
  const seenSlugs = new Set();
  const products = [];

  for (const section of Object.values(catalogue)) {
    for (const item of section || []) {
      if (!item?.id || !item?.slug || !item?.name || !item?.type) {
        throw new Error("Every catalogue item needs id, slug, name and type.");
      }
      if (seenIds.has(item.id)) throw new Error(`Duplicate catalogue id: ${item.id}`);
      if (seenSlugs.has(item.slug)) throw new Error(`Duplicate catalogue slug: ${item.slug}`);
      seenIds.add(item.id);
      seenSlugs.add(item.slug);

      const status = item.availabilityStatus || item.stockStatus || "available";
      if (!["available", "arriving-soon", "out-of-stock"].includes(status)) {
        throw new Error(`Unsupported availability status for ${item.id}: ${status}`);
      }

      const hasPrice = typeof item.price === "number" && Number.isFinite(item.price);
      let nonPurchasableReason = null;
      if (status === "arriving-soon") nonPurchasableReason = "arriving_soon";
      else if (status === "out-of-stock") nonPurchasableReason = "out_of_stock";
      else if (!hasPrice) nonPurchasableReason = "price_unavailable";

      products.push({
        id: item.id,
        sku: item.sku ?? null,
        slug: item.slug,
        name: item.name,
        type: item.type,
        priceMinor: hasPrice ? Math.round(item.price * 100) : null,
        currency: "GBP",
        status,
        purchasable: nonPurchasableReason === null,
        nonPurchasableReason,
        options: [],
      });
    }
  }

  return products.sort((a, b) => a.id.localeCompare(b.id));
}

function render(products) {
  return `/* AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.\n * Source: /assets/catalog.js\n * Generator: /scripts/build-commerce-catalog.mjs\n */\n\nexport type CommerceCatalogStatus = "available" | "arriving-soon" | "out-of-stock";\nexport type NonPurchasableReason = "arriving_soon" | "out_of_stock" | "price_unavailable" | null;\n\nexport interface CommerceCatalogProduct {\n  id: string;\n  sku: string | null;\n  slug: string;\n  name: string;\n  type: string;\n  priceMinor: number | null;\n  currency: "GBP";\n  status: CommerceCatalogStatus;\n  purchasable: boolean;\n  nonPurchasableReason: NonPurchasableReason;\n  options: readonly unknown[];\n}\n\nexport const COMMERCE_CATALOG = ${JSON.stringify(products, null, 2)} as const satisfies readonly CommerceCatalogProduct[];\n`;
}

const output = render(normalize(readCatalogue()));
if (checkOnly) {
  if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, "utf8") !== output) {
    console.error("Commerce catalogue snapshot is stale. Run: npm run catalog:build");
    process.exit(1);
  }
  console.log("Commerce catalogue snapshot is current.");
} else {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output);
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
}
