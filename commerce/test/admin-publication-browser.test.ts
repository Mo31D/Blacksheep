import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { publicationScript } from "../src/admin/publication";

const snapshot = { id: "one", publishedVersionId: "version-2", draftVersionId: null };
function browser(payload: unknown, production = false) {
  const api = vi.fn(async (_path: string, _options: unknown) => {
    if (payload instanceof Error) throw payload;
    return payload;
  });
  const context = { api, isProductionAdminRuntime: () => production, setTimeout: (resolve: () => void) => resolve() };
  return { api, verify: runInNewContext(publicationScript + "verifyPublication", context) };
}

describe("shared public version verification", () => {
  it.each(["product", "structure", "homepage", "appearance"])("verifies the exact published version for %s", async domain => {
    const payload = { product: snapshot, nodes: [snapshot], config: snapshot };
    const { api, verify } = browser(payload);
    expect(await verify(domain, snapshot)).toMatchObject({ ok: true, state: "live", version: "version-2", message: "Published and verified in staging." });
    expect(api).toHaveBeenCalledOnce();
    expect(api.mock.calls[0][1]).toEqual({ cache: "no-store" });
  });
  it.each([
    { config: { ...snapshot, publishedVersionId: "version-1" } },
    { config: { ...snapshot, effectiveVersionId: "draft-3" } },
    { config: { ...snapshot, id: "different" } },
    {},
    new Error("public feed unavailable"),
  ])("does not claim success for stale, mismatched or failed data: %j", async payload => {
    const { api, verify } = browser(payload);
    expect(await verify("appearance", snapshot)).toMatchObject({ ok: false, state: "failed" });
    expect(api).toHaveBeenCalledTimes(3);
  });
  it("does not verify a private draft", async () => {
    const { api, verify } = browser({});
    expect(await verify("product", { ...snapshot, draftVersionId: "draft" })).toMatchObject({ ok: false, state: "pending" });
    expect(api).not.toHaveBeenCalled();
  });
  it("checks product placements as well as version identity", async () => {
    const { verify } = browser({ product: snapshot }, true);
    expect(await verify("product", snapshot, () => false)).toMatchObject({ ok: false });
    expect(await verify("product", snapshot, () => true)).toMatchObject({ message: "Published and verified on the public feed." });
  });
});
