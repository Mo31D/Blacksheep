import { describe, expect, it } from "vitest";
import {
  collectionSubtreeIds,
  renderCleanCollectionHtml,
} from "../src/routes/storefront-clean";
import type { StorefrontNodeSnapshot } from "../src/data/storefront-structure";

function node(
  id: string,
  name: string,
  parentNodeId: string | null,
): StorefrontNodeSnapshot {
  return {
    id,
    stableKey: id,
    name,
    slug: id,
    parentNodeId,
    sortOrder: 10,
    showInNavigation: parentNodeId === null,
    shortDescription: null,
    imageUrl: null,
    legacyPath: null,
    publishedVersionId: id + "-published",
  };
}

describe("three-level public collections", () => {
  const local = node("local-treats", "Local Treats", null);
  const romneys = node("romneys", "Romney's", local.id);
  const mint = node("mint-cake", "Mint Cake", romneys.id);
  const hawkshead = node("hawkshead", "Hawkshead Relish", local.id);
  const honey = node("honey", "Honey", hawkshead.id);
  const nodes = [local, romneys, mint, hawkshead, honey];

  it("includes descendants at all depths without mixing sibling collections", () => {
    expect([...collectionSubtreeIds(local.id, nodes)]).toEqual([
      "local-treats", "romneys", "hawkshead", "mint-cake", "honey",
    ]);
    expect([...collectionSubtreeIds(romneys.id, nodes)]).toEqual([
      "romneys", "mint-cake",
    ]);
  });

  it("links the parent trail and direct child on a third-level collection page", () => {
    const html = renderCleanCollectionHtml({
      node: romneys,
      parent: local,
      ancestors: [local],
      children: [mint],
      products: [],
    });
    expect(html).toContain('href="/collections/local-treats"');
    expect(html).toContain('href="/collections/mint-cake"');
    expect(html).toContain('rel="canonical" href="https://theblacksheepshop.co.uk/collections/romneys"');
  });
});
