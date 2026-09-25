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

  it("emits syntactically valid Admin login JavaScript", () => {
    const html = adminLoginHtml();
    compileInlineScripts(html);
    expect(html).toContain("location.href='/admin'+location.search+'#orders'");
  });
});
