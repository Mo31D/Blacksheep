import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import { restoreAdminWebsiteAppearance } from "../src/data/website-appearance";

class Statement implements D1PreparedStatementLike {
  values: unknown[] = [];
  constructor(
    public readonly sql: string,
    private readonly db: Db,
  ) {}
  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }
  async first<T>(): Promise<T | null> {
    if (this.sql.includes("SELECT wa.id, wa.version")) {
      return {
        id: "site_appearance",
        version: 4,
        publishedVersionId: "wav_live_4",
        draftVersionId: null,
        effectiveVersionId: "wav_live_4",
        effectiveVersionNumber: 4,
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
        heroHeading: "Current",
        heroText: "Current text",
        heroButtonLabel: "Browse",
        heroButtonHref: "/all-products.html",
        sectionImagesJson: "{}",
        scheduledStartAt: null,
        scheduledEndAt: null,
        createdAt: "2026-09-27T09:30:00.000Z",
        publishedAt: "2026-09-27T09:30:00.000Z",
      } as T;
    }
    if (this.sql.startsWith("SELECT * FROM website_appearance_versions")) {
      return {
        id: "wav_old_2",
        appearance_id: "site_appearance",
        version_number: 2,
        published_at: "2026-09-27T08:00:00.000Z",
      } as T;
    }
    if (
      this.sql.startsWith(
        "SELECT version, current_published_version_id AS publishedVersionId",
      )
    ) {
      return {
        version: 5,
        publishedVersionId: this.db.restoredId,
        draftVersionId: null,
        updatedAt: this.db.updatedAt,
      } as T;
    }
    return null;
  }
  async run(): Promise<unknown> {
    return {};
  }
}

class Db implements D1DatabaseLike {
  prepared: Statement[] = [];
  batched: Statement[] = [];
  restoredId = "";
  updatedAt = "";

  prepare(sql: string): Statement {
    const statement = new Statement(sql, this);
    this.prepared.push(statement);
    return statement;
  }

  async batch<T>(statements: D1PreparedStatementLike[]): Promise<T[]> {
    this.batched = statements as Statement[];
    const ownerUpdate = this.batched[0];
    this.restoredId = String(ownerUpdate.values[0]);
    this.updatedAt = String(ownerUpdate.values[1]);
    return [] as T[];
  }
}

describe("Website Appearance restore ordering", () => {
  it("supersedes the current live version before inserting the restored live clone", async () => {
    const db = new Db();

    await restoreAdminWebsiteAppearance(
      db,
      "wav_old_2",
      4,
      "owner@example.com",
    );

    expect(db.batched).toHaveLength(4);
    expect(db.batched[0].sql).toContain(
      "UPDATE website_appearance SET current_published_version_id",
    );
    expect(db.batched[1].sql).toContain(
      "UPDATE website_appearance_versions SET superseded_at",
    );
    expect(db.batched[1].values[1]).toBe("wav_live_4");
    expect(db.batched[2].sql).toContain(
      "INSERT INTO website_appearance_versions",
    );
    expect(db.batched[3].sql).toContain(
      "INSERT INTO website_appearance_audit_events",
    );

    const supersedeIndex = db.batched.findIndex((statement) =>
      statement.sql.includes(
        "UPDATE website_appearance_versions SET superseded_at",
      ),
    );
    const restoreInsertIndex = db.batched.findIndex((statement) =>
      statement.sql.includes("INSERT INTO website_appearance_versions"),
    );
    expect(supersedeIndex).toBeGreaterThanOrEqual(0);
    expect(restoreInsertIndex).toBeGreaterThan(supersedeIndex);
  });
});
