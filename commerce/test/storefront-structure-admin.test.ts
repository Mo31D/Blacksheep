import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import {
  archiveAdminStorefrontNode,
  createAdminStorefrontNode,
  publishAdminStorefrontNode,
  updateAdminStorefrontNode,
} from "../src/data/storefront-structure";

type AdminRow = Record<string, unknown>;

class AdminStatement implements D1PreparedStatementLike {
  values: unknown[] = [];
  constructor(
    public readonly sql: string,
    private readonly db: AdminDb,
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    if (this.sql.includes("LOWER(v.slug) = LOWER(?)")) return null;
    if (this.sql.includes("COALESCE(MAX(v.sort_order)")) {
      return { maxSort: 40 } as T;
    }
    if (
      this.sql.includes(
        "SELECT version, publication_status AS status, " +
          "current_published_version_id AS publishedVersionId",
      )
    ) {
      return {
        version: this.db.afterVersion,
        status: "ACTIVE",
        publishedVersionId: this.db.afterPublishedVersionId,
        draftVersionId: null,
        updatedAt: this.db.afterUpdatedAt,
      } as T;
    }
    if (
      this.sql.includes(
        "SELECT version, updated_at AS updatedAt FROM storefront_nodes",
      )
    ) {
      return {
        version: this.db.afterVersion,
        updatedAt: this.db.afterUpdatedAt,
      } as T;
    }
    return null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    if (
      this.sql.startsWith(
        "SELECT n.id, n.stable_key AS stableKey",
      )
    ) {
      return { results: [this.db.adminRow] as T[] };
    }
    return { results: [] };
  }

  async run(): Promise<unknown> {
    return {};
  }
}

class AdminDb implements D1DatabaseLike {
  prepared: AdminStatement[] = [];
  batches: AdminStatement[][] = [];
  afterVersion = 0;
  afterUpdatedAt = "";
  afterPublishedVersionId: string | null = null;

  constructor(public adminRow: AdminRow) {}

  prepare(sql: string): AdminStatement {
    const statement = new AdminStatement(sql, this);
    this.prepared.push(statement);
    return statement;
  }

  async batch<T>(statements: D1PreparedStatementLike[]): Promise<T[]> {
    const typed = statements as AdminStatement[];
    this.batches.push(typed);

    const publishUpdate = typed.find((statement) =>
      statement.sql.startsWith(
        "UPDATE storefront_nodes SET current_published_version_id",
      ),
    );
    if (publishUpdate) {
      this.afterUpdatedAt = String(publishUpdate.values[0]);
      this.afterVersion = Number(publishUpdate.values[2]) + 1;
      this.afterPublishedVersionId = String(publishUpdate.values[3]);
    }

    const ownerUpdate = typed.find((statement) =>
      statement.sql.startsWith(
        "UPDATE storefront_nodes SET current_draft_version_id",
      ),
    );
    if (ownerUpdate) {
      this.afterUpdatedAt = String(ownerUpdate.values[1]);
      this.afterVersion = Number(ownerUpdate.values[3]) + 1;
    }

    return [] as T[];
  }
}

function row(overrides: AdminRow = {}): AdminRow {
  return {
    id: "sfn_gifts",
    stableKey: "gifts",
    publicationStatus: "ACTIVE",
    version: 4,
    publishedVersionId: "sfv_gifts_1",
    draftVersionId: null,
    effectiveVersionId: "sfv_gifts_1",
    effectiveVersionNumber: 1,
    hasDraft: 0,
    name: "Gifts & Souvenirs",
    slug: "gifts",
    parentNodeId: null,
    sortOrder: 10,
    showInNavigation: 1,
    shortDescription: null,
    imageUrl: null,
    legacyPath: "/gifts.html",
    productCount: 64,
    childCount: 9,
    ...overrides,
  };
}

describe("CARD 02 Storefront Structure Admin data layer", () => {
  it("creates a private draft node and records owner audit history", async () => {
    const db = new AdminDb(row());

    const created = await createAdminStorefrontNode(
      db,
      {
        name: "New website section",
        showInNavigation: true,
        shortDescription: "A short owner-managed section.",
      },
      "owner@example.com",
    );

    expect(created.id).toMatch(/^sfn_/);
    expect(db.batches).toHaveLength(1);
    expect(db.batches[0]).toHaveLength(3);

    const [nodeInsert, versionInsert, auditInsert] = db.batches[0];
    expect(nodeInsert.sql).toContain("'DRAFT'");
    expect(versionInsert.sql).toContain("published_at");
    expect(auditInsert.sql).toContain("storefront_audit_events");
    expect(auditInsert.sql).toContain("VALUES");
    expect(auditInsert.values).toContain("NODE_CREATED");
    expect(auditInsert.values).toContain("owner@example.com");
  });

  it("guards the node mutation before draft and audit writes", async () => {
    const db = new AdminDb(
      row({
        childCount: 0,
      }),
    );

    await updateAdminStorefrontNode(
      db,
      "sfn_gifts",
      {
        expectedVersion: 4,
        showInNavigation: false,
      },
      "owner@example.com",
    );

    expect(db.batches).toHaveLength(1);
    const [ownerUpdate, versionWrite, auditWrite] = db.batches[0];

    expect(ownerUpdate.sql).toContain(
      "WHERE id = ? AND version = ? AND publication_status <> 'ARCHIVED'",
    );
    expect(versionWrite.sql).toContain(
      "FROM storefront_nodes WHERE id = ? AND version = ? AND updated_at = ?",
    );
    expect(auditWrite.sql).toContain(
      "SELECT ?, ?, ?, ?, ?, ?, ?, ? FROM storefront_nodes",
    );
    expect(auditWrite.values.slice(-3)).toEqual([
      "sfn_gifts",
      5,
      db.afterUpdatedAt,
    ]);
  });

  it("publishes a guarded Storefront draft and supersedes the previous live version", async () => {
    const db = new AdminDb(
      row({
        version: 4,
        draftVersionId: "sfv_gifts_2",
        effectiveVersionId: "sfv_gifts_2",
        effectiveVersionNumber: 2,
        hasDraft: 1,
      }),
    );

    await publishAdminStorefrontNode(
      db,
      "sfn_gifts",
      4,
      "owner@example.com",
    );

    expect(db.batches).toHaveLength(1);
    const statements = db.batches[0];
    expect(statements[0].sql).toContain(
      "current_published_version_id = current_draft_version_id",
    );
    expect(statements.some((statement) =>
      statement.sql.includes("SET superseded_at = ?"),
    )).toBe(true);
    expect(statements.some((statement) =>
      statement.sql.includes("SET published_at = ?, superseded_at = NULL"),
    )).toBe(true);
    expect(statements.at(-1)?.values).toContain("NODE_UPDATED");
    expect(statements.at(-1)?.values).toContain(
      "Owner published Storefront section",
    );
    expect(db.afterPublishedVersionId).toBe("sfv_gifts_2");
  });

  it("blocks archiving a parent while active sub-sections remain", async () => {
    const db = new AdminDb(row({ childCount: 2 }));

    await expect(
      archiveAdminStorefrontNode(
        db,
        "sfn_gifts",
        4,
        "owner@example.com",
      ),
    ).rejects.toThrow("storefront_archive_has_children");

    expect(db.batches).toHaveLength(0);
  });
});
