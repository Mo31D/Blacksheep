import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(process.cwd(), "..");
const site = readFileSync(resolve(repoRoot, "assets/site.js"), "utf8");
const live = readFileSync(resolve(repoRoot, "assets/commerce-live.js"), "utf8");
const style = readFileSync(resolve(repoRoot, "assets/style.css"), "utf8");
const homepage = readFileSync(resolve(repoRoot, "index.html"), "utf8");
const indexSource = readFileSync(resolve(process.cwd(), "src/index.ts"), "utf8");

describe("CARD 07 Homepage product rail storefront contract", () => {
  it("keeps the rail hidden until published merchandising is loaded", () => {
    expect(homepage).toContain('id="homepageProductRail" hidden');
    expect(homepage).toContain('id="homepageProductRailTrack"');
    expect(homepage).toContain('id="homepageProductRailPrev"');
    expect(homepage).toContain('id="homepageProductRailNext"');
  });

  it("loads only the published Homepage merchandising endpoint", () => {
    expect(live).toContain("/v1/homepage-merchandising");
    expect(live).toContain("homepageMerchandisingFallback");
    expect(live).toContain("syncHomepageProductRail(homepageMerchandising)");
    expect(indexSource).toContain(
      'url.pathname === "/v1/homepage-merchandising"',
    );
  });

  it("renders a horizontal swipeable rail using existing live Product cards", () => {
    expect(site).toContain("function syncHomepageProductRail(payload)");
    expect(site).toContain("homepageCatalogMatch(product)");
    expect(site).toContain("cards.push(card(matched.item,matched.type))");
    expect(site).toContain("track.scrollBy");
    expect(style).toContain(".home-product-rail-track");
    expect(style).toContain("scroll-snap-type:x mandatory");
    expect(style).toContain("-webkit-overflow-scrolling:touch");
  });

  it("has a safe storefront fallback when the public merchandising feed fails", () => {
    expect(live).toContain("homepageMerchandising=null");
    expect(live).toContain("homepageMerchandisingError");
    expect(site).toContain("if(config.enabled!==true||!products.length)");
    expect(site).toContain("section.hidden=true");
  });
});
