import { describe, expect, it } from "vitest";
import {
  collectionSubtreeIds,
  renderCleanCollectionHtml,
} from "../src/routes/storefront-clean";
import type { StorefrontNodeSnapshot } from "../src/data/storefront-structure";
import { renderStorefrontNavigation } from "../src/routes/storefront-navigation";

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
      nodes,
      children: [mint],
      products: [],
    });
    expect(html).toContain('href="/collections/local-treats"');
    expect(html).toContain('href="/collections/mint-cake"');
    expect(html).toContain('rel="canonical" href="https://theblacksheepshop.co.uk/collections/romneys"');
    expect(html).toContain('href="/collections/local-treats">Local Treats</a>');
    expect(html).not.toContain('href="/romneys.html">Romney&#39;s</a>');
  });

  it("renders only published roots in server HTML and activates Local Treats for descendants", () => {
    const extra = [
      node("gifts", "Lake District Souvenirs", null),
      node("peter", "Peter Rabbit Gifts", null),
      node("cows", "Highland Cows Ornaments", null),
      node("ice", "Ice cream", null),
      node("christmas", "Christmas", null),
    ];
    const navigation = renderStorefrontNavigation([...nodes, ...extra], mint.id);
    expect(navigation.desktop.match(/class="active"/g)).toHaveLength(1);
    expect(navigation.desktop).toContain('class="active" href="/collections/local-treats"');
    expect(navigation.desktop).not.toContain('>Romney\'s</a>');
    expect(navigation.desktop).not.toContain('>Hawkshead Relish</a>');
    expect((navigation.desktop.match(/href="\/collections\//g) ?? []).length).toBe(6);
  });
});
