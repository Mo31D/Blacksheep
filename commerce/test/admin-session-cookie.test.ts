import { describe, expect, it } from "vitest";
import {
  adminSessionCookie,
  clearAdminSessionCookie,
} from "../src/security/admin-access";

describe("Admin session cookie navigation policy", () => {
  it("keeps the secure session available after top-level return navigation", () => {
    const cookie = adminSessionCookie("token");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("SameSite=Strict");
  });

  it("clears the same Lax cookie scope on logout", () => {
    const cookie = clearAdminSessionCookie();
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=0");
  });
});
