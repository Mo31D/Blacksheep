import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { adminLoginHtml } from "../src/admin/ui";

// Window.status is a legacy DOMString property: assigning an element converts
// it to text. A syntax-only test cannot detect this browser-global collision.
function browser(response: Response) {
  const elements = new Map<string, any>();
  const document = { getElementById(id: string) {
    if (!elements.has(id)) elements.set(id, {
      value: "test-password", textContent: "", className: "", style: {},
      focus: vi.fn(), addEventListener: vi.fn(),
    });
    return elements.get(id);
  }};
  const fetch = vi.fn(async () => response);
  const location = { hostname: "staging.example.com", search: "", reload: vi.fn() };
  const globals = { document, fetch, location, history: { replaceState: vi.fn() } };
  let windowStatus = "";
  Object.defineProperty(globals, "status", {
    configurable: true, get: () => windowStatus,
    set: (value) => { windowStatus = String(value); },
  });
  const script = adminLoginHtml().match(/<script>([\s\S]*?)<\/script>/)![1];
  runInNewContext(script, globals);
  return { document, fetch, location };
}

describe("Admin login browser behaviour", () => {
  it("shows server failures instead of silently remaining on sign-in", async () => {
    const { document, fetch, location } = browser(new Response(
      JSON.stringify({ error: { message: "Sign-in is temporarily unavailable." } }),
      { status: 503 },
    ));
    await document.getElementById("passwordEnter").onclick();
    expect(fetch).toHaveBeenCalledOnce();
    expect(document.getElementById("status").textContent).toBe("Sign-in is temporarily unavailable.");
    expect(document.getElementById("status").className).toBe("status error");
    expect(location.reload).not.toHaveBeenCalled();
  });

  it("shows success and reloads the authenticated document", async () => {
    const { document, location } = browser(new Response("{}"));
    await document.getElementById("passwordEnter").onclick();
    expect(document.getElementById("status").textContent).toBe("Signed in. Opening Admin…");
    expect(location.reload).toHaveBeenCalledOnce();
  });
});
