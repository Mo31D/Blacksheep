import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function assert(value, message) {
  if (!value) throw new Error(message);
}

const repoRoot = resolve(process.cwd(), "..");
const site = readFileSync(resolve(repoRoot, "assets/site.js"), "utf8");
const live = readFileSync(resolve(repoRoot, "assets/commerce-live.js"), "utf8");
const style = readFileSync(resolve(repoRoot, "assets/style.css"), "utf8");
const homepage = readFileSync(resolve(repoRoot, "index.html"), "utf8");
const indexSource = readFileSync(resolve(process.cwd(), "src/index.ts"), "utf8");

assert(
  /<section[^>]*id="homepageProductRail"[^>]*\shidden(?:\s|>)/.test(homepage),
  "Homepage rail must stay hidden until published merchandising loads.",
);
assert(homepage.includes('id="homepageProductRailTrack"'), "Homepage rail track is missing.");
assert(homepage.includes('id="homepageProductRailPrev"'), "Homepage rail previous control is missing.");
assert(homepage.includes('id="homepageProductRailNext"'), "Homepage rail next control is missing.");
for (const key of ["HERO","COLLECTIONS","PRODUCT_RAIL","LOCAL_FAVOURITES","VISIT_SHOP"]) {
  assert(homepage.includes('data-home-module="' + key + '"'), "Homepage module shell is missing: " + key);
}

assert(live.includes("/v1/homepage-merchandising"), "Published Homepage merchandising endpoint is not loaded.");
assert(live.includes("homepageMerchandisingFallback"), "Homepage merchandising fallback is missing.");
assert(live.includes("syncHomepageProductRail(homepageMerchandising)"), "Homepage rail sync hook is missing.");
assert(indexSource.includes('url.pathname === "/v1/homepage-merchandising"'), "Worker route for Homepage merchandising is missing.");

assert(site.includes("function syncHomepageModules(modules)"), "Homepage module composition renderer is missing.");
assert(site.includes("main.insertBefore(node,anchor)"), "Homepage modules are not reordered safely before the script anchor.");
assert(site.includes("node.hidden=row.enabled===false"), "Homepage module visibility is not applied.");
assert(site.includes("function syncHomepageProductRail(payload)"), "Homepage rail renderer is missing.");
assert(site.includes("homepageCatalogMatch(product)"), "Homepage rail live Product matcher is missing.");
assert(site.includes("cards.push(card(matched.item,matched.type))"), "Homepage rail must reuse live Product cards.");
assert(site.includes("track.scrollBy"), "Homepage rail arrow scrolling is missing.");
assert(style.includes(".home-product-rail-track"), "Homepage rail CSS is missing.");
assert(style.includes("scroll-snap-type:x mandatory"), "Homepage rail scroll snapping is missing.");
assert(style.includes("-webkit-overflow-scrolling:touch"), "Homepage rail touch momentum is missing.");

assert(live.includes("homepageMerchandising=null"), "Homepage merchandising fallback state is missing.");
assert(live.includes("homepageMerchandisingError"), "Homepage merchandising error state is missing.");
assert(site.includes("config.enabled!==true||!homepageModuleEnabled('PRODUCT_RAIL')||!products.length"), "Homepage rail safe-hide/module fallback is missing.");
assert(site.includes("section.hidden=true"), "Homepage rail must hide safely when config/feed is unavailable.");

console.log("PASS: CARD 07 Homepage product rail static storefront contract.");
