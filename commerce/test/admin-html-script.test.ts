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
    expect(production).not.toContain("resetTestOrders");
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
