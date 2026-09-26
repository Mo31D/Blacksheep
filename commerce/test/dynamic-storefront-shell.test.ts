import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("CARD 04 dynamic storefront shell", () => {
  it("keeps the compatibility collection route private from search until clean URLs ship", () => {
    const html = read("collection.html");

    expect(html).toContain('id="dynamicCollectionPage"');
    expect(html).toContain('name="robots" content="noindex,follow"');
    expect(html).toContain('id="dynamicCollectionTitle"');
    expect(html).toContain('id="dynamicCollectionChildren"');
    expect(html).toContain('id="catalog"');
    expect(html).toContain('assets/catalog.js');
    expect(html).toContain('assets/site.js');
  });

  it("uses published structure for navigation and placement-driven collection membership", () => {
    const site = read("assets/site.js");
    const live = read("assets/commerce-live.js");

    expect(site).toContain("function syncDynamicStorefrontStructure(nodes)");
    expect(site).toContain("function syncStorefrontNavigation(nodes)");
    expect(site).toContain("function renderDynamicCollectionPage(nodes)");
    expect(site).toContain("node.showInNavigation===true");
    expect(site).toContain("item.commerceStorefrontNodeIds");
    expect(site).toContain("if(node.legacyPath)return String(node.legacyPath)");
    expect(site).toContain("'/collection.html?section='");

    expect(live).toContain("apiBase+'/v1/storefront-structure'");
    expect(live).toContain("commerceStorefrontNodeIds");
    expect(live).toContain("structureFallback");
  });
});
