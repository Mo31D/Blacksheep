import {
  EXPECTED_CATALOG_BLOB,
  EXPECTED_PRODUCT_COUNT,
  buildImportSql,
  loadFrozenCatalogue,
  mediaEntries,
  moneyMinor,
} from "./product-core-lib.mjs";

const { items, blob } = loadFrozenCatalogue();
const sql = buildImportSql(items);

if (!sql.includes("INSERT INTO products")) {
  throw new Error("Product Core import SQL did not contain product inserts.");
}
if (sql.includes("'undefined'")) {
  throw new Error("Product Core import SQL serialized an undefined value.");
}

const summary = {
  sourceBlob: blob,
  products: items.length,
  priced: items.filter((item) => moneyMinor(item.price) !== null).length,
  missingPrice: items.filter((item) => moneyMinor(item.price) === null).length,
  media: items.reduce((sum, item) => sum + mediaEntries(item).length, 0),
};

if (summary.products !== EXPECTED_PRODUCT_COUNT) {
  throw new Error("Product Core validation count mismatch.");
}

console.log("PASS: frozen Product Core catalogue validation");
console.log(JSON.stringify(summary, null, 2));
