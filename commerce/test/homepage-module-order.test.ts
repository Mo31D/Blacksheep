import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { normalizeHomepageModuleSettings, type HomepageModuleSetting } from "../src/data/homepage-merchandising";
import { adminHtml } from "../src/admin/ui";

const keys = ["LOCAL_FAVOURITES", "COLLECTIONS", "VISIT_SHOP", "HERO", "PRODUCT_RAIL"] as const;
const settings = keys.map((key, index) => ({ key, enabled: key !== "VISIT_SHOP", position: (index + 1) * 10 }));

describe("Homepage section composition", () => {
  it("persists every valid section order and rejects duplicate keys", () => {
    const saved = normalizeHomepageModuleSettings(settings, []);
    expect(saved.map((row) => row.key)).toEqual(keys);
    expect(saved.map((row) => row.position)).toEqual([10, 20, 30, 40, 50]);
    expect(saved.find((row) => row.key === "VISIT_SHOP")?.enabled).toBe(false);
    expect(() => normalizeHomepageModuleSettings([settings[0], ...settings.slice(0, 4)], []))
      .toThrow("homepage_modules_invalid");
  });

  it("renders the published order and visibility without pinning the hero", () => {
    const source = readFileSync(new URL("../../assets/site.js", import.meta.url), "utf8");
    const definition = source.split("\n").find((line) => line.startsWith("function syncHomepageModules("));
    if (!definition) throw new Error("Storefront Homepage composer is missing");
    const nodes = new Map(keys.map((key) => [key, { dataset: { homeModule: key }, hidden: false }]));
    const children: Array<{ dataset?: { homeModule: string }; tagName?: string }> = [
      ...[...keys].reverse().map((key) => nodes.get(key)!),
      { tagName: "SCRIPT" },
    ];
    const main = {
      children,
      querySelectorAll: () => [...nodes.values()],
      insertBefore: (node: (typeof children)[number], anchor: (typeof children)[number]) => {
        const previous = children.indexOf(node);
        if (previous !== -1) children.splice(previous, 1);
        children.splice(children.indexOf(anchor), 0, node);
      },
    };
    const window = {} as { BLACK_SHEEP_HOMEPAGE_MODULES?: HomepageModuleSetting[] };
    const sync = runInNewContext(`${definition}; syncHomepageModules`, {
      document: { querySelector: () => main }, window,
    }) as (modules: HomepageModuleSetting[]) => HomepageModuleSetting[];
    const rendered = sync(settings);
    expect(children.filter((node) => node.dataset).map((node) => node.dataset!.homeModule)).toEqual(keys);
    expect(nodes.get("VISIT_SHOP")?.hidden).toBe(true);
    expect(rendered.map((row) => row.key)).toEqual(keys);
  });

  it("offers ↑ ↓ for every section in the generated Admin", () => {
    const html = adminHtml("owner@example.test", "staging");
    expect(html).not.toContain("Fixed position");
    expect(html).not.toContain("if(index<3||target<3");
    expect(html).toContain("data-homepage-module-move");
  });
});
