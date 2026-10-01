const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES: Record<string, { extension: string; signature: (bytes: Uint8Array) => boolean }> = {
  "image/jpeg": {
    extension: "jpg",
    signature: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  "image/png": {
    extension: "png",
    signature: (bytes) =>
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a,
  },
  "image/webp": {
    extension: "webp",
    signature: (bytes) =>
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP",
  },
};

// HTTP image validation is shared by the library and existing Product APIs.
// Storage, associations and lifecycle decisions remain in their domain services.
async function readImageUpload<T>(
  request: Request,
  errorPrefix: "product_media" | "shared_media",
  readMetadata: (form: FormData) => T,
) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new Error(errorPrefix + "_multipart_required");
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error(errorPrefix + "_file_required");
  if (file.size <= 0) throw new Error(errorPrefix + "_file_empty");
  if (file.size > IMAGE_MAX_BYTES) throw new Error(errorPrefix + "_file_too_large");
  const config = IMAGE_TYPES[file.type.toLowerCase()];
  if (!config) throw new Error(errorPrefix + "_type_invalid");

  // Preserve validation precedence: metadata errors precede byte/signature checks.
  const metadata = readMetadata(form);
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (!config.signature(bytes)) throw new Error(errorPrefix + "_signature_invalid");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
  return {
    ...metadata,
    mimeType: file.type.toLowerCase(),
    extension: config.extension,
    bytes,
    checksumSha256: Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join(""),
  };
}

export function readProductImageUpload(request: Request) {
  return readImageUpload(request, "product_media", (form) => {
    const expectedVersion = Number(form.get("expectedVersion"));
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      throw new Error("product_expected_version_invalid");
    }
    const altText = String(form.get("altText") ?? "").trim();
    if (altText.length > 240) throw new Error("product_media_alt_text_too_long");
    return { expectedVersion, altText: altText || null };
  });
}

export function readSharedMediaImageUpload(request: Request) {
  return readImageUpload(request, "shared_media", (form) => {
    const title = String(form.get("title") ?? "").trim();
    const altText = String(form.get("altText") ?? "").trim();
    const context = String(form.get("context") ?? "GENERAL").trim().toUpperCase();
    if (title.length > 160) throw new Error("shared_media_title_too_long");
    if (altText.length > 240) throw new Error("shared_media_alt_text_too_long");
    return { title: title || null, altText: altText || null, context, allowDuplicate: form.get("allowDuplicate") === "1" };
  });
}
