import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import {
  claimSharedMediaObjectDeletion,
  finalizeSharedMediaObjectDeletion,
  recordSharedMediaDeleteFailure,
  restoreAdminSharedMediaAsset,
} from "../src/data/shared-media";

type Job = {
  storageKey: string;
  state: "CLAIMED" | "FAILED" | "DONE";
  attemptCount: number;
  claimToken: string;
  lastError: string | null;
};

class FakeDb implements D1DatabaseLike {
  asset = {
    id: "asset-1",
    storageKey: "library/asset-1.webp",
    publicUrl: "/media/asset-1",
    mimeType: "image/webp",
    width: null,
    height: null,
    fileSize: 123,
    checksumSha256: "abc",
    title: "Asset",
    altText: "Asset alt",
    context: "GENERAL",
    status: "ARCHIVED" as "ACTIVE" | "ARCHIVED" | "DELETED",
    createdBy: "owner@example.test",
    createdAt: "2026-09-27T00:00:00.000Z",
    updatedBy: "owner@example.test",
    updatedAt: "2026-09-27T00:00:00.000Z",
    archivedAt: "2026-09-27T00:00:00.000Z",
    deletedAt: null as string | null,
  };
  job: Job | null = null;
  blockers = { product: 0, section: 0, appearance: 0, references: 0 };
  auditEvents = 0;

  prepare(sql: string): D1PreparedStatementLike {
    return new FakeStatement(this, sql);
  }

  async batch<T>(statements: D1PreparedStatementLike[]): Promise<T[]> {
    const out: unknown[] = [];
    for (const statement of statements) out.push(await statement.run());
    return out as T[];
  }
}

class FakeStatement implements D1PreparedStatementLike {
  private values: unknown[] = [];

  constructor(
    private readonly db: FakeDb,
    private readonly sql: string,
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    if (
      this.sql.includes("FROM shared_media_delete_jobs") &&
      this.sql.includes("storage_key AS storageKey")
    ) {
      if (!this.db.job) return null;
      return {
        storageKey: this.db.job.storageKey,
        state: this.db.job.state,
        claimToken: this.db.job.claimToken,
      } as T;
    }

    if (
      this.sql.includes("SELECT state FROM shared_media_delete_jobs") &&
      this.sql.includes("state <> 'DONE'")
    ) {
      if (!this.db.job || this.db.job.state === "DONE") return null;
      return { state: this.db.job.state } as T;
    }

    if (
      this.sql.includes("SELECT state, claim_token AS claimToken") &&
      this.sql.includes("FROM shared_media_delete_jobs")
    ) {
      if (!this.db.job) return null;
      return {
        state: this.db.job.state,
        claimToken: this.db.job.claimToken,
      } as T;
    }

    if (this.sql.includes("FROM shared_media_assets a")) {
      if (this.db.asset.status === "DELETED") return null;
      return {
        ...this.db.asset,
        usageCount:
          this.db.blockers.product +
          this.db.blockers.section +
          this.db.blockers.appearance +
          this.db.blockers.references,
      } as T;
    }

    if (this.sql.includes("FROM product_media")) {
      return { count: this.db.blockers.product } as T;
    }
    if (this.sql.includes("FROM storefront_node_versions")) {
      return { count: this.db.blockers.section } as T;
    }
    if (this.sql.includes("FROM website_appearance_versions")) {
      return { count: this.db.blockers.appearance } as T;
    }
    if (this.sql.includes("FROM shared_media_references")) {
      return { count: this.db.blockers.references } as T;
    }

    return null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: [] };
  }

  async run(): Promise<unknown> {
    if (this.sql.startsWith("INSERT INTO shared_media_delete_jobs")) {
      const [claimToken, , , , assetId] = this.values;
      const safe =
        assetId === this.db.asset.id &&
        this.db.asset.status === "ARCHIVED" &&
        Object.values(this.db.blockers).every((value) => value === 0);

      if (safe) {
        if (!this.db.job) {
          this.db.job = {
            storageKey: this.db.asset.storageKey,
            state: "CLAIMED",
            attemptCount: 1,
            claimToken: String(claimToken),
            lastError: null,
          };
        } else if (this.db.job.state === "CLAIMED" || this.db.job.state === "FAILED") {
          this.db.job.state = "CLAIMED";
          this.db.job.attemptCount += 1;
          this.db.job.claimToken = String(claimToken);
          this.db.job.lastError = null;
        }
      }
      return {};
    }

    if (this.sql.includes("SET state = 'FAILED'")) {
      const [message, , assetId, claimToken] = this.values;
      if (
        this.db.job &&
        assetId === this.db.asset.id &&
        this.db.job.state === "CLAIMED" &&
        this.db.job.claimToken === claimToken
      ) {
        this.db.job.state = "FAILED";
        this.db.job.lastError = String(message);
      }
      return {};
    }

    if (this.sql.startsWith("UPDATE shared_media_assets SET status = 'DELETED'")) {
      const [, , , assetId, , claimToken] = this.values;
      if (
        this.db.job &&
        assetId === this.db.asset.id &&
        this.db.asset.status === "ARCHIVED" &&
        this.db.job.state === "CLAIMED" &&
        this.db.job.claimToken === claimToken
      ) {
        this.db.asset.status = "DELETED";
      }
      return {};
    }

    if (
      this.sql.startsWith("INSERT INTO shared_media_audit_events") &&
      this.sql.includes("OBJECT_DELETED")
    ) {
      const [, assetId, , , , , , claimToken] = this.values;
      if (
        this.db.job &&
        assetId === this.db.asset.id &&
        this.db.asset.status === "DELETED" &&
        this.db.job.state === "CLAIMED" &&
        this.db.job.claimToken === claimToken
      ) {
        this.db.auditEvents += 1;
      }
      return {};
    }

    if (this.sql.includes("SET state = 'DONE'")) {
      const [, assetId, claimToken] = this.values;
      if (
        this.db.job &&
        assetId === this.db.asset.id &&
        this.db.asset.status === "DELETED" &&
        this.db.job.state === "CLAIMED" &&
        this.db.job.claimToken === claimToken
      ) {
        this.db.job.state = "DONE";
        this.db.job.lastError = null;
      }
      return {};
    }

    return {};
  }
}

describe("Shared media crash-safe deletion", () => {
  it("refuses to claim an archived asset while a live/history blocker exists", async () => {
    const db = new FakeDb();
    db.blockers.references = 1;

    await expect(
      claimSharedMediaObjectDeletion(db, db.asset.id, "owner@example.test"),
    ).rejects.toThrow("shared_media_delete_blocked");
    expect(db.job).toBeNull();
    expect(db.asset.status).toBe("ARCHIVED");
  });

  it("retries a failed storage deletion with a fresh claim and finalizes idempotently", async () => {
    const db = new FakeDb();

    const first = await claimSharedMediaObjectDeletion(
      db,
      db.asset.id,
      "owner@example.test",
    );
    expect(first.alreadyDeleted).toBe(false);
    expect(db.job?.attemptCount).toBe(1);

    await recordSharedMediaDeleteFailure(
      db,
      db.asset.id,
      String(first.claimToken),
      new Error("temporary R2 failure"),
    );
    expect(db.job?.state).toBe("FAILED");

    const retry = await claimSharedMediaObjectDeletion(
      db,
      db.asset.id,
      "owner@example.test",
    );
    expect(retry.claimToken).not.toBe(first.claimToken);
    expect(db.job?.attemptCount).toBe(2);

    await finalizeSharedMediaObjectDeletion(db, retry, "owner@example.test");
    expect(db.asset.status).toBe("DELETED");
    expect(db.job?.state).toBe("DONE");
    expect(db.auditEvents).toBe(1);

    const repeated = await claimSharedMediaObjectDeletion(
      db,
      db.asset.id,
      "owner@example.test",
    );
    expect(repeated).toMatchObject({ alreadyDeleted: true, claimToken: null });
  });

  it("blocks restore while a destructive delete claim still needs resolution", async () => {
    const db = new FakeDb();
    await claimSharedMediaObjectDeletion(db, db.asset.id, "owner@example.test");

    await expect(
      restoreAdminSharedMediaAsset(db, db.asset.id, "owner@example.test"),
    ).rejects.toThrow("shared_media_delete_pending");
    expect(db.asset.status).toBe("ARCHIVED");
  });
});
