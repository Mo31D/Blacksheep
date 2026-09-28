import type { D1DatabaseLike, D1PreparedStatementLike } from "../../src/data/d1";

// Small persistence fake: execute asset INSERTs in batch, then return the actual
// bound asset row. Does not mock the upload service or asset creation function.
export class MediaUploadDb implements D1DatabaseLike {
  asset: Record<string, unknown> | null = null;
  failure: "none" | "before" | "after" | "unknown" = "none";
  prepare(sql: string): D1PreparedStatementLike {
    const db = this;
    let values: unknown[] = [];
    return {
      bind(...input) { values = input; return this; },
      async first<T>() {
        if (sql.includes("shared_media_assets")) {
          if (db.failure === "unknown") throw new Error("ownership_unavailable");
          return db.asset as T | null;
        }
        return null;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() {
        if (sql.startsWith("INSERT INTO shared_media_assets")) {
          const fields = ["id", "storageKey", "publicUrl", "mimeType", "width", "height",
            "fileSize", "checksumSha256", "title", "altText", "context",
            "createdBy", "createdAt", "updatedBy", "updatedAt"];
          db.asset = Object.fromEntries(fields.map((field, i) => [field, values[i]]));
          Object.assign(db.asset, { status: "ACTIVE", storageProvider: "R2", usageCount: 0 });
        }
        return {};
      },
    };
  }
  async batch<T>(statements: D1PreparedStatementLike[]): Promise<T[]> {
    if (this.failure === "before" || this.failure === "unknown") throw new Error("asset_save_failed");
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    if (this.failure === "after") throw new Error("asset_acknowledgement_failed");
    return results as T[];
  }
}
