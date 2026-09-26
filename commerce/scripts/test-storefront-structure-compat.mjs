import {
  buildImportSql,
  legacyStorefrontPlacements,
  loadFrozenCatalogue,
} from "./product-core-lib.mjs";

const { items } = loadFrozenCatalogue();
const expectedTypes = new Map();
const actualPrimaryRoots = new Map();

function rootForNode(nodeId) {
  if (nodeId.startsWith("sfn_gifts")) return "gifts";
  if (nodeId.startsWith("sfn_icecream")) return "icecream";
  if (nodeId.startsWith("sfn_romneys")) return "romneys";
  if (nodeId.startsWith("sfn_hawkshead")) return "hawkshead";
  return null;
}

let expectedPlacementRows = 0;

for (const item of items) {
  expectedTypes.set(item.type, (expectedTypes.get(item.type) ?? 0) + 1);
  const primaryCategory =
    item.category && (item.categories ?? []).includes(item.category)
      ? item.category
      : item.categories?.[0] ?? null;
  const placements = legacyStorefrontPlacements(
    item.type,
    item.categories ?? [],
    primaryCategory,
  );

  if (!placements.length) {
    throw new Error(`No Storefront placement for ${item.id} (${item.type}).`);
  }
  if (placements.filter((placement) => placement.isPrimary).length !== 1) {
    throw new Error(`Expected one primary placement for ${item.id}.`);
  }
  if (
    new Set(placements.map((placement) => placement.storefrontNodeId)).size !==
    placements.length
  ) {
    throw new Error(`Duplicate Storefront placement for ${item.id}.`);
  }

  const primary = placements.find((placement) => placement.isPrimary);
  const root = primary ? rootForNode(primary.storefrontNodeId) : null;
  if (root !== item.type) {
    throw new Error(
      `Primary Storefront root mismatch for ${item.id}: expected ${item.type}, got ${root}.`,
    );
  }

  actualPrimaryRoots.set(root, (actualPrimaryRoots.get(root) ?? 0) + 1);
  expectedPlacementRows += placements.length;
}

for (const [type, expected] of expectedTypes) {
  if (type === "fragrances" && expected === 0) continue;
  const actual = actualPrimaryRoots.get(type) ?? 0;
  if (actual !== expected) {
    throw new Error(
      `Primary-root parity mismatch for ${type}: expected ${expected}, got ${actual}.`,
    );
  }
}

const sql = buildImportSql(items);
const placementInserts = (
  sql.match(/INSERT INTO product_version_storefront_placements/g) ?? []
).length;

if (placementInserts !== expectedPlacementRows) {
  throw new Error(
    `Importer placement-row mismatch: expected ${expectedPlacementRows}, generated ${placementInserts}.`,
  );
}

console.log(
  `PASS: Storefront compatibility mapping covers ${items.length} frozen products with ${expectedPlacementRows} deterministic placements.`,
);
