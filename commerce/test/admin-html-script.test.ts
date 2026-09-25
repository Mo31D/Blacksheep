import { Script } from "node:vm";
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

  for (const [index, script] of scripts.entries()) {
    try {
      new Script(script, { filename: `admin-inline-${index + 1}.js` });
    } catch (error) {
      const stack =
        error instanceof Error ? error.stack ?? error.message : String(error);
      throw new Error(
        `Generated Admin inline script ${index + 1} does not compile.\n${stack}`,
      );
    }
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
