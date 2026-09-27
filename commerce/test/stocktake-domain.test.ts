import { describe, expect, it } from "vitest";
import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "../src/data/d1";
import {
  previewStocktakeScope,
  saveStocktakeItem,
} from "../src/data/stocktake";

class Statement implements D1PreparedStatementLike {
  values: unknown[] = [];

  constructor(
    readonly sql: string,
    private readonly db: StocktakeDb,
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    return this.db.first<T>(this);
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.db.all<T>(this) };
  }

  async run(): Promise<unknown> {
    this.db.executed.push(this);
    return {};
  }
}

class StocktakeDb implements D1DatabaseLike {
  prepared: Statement[] = [];
  executed: Statement[] = [];
  batches: Statement[][] = [];
  savedAt = "";

  prepare(sql: string): Statement {
    const statement = new Statement(sql, this);
    this.prepared.push(statement);
    return statement;
  }

  async batch<T>(statements: D1PreparedStatementLike[]): Promise<T[]> {
    const typed = statements as Statement[];
    for (const statement of typed) {
      expect(statement.values).toHaveLength(
        (statement.sql.match(/\?/g) ?? []).length,
      );
    }
    this.batches.push(typed);
    const itemUpdate = typed.find((statement) =>
      statement.sql.startsWith("UPDATE stocktake_session_items SET"),
    );
    if (itemUpdate) {
      this.savedAt = String(itemUpdate.values[2]);
    }
    return [] as T[];
  }

  first<T>(statement: Statement): T | null {
    const sql = statement.sql;

    if (sql.includes("FROM inventory_locations")) {
      return {
        id: "loc_ambleside",
        code: "AMBLESIDE",
        name: "Black Sheep Shop — Ambleside",
      } as T;
    }

    if (sql.includes("FROM categories") && sql.includes("category_type")) {
      return {
        name: "Romney's",
        categoryType: "BRAND_RANGE",
      } as T;
    }

    if (sql.includes("FROM storefront_nodes n") && sql.includes("ev.name")) {
      return { name: "Gifts & Souvenirs" } as T;
    }

    if (sql.startsWith("SELECT COUNT(*) AS count")) {
      return { count: 52 } as T;
    }

    if (
      sql.startsWith("SELECT id, location_id AS locationId") &&
      sql.includes("WHERE id = ?")
    ) {
      return {
        id: "stk-1",
        locationId: "loc_ambleside",
        scopeType: "BRAND_RANGE",
        scopeRefId: "cat-romneys",
        scopeLabel: "Romney's",
        status: "IN_PROGRESS",
        totalItems: 52,
        countedItems: this.batches.length ? 1 : 0,
        skippedItems: 0,
        conflictItems: 0,
        currentPosition: this.batches.length ? 1 : 0,
        createdBy: "owner@example.com",
        createdAt: "2026-09-26T20:00:00.000Z",
        updatedAt: "2026-09-26T20:00:00.000Z",
        completedAt: null,
        version: this.batches.length ? 2 : 1,
      } as T;
    }

    if (
      sql.includes(
        "SELECT position, item_status AS itemStatus, version",
      )
    ) {
      return {
        position: 0,
        itemStatus: "PENDING",
        version: 1,
      } as T;
    }

    if (
      sql.includes(
        "SELECT version, item_status AS itemStatus, saved_at AS savedAt",
      )
    ) {
      return {
        version: 2,
        itemStatus: "COUNTED",
        savedAt: this.savedAt,
      } as T;
    }

    return null;
  }

  all<T>(statement: Statement): T[] {
    if (statement.sql.includes("FROM stocktake_session_items i")) {
      return [] as T[];
    }
    return [];
  }
}

describe("CARD 05 Stocktake domain", () => {
  it("previews a Romney's brand-range scope through Product classifications", async () => {
    const db = new StocktakeDb();

    const preview = await previewStocktakeScope(db, {
      locationId: "loc_ambleside",
      scopeType: "BRAND_RANGE",
      scopeRefId: "cat-romneys",
    });

    expect(preview).toMatchObject({
      scopeType: "BRAND_RANGE",
      scopeRefId: "cat-romneys",
      scopeLabel: "Romney's",
      totalItems: 52,
    });

    const count = db.prepared.find((statement) =>
      statement.sql.startsWith("SELECT COUNT(*) AS count"),
    );
    expect(count?.sql).toContain("product_version_categories");
    expect(count?.values).toEqual([
      "loc_ambleside",
      "cat-romneys",
    ]);
  });

  it("previews a Highland Cows-only Website-section scope directly", async () => {
    const db = new StocktakeDb();

    const preview = await previewStocktakeScope(db, {
      locationId: "loc_ambleside",
      scopeType: "STOREFRONT_NODE",
      scopeRefId: "sfn_gifts_highland_cows",
    });

    expect(preview).toMatchObject({
      scopeType: "STOREFRONT_NODE",
      scopeRefId: "sfn_gifts_highland_cows",
    });

    const count = db.prepared.find((statement) =>
      statement.sql.startsWith("SELECT COUNT(*) AS count"),
    );
    expect(count?.sql).toContain("product_version_storefront_placements");
    expect(count?.values).toEqual([
      "loc_ambleside",
      "sfn_gifts_highland_cows",
      "sfn_gifts_highland_cows",
    ]);
  });

  it("makes a main Website-section scope include products placed in its sub-sections", async () => {
    const db = new StocktakeDb();

    await previewStocktakeScope(db, {
      locationId: "loc_ambleside",
      scopeType: "STOREFRONT_NODE",
      scopeRefId: "sfn_gifts",
    });

    const count = db.prepared.find((statement) =>
      statement.sql.startsWith("SELECT COUNT(*) AS count"),
    );
    expect(count?.sql).toContain(
      "cev.parent_node_id = ?",
    );
    expect(count?.values).toEqual([
      "loc_ambleside",
      "sfn_gifts",
      "sfn_gifts",
    ]);
  });

  it("persists a Count only while the parent session remains editable", async () => {
    const db = new StocktakeDb();

    const detail = await saveStocktakeItem(
      db,
      "stk-1",
      "var-1",
      {
        expectedItemVersion: 1,
        countedOnHand: 8,
        action: "COUNT",
      },
    );

    expect(db.batches).toHaveLength(1);
    const [itemUpdate, sessionUpdate] = db.batches[0];

    expect(itemUpdate.sql).toContain(
      "EXISTS (SELECT 1 FROM stocktake_sessions s",
    );
    expect(itemUpdate.sql).toContain(
      "s.status IN ('IN_PROGRESS','REVIEW')",
    );
    expect(sessionUpdate.sql).toContain(
      "version = ? AND saved_at = ?",
    );
    expect(detail.session).toMatchObject({
      id: "stk-1",
      countedItems: 1,
      currentPosition: 1,
    });
  });
});
