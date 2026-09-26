import { describe, expect, it } from "vitest";
import { adminHtml, adminLoginHtml } from "../src/admin/ui";

function inlineScripts(html: string): string[] {
  return Array.from(
    html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi),
    (match) => match[1],
  );
}

function compileInlineScripts(html: string): void {
  const scripts = inlineScripts(html);
  expect(scripts.length).toBeGreaterThan(0);

  for (const script of scripts) {
    // Parse/compile exactly the JavaScript emitted into the browser.
    // This catches template-string escaping mistakes that TypeScript
    // cannot see because they only exist after adminHtml() renders.
    // eslint-disable-next-line no-new-func
    new Function(script);
  }
}

describe("generated Admin HTML scripts", () => {
  it("emits syntactically valid authenticated Admin JavaScript", () => {
    const html = adminHtml("owner@example.com");
    compileInlineScripts(html);
    expect(html).toContain("URLSearchParams(location.search).get('order')");
    expect(html).toContain("openOrder(requestedOrder)");
  });

  it("renders owner-ready production copy and staging-only test controls", () => {
    const production = adminHtml("owner@example.com", "production");
    const staging = adminHtml("owner@example.com", "staging");

    compileInlineScripts(production);
    compileInlineScripts(staging);

    expect(production).not.toContain("Phase 2 · Editing");
    expect(production).not.toContain("Phase 4 · Staging");
    expect(production).not.toContain("Staging Product Core");
    expect(production).not.toContain("before storefront cutover");
    expect(production).not.toContain("dedicated Media phase");
    expect(production).not.toContain('id="resetTestOrders"');
    expect(production).not.toContain('data-order-class="TEST"');
    expect(production).toContain('id="manageCategories"');
    expect(production).toContain("Manage categories");
    expect(production).toContain("categoryTypeLabel");
    expect(production).toContain("COLLECTION_THEME");
    expect(production).toContain('id="newProductCategorySearch"');
    expect(production).toContain('id="newProductCategorySelected"');
    expect(production).toContain(
      "Archiving hides a category from new choices without deleting it or breaking existing product links.",
    );
    expect(production).toContain("ensureProductEditorCategories");
    expect(production).toContain("· Archived");
    expect(production).toContain('id="stockValueButton"');
    expect(production).toContain('id="view-stock-value"');
    expect(production).toContain("Stock Value");
    expect(production).toContain("Value by supplier");
    expect(production).toContain("Potential gross profit");
    expect(production).toContain("loadStockValuation");
    expect(production).toContain("openProductCostEditor");
    expect(production).toContain("Item cost ex VAT");
    expect(production).toContain("VAT rate %");
    expect(production).toContain("Supplier product code");
    expect(production).toContain(
      "padding-bottom:calc(148px + env(safe-area-inset-bottom))",
    );
    expect(production).not.toContain(
      "Categories used by products cannot be archived until those products are moved to another category.",
    );

    expect(staging).toContain("STAGING");
    expect(staging).toContain("Reset test orders");
    expect(staging).toContain("RESET TEST ORDERS");
    expect(staging).toContain("Current payment &amp; fulfilment status");
    expect(staging).toContain("#dashboardMetrics,#orderMetrics{grid-template-columns:repeat(2");
    expect(staging).toContain("<svg viewBox=");
  });

  it("emits syntactically valid Admin login JavaScript", () => {
    const html = adminLoginHtml();
    compileInlineScripts(html);
    expect(html).toContain(
      "history.replaceState(null,'','/admin'+location.search+'#orders')",
    );
    expect(html).toContain("location.reload()");
    expect(html).not.toContain(
      "location.href='/admin'+location.search+'#orders'",
    );
  });

  it("promotes iPad-width master/detail views into immediate overlays", () => {
    const html = adminHtml("owner@example.com");
    expect(html).toContain(
      "window.matchMedia('(max-width:900px)').matches",
    );
    expect(html).toContain("if(innerWidth<=900)");
    expect(html).toContain(
      ".detail-open .order-panel{display:block;position:fixed;inset:72px 0 0 78px",
    );
    expect(html).toContain(
      ".product-detail-open .product-detail-panel{display:block;position:fixed;inset:72px 0 0 78px",
    );
  });
});
