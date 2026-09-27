import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readProductImageUpload, readSharedMediaImageUpload } from "../src/http/image-upload";

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
function upload(bytes = png, type = "image/png", fields: Record<string, string> = {}) {
  const form = new FormData();
  form.set("file", new File([bytes], "owner-selected-name", { type }));
  form.set("expectedVersion", "2");
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new Request("https://example.test/upload", { method: "POST", body: form });
}

describe.each([
  ["product_media", readProductImageUpload],
  ["shared_media", readSharedMediaImageUpload],
] as const)("%s image validation", (prefix, read) => {
  it.each([
    ["image/png", png, "png"],
    ["image/jpeg", new Uint8Array([255, 216, 255]), "jpg"],
    ["image/webp", new TextEncoder().encode("RIFF0000WEBP"), "webp"],
  ] as const)("accepts %s with the existing signature contract", async (type, bytes, extension) => {
    const result = await read(upload(bytes, type));
    expect(result).toMatchObject({ mimeType: type, extension, bytes });
    expect(result.checksumSha256).toBe(createHash("sha256").update(bytes).digest("hex"));
  });

  it.each([
    [new Uint8Array(), "image/png", "file_empty"],
    [new Uint8Array(8 * 1024 * 1024 + 1), "image/png", "file_too_large"],
    [png, "image/svg+xml", "type_invalid"],
    [new Uint8Array([1, 2, 3]), "image/png", "signature_invalid"],
  ] as const)("rejects invalid uploads (%s, %s, %s)", async (bytes, type, code) => {
    await expect(read(upload(bytes, type))).rejects.toThrow(prefix + "_" + code);
  });

  it("rejects non-multipart bodies and missing files with the existing error code", async () => {
    await expect(read(new Request("https://example.test"))).rejects.toThrow(prefix + "_multipart_required");
    const form = new FormData();
    form.set("file", "a URL is not an uploaded file");
    await expect(read(new Request("https://example.test", { method: "POST", body: form })))
      .rejects.toThrow(prefix + "_file_required");
  });

  it("accepts the size boundary and trims alt text", async () => {
    const bytes = new Uint8Array(8 * 1024 * 1024);
    bytes.set(png);
    expect((await read(upload(bytes, "image/png", { altText: "  A sheep  " }))).altText).toBe("A sheep");
    await expect(read(upload(png, "image/png", { altText: "a".repeat(241) })))
      .rejects.toThrow(prefix + "_alt_text_too_long");
  });
});

it("preserves Product version validation before checking file bytes", async () => {
  await expect(readProductImageUpload(upload(new Uint8Array([1]), "image/png", { expectedVersion: "0" })))
    .rejects.toThrow("product_expected_version_invalid");
  expect(await readProductImageUpload(upload())).toMatchObject({ expectedVersion: 2, altText: null });
});

it("preserves library metadata defaults, normalization and title validation precedence", async () => {
  expect(await readSharedMediaImageUpload(upload())).toMatchObject({ title: null, altText: null, context: "GENERAL" });
  expect(await readSharedMediaImageUpload(upload(png, "image/png", { title: "  Shop  ", context: " section " })))
    .toMatchObject({ title: "Shop", context: "SECTION" });
  await expect(readSharedMediaImageUpload(upload(new Uint8Array([1]), "image/png", { title: "x".repeat(161) })))
    .rejects.toThrow("shared_media_title_too_long");
});
