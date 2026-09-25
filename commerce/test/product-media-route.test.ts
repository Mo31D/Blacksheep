import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { handleProductMediaRequest } from "../src/routes/product-media";

class MediaStatement implements D1PreparedStatementLike {
  constructor(private readonly row: Record<string, unknown> | null) {}
  bind(): D1PreparedStatementLike {
    return this;
  }
  async first<T>(): Promise<T | null> {
    return this.row as T | null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: [] };
  }
  async run(): Promise<unknown> {
    return {};
  }
}

class MediaDb implements D1DatabaseLike {
  constructor(private readonly row: Record<string, unknown> | null) {}
  prepare(): D1PreparedStatementLike {
    return new MediaStatement(this.row);
  }
  async batch<T>(): Promise<T[]> {
    return [];
  }
}

describe("Product media public delivery", () => {
  it("serves an immutable R2 object by media id", async () => {
    const response = await handleProductMediaRequest(
      new Request("https://admin.example.com/media/med-1"),
      {
        DB: new MediaDb({
          storageKey: "products/prd-1/2026-09/med-1.webp",
          mimeType: "image/webp",
          checksumSha256: "abc123",
        }),
        PRODUCT_MEDIA: {
          async put() {
            return {};
          },
          async get(key: string) {
            expect(key).toBe("products/prd-1/2026-09/med-1.webp");
            return {
              body: new Uint8Array([1, 2, 3]),
              httpMetadata: { contentType: "image/webp" },
            };
          },
          async delete() {
            return undefined;
          },
        },
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(response.headers.get("etag")).toBe('"abc123"');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it("returns 503 while R2 is not bound", async () => {
    const response = await handleProductMediaRequest(
      new Request("https://admin.example.com/media/med-1"),
      { DB: new MediaDb(null) },
    );
    expect(response.status).toBe(503);
  });
});
