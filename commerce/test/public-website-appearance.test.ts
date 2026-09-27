import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { handlePublicCatalogRequest } from "../src/routes/catalog";

class Statement implements D1PreparedStatementLike {
  values: unknown[] = [];
  constructor(public readonly sql: string) {}
  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }
  async first<T>(): Promise<T | null> {
    if (this.sql.includes("FROM website_appearance wa")) {
      return {
        id: "site_appearance",
        version: 3,
        publishedVersionId: "wav-live",
        draftVersionId: "wav-draft",
        effectiveVersionId: "wav-live",
        effectiveVersionNumber: 2,
        presetKey: "DEFAULT",
        backgroundColor: "#f8f4ea",
        surfaceColor: "#fffefa",
        textColor: "#151512",
        mutedTextColor: "#706b61",
        accentColor: "#b7904c",
        buttonColor: "#151512",
        borderColor: "#ddd5c6",
        headerColor: "#f8f4ea",
        heroImageUrl: "/images/1.png",
        heroHeading: "A gift shop full of character.",
        heroText: "Published copy",
        heroButtonLabel: "Browse all products",
        heroButtonHref: "/all-products.html",
        sectionImagesJson: "{\"gifts\":\"/images/gifts.webp\"}",
        scheduledStartAt: null,
        scheduledEndAt: null,
        createdAt: "2026-09-27T09:30:00.000Z",
        publishedAt: "2026-09-27T09:30:00.000Z",
      } as T;
    }
    return null;
  }
  async all<T>(): Promise<{ results: T[] }> { return { results: [] }; }
  async run(): Promise<unknown> { return {}; }
}
class Db implements D1DatabaseLike {
  prepared: Statement[] = [];
  prepare(sql: string): Statement {
    const statement = new Statement(sql);
    this.prepared.push(statement);
    return statement;
  }
  async batch<T>(): Promise<T[]> { return [] as T[]; }
}

describe("CARD 08 published Website Appearance contract", () => {
  it("returns only the current published Appearance version", async () => {
    const db = new Db();
    const response = await handlePublicCatalogRequest(
      new Request("https://api.example.test/v1/appearance"),
      { DB: db, D1_PUBLIC_CATALOG_ENABLED: "true" },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      contract: "website-appearance-published-v1",
      config: {
        publishedVersionId: "wav-live",
        effectiveVersionId: "wav-live",
        presetKey: "DEFAULT",
        tokens: {
          background: "#f8f4ea",
          accent: "#b7904c",
          button: "#151512",
        },
        hero: {
          heading: "A gift shop full of character.",
          buttonHref: "/all-products.html",
        },
        sectionImages: {
          gifts: "/images/gifts.webp",
        },
      },
    });
    expect(db.prepared[0].sql).toContain(
      "JOIN website_appearance_versions wav ON wav.id = wa.current_published_version_id",
    );
    expect(db.prepared[0].sql).not.toContain(
      "COALESCE(wa.current_draft_version_id",
    );
  });
});
