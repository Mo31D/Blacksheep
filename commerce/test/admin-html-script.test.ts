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
    compileInlineScripts(adminHtml("owner@example.com"));
  });

  it("emits syntactically valid Admin login JavaScript", () => {
    compileInlineScripts(adminLoginHtml());
  });
});
