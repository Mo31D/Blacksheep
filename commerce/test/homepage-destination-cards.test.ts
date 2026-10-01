import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { normalizeHomepageCards, type HomepageDestinationCards } from "../src/data/homepage-merchandising";
import { adminHtml } from "../src/admin/ui";

const current: HomepageDestinationCards = {
  COLLECTIONS: [{ storefrontNodeId: "sfn_gifts_peter_rabbit", name: "Peter Rabbit", shortDescription: null, imageUrl: null, legacyPath: "/gifts-peter-rabbit.html", destinationPath: "/gifts-peter-rabbit.html", position: 10 }],
  LOCAL_FAVOURITES: [{ storefrontNodeId: "sfn_icecream", name: "Ice Cream", shortDescription: null, imageUrl: null, legacyPath: "/icecream.html", destinationPath: "/icecream.html", position: 10 }],
};

describe("Homepage destination cards", () => {
  it("resolves published Shared Media at the active API origin for all static storefront image contexts", () => {
    const source = readFileSync(new URL("../../assets/site.js", import.meta.url), "utf8");
    const definition = source.split("\n").find(line => line.startsWith("function resolveStorefrontMediaUrl("));
    if (!definition) throw new Error("Shared Media URL resolver missing");
    const resolve = runInNewContext(`${definition};resolveStorefrontMediaUrl`, {
      window: { BLACK_SHEEP_LIVE_COMMERCE: { apiBase: "https://api.example.test/" } }, URL,
    }) as (value: string) => string;
    expect(resolve("/media/section-image")).toBe("https://api.example.test/media/section-image");
    expect(resolve("/images/local.webp")).toBe("/images/local.webp");
    expect(resolve("https://cdn.example.test/image.webp")).toBe("https://cdn.example.test/image.webp");
    expect(source).toContain("resolveStorefrontMediaUrl(card.imageUrl");
    expect(source).toContain("resolveStorefrontMediaUrl(node.imageUrl)");
    expect(source).toContain("const url=resolveStorefrontMediaUrl(value)");
  });
  it("preserves versioned node references and rejects duplicate or missing cards", () => {
    expect(normalizeHomepageCards(undefined, current)).toEqual({
      COLLECTIONS: ["sfn_gifts_peter_rabbit"],
      LOCAL_FAVOURITES: ["sfn_icecream"],
    });
    expect(normalizeHomepageCards({ COLLECTIONS: ["sfn_b", "sfn_a"], LOCAL_FAVOURITES: ["sfn_c"] }, current).COLLECTIONS)
      .toEqual(["sfn_b", "sfn_a"]);
    expect(() => normalizeHomepageCards({ COLLECTIONS: ["sfn_a", "sfn_a"], LOCAL_FAVOURITES: ["sfn_c"] }, current))
      .toThrow("homepage_cards_invalid");
    expect(() => normalizeHomepageCards({ COLLECTIONS: [], LOCAL_FAVOURITES: ["sfn_c"] }, current))
      .toThrow("homepage_cards_invalid");
    expect(() => normalizeHomepageCards({ COLLECTIONS: ["sfn_a"], LOCAL_FAVOURITES: [], EXTRA: [] }, current))
      .toThrow("homepage_cards_invalid");
  });

  it("offers contextual card selection and order controls in generated Admin", () => {
    const html = adminHtml("owner@example.test", "staging");
    expect(html).toContain('id="homepageCollectionCards"');
    expect(html).toContain('id="homepageLocalCards"');
    expect(html).toContain("data-card-move");
    expect(html).toContain("cards:{COLLECTIONS:homepageCardIds.COLLECTIONS.slice()");
  });
});
