import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type ThemeConfig = { presetKey: string; decorationsEnabled: boolean };

function storefrontThemeHarness(navigator: { deviceMemory?: number; connection?: { saveData: boolean } } = {}) {
  const source = readFileSync(new URL("../../assets/site.js", import.meta.url), "utf8");
  const definition = source.split("\n").find((line) => line.startsWith("function syncStorefrontThemeLayer("));
  if (!definition) throw new Error("Storefront theme owner is missing");
  const attributes = new Map<string, string>();
  const links: Array<Record<string, unknown>> = [];
  const document = {
    documentElement: {
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      removeAttribute: (name: string) => attributes.delete(name),
    },
    getElementById: (id: string) => links.find((link) => link.id === id) ?? null,
    createElement: (name: string) => {
      expect(name).toBe("link");
      const link: Record<string, unknown> = {};
      link.remove = () => {
        const index = links.indexOf(link);
        if (index !== -1) links.splice(index, 1);
      };
      return link;
    },
    head: { appendChild: (link: Record<string, unknown>) => links.push(link) },
  };
  const sync = runInNewContext(`${definition}; syncStorefrontThemeLayer`, { document, navigator }) as (config: ThemeConfig) => void;
  return { sync, attributes, links };
}

describe("published storefront theme layer", () => {
  it("uses two tracked, inert, small seasonal illustrations", () => {
    const css = readFileSync(new URL("../../assets/theme-layers.css", import.meta.url), "utf8");
    expect(Buffer.byteLength(css)).toBeLessThan(6144);
    expect(css).toContain("@media(max-width:480px)");
    expect(css).not.toMatch(/\banimation\s*:/i);
    const baseCss = readFileSync(new URL("../../assets/style.css", import.meta.url), "utf8");
    expect(baseCss).toContain("@media(prefers-reduced-motion:reduce)");
    expect(baseCss).toContain("animation:none!important");
    for (const [preset, asset] of [
      ["WINTER", "winter-branch.svg"],
      ["CHRISTMAS", "christmas-ornaments.svg"],
    ]) {
      expect(css).toContain(`[data-theme-preset="${preset}"][data-theme-decorations="on"]`);
      expect(css).toContain(`/assets/themes/${asset}`);
      const svg = readFileSync(new URL(`../../assets/themes/${asset}`, import.meta.url), "utf8");
      expect(Buffer.byteLength(svg)).toBeLessThan(4096);
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).not.toMatch(/<script|<image|<foreignObject|\b(?:href|src)=["']https?:/i);
    }
    expect(css).toContain("pointer-events:none");
  });

  it("loads one optional stylesheet only for an enabled supported preset, then removes it", () => {
    const { sync, attributes, links } = storefrontThemeHarness();
    sync({ presetKey: "DEFAULT", decorationsEnabled: true });
    expect(links).toHaveLength(0);
    sync({ presetKey: "WINTER", decorationsEnabled: false });
    expect(links).toHaveLength(0);
    sync({ presetKey: "WINTER", decorationsEnabled: true });
    sync({ presetKey: "WINTER", decorationsEnabled: true });
    expect(links).toHaveLength(1);
    expect(links[0].href).toBe("/assets/theme-layers.css");
    expect(attributes.get("data-theme-preset")).toBe("WINTER");
    sync({ presetKey: "CHRISTMAS", decorationsEnabled: true });
    expect(links).toHaveLength(1);
    expect(attributes.get("data-theme-preset")).toBe("CHRISTMAS");
    sync({ presetKey: "DEFAULT", decorationsEnabled: false });
    expect(links).toHaveLength(0);
    expect(attributes.size).toBe(0);
  });

  it("fails back to the base storefront when the optional stylesheet cannot load", () => {
    const { sync, attributes, links } = storefrontThemeHarness();
    sync({ presetKey: "WINTER", decorationsEnabled: true });
    (links[0].onerror as () => void)();
    expect(links).toHaveLength(0);
    expect(attributes.has("data-theme-decorations")).toBe(false);
  });

  it("skips optional artwork on data-saving and low-memory devices", () => {
    for (const navigator of [
      { connection: { saveData: true } },
      { deviceMemory: 2 },
    ]) {
      const { sync, links, attributes } = storefrontThemeHarness(navigator);
      sync({ presetKey: "WINTER", decorationsEnabled: true });
      expect(links).toHaveLength(0);
      expect(attributes.size).toBe(0);
    }
  });
});
