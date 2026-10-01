import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const script = readFileSync(new URL("../../assets/commerce-live.js", import.meta.url), "utf8");
const product = (id: string) => ({ id, productId: id, slug: id, name: id, type: "gifts", priceMinor: 250, purchasable: true });

async function load(pages: unknown[]) {
  const original = { gifts: [{ id: "old", slug: "old", name: "Old design product", price: 1 }, { id: "kept", slug: "kept", name: "Kept", price: 1 }] };
  const window = { CATALOG: original, BLACK_SHEEP_LIVE_COMMERCE: { enabled: true, apiBase: "https://api.example.test" }, BLACK_SHEEP_LIVE_COMMERCE_STATE: {} as Record<string, unknown> };
  let complete!: () => void;
  const done = new Promise<void>(resolve => { complete = resolve; });
  const reconcile = vi.fn();
  const document = { documentElement: { dataset: {} as Record<string, string> }, getElementById: () => null, dispatchEvent: () => complete() };
  let index = 0;
  const fetch = vi.fn(async (url: string) => {
    if (!url.includes("/v1/catalog?")) return { ok: false, status: 503 };
    const page = pages[index++];
    if (page instanceof Error) throw page;
    return { ok: true, json: async () => page };
  });
  runInNewContext(script, { window, document, fetch, URL, location: { origin: "https://shop.example.test" }, CustomEvent: class {}, reconcilePublishedCatalogDom: reconcile });
  await done;
  return { window, original, document, reconcile };
}

describe("published storefront reconciliation", () => {
  it("removes archived original products and adds new products from the same snapshot", async () => {
    const result = await load([{ products: [product("kept"), product("new")], nextCursor: null }]);
    expect(result.window.CATALOG.gifts.map(item => item.id)).toEqual(["kept", "new"]);
    expect(result.window.BLACK_SHEEP_LIVE_COMMERCE_STATE).toMatchObject({ authoritative: true, removed: 1, added: 1 });
    expect(result.reconcile).toHaveBeenCalledOnce();
    expect(result.original.gifts[1].price).toBe(1);
  });

  it("accepts an intentionally empty published catalogue", async () => {
    const result = await load([{ products: [], nextCursor: null }]);
    expect(result.window.CATALOG.gifts).toEqual([]);
    expect(result.document.documentElement.dataset.commerceLive).toBe("ready");
  });

  it("waits for all pages before deciding which original products are absent", async () => {
    const result = await load([{ products: [product("new")], nextCursor: 1 }, { products: [product("kept")], nextCursor: null }]);
    expect(result.window.CATALOG.gifts.map(item => item.id)).toEqual(["kept", "new"]);
  });

  it.each([
    [new Error("network unavailable")],
    [{ products: [product("new")], nextCursor: 1 }, new Error("second page failed")],
    [{ products: [], nextCursor: "broken" }],
    [{ products: [product("new")], nextCursor: 1 }, { products: [], nextCursor: 1 }],
    [{ products: [{ name: "invalid product" }], nextCursor: null }],
    [{ products: [product("new"), product("new")], nextCursor: null }],
    [{ error: "unavailable" }],
  ])("preserves the complete fallback on invalid or incomplete feeds: %j", async (...pages) => {
    const result = await load(pages);
    expect(result.window.CATALOG).toBe(result.original);
    expect(result.document.documentElement.dataset.commerceLive).toBe("fallback");
    expect(result.reconcile).not.toHaveBeenCalled();
  });
});

describe("original design DOM reconciliation", () => {
  const site = readFileSync(new URL("../../assets/site.js", import.meta.url), "utf8");
  const reconcileScript = site.slice(site.indexOf("function reconcilePublishedCatalogDom("), site.indexOf("function productAvailabilityRank("));
  it.each([true, false])("removes stale cards only when the feed is authoritative: %s", authoritative => {
    const removed = { remove: vi.fn() }, kept = { remove: vi.fn() };
    const initFilters = vi.fn();
    const globals = { window: { BLACK_SHEEP_LIVE_COMMERCE_STATE: { authoritative } }, document: { getElementById: () => null, querySelectorAll: () => [removed, kept], querySelector: () => null }, location: { pathname: "/all-products.html" }, liveCatalogPageContext: () => null, productFromCard: (card: unknown) => card === kept ? {} : null, initFilters };
    runInNewContext(reconcileScript + "reconcilePublishedCatalogDom();", globals);
    expect(removed.remove).toHaveBeenCalledTimes(authoritative ? 1 : 0);
    expect(kept.remove).not.toHaveBeenCalled();
    expect(initFilters).toHaveBeenCalledTimes(authoritative ? 1 : 0);
  });
});
