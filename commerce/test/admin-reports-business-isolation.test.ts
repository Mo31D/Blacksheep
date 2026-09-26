import { describe, expect, it } from "vitest";
import type { D1DatabaseLike, D1PreparedStatementLike } from "../src/data/d1";
import { getAdminReportsV2 } from "../src/data/admin-reports-v2";

class Statement implements D1PreparedStatementLike {
  values: unknown[] = [];
  constructor(public readonly sql: string) {}
  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }
  async first<T>(): Promise<T | null> {
    return {} as T;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: [] };
  }
  async run(): Promise<unknown> {
    return {};
  }
}

class Db implements D1DatabaseLike {
  statements: Statement[] = [];
  prepare(query: string): Statement {
    const statement = new Statement(query);
    this.statements.push(statement);
    return statement;
  }
  async batch<T>(): Promise<T[]> {
    return [];
  }
}

describe("Admin reports business-data isolation", () => {
  it("filters every order-backed report query to visible BUSINESS orders", async () => {
    const db = new Db();
    await getAdminReportsV2(db, 30);

    const orderQueries = db.statements
      .map((statement) => statement.sql)
      .filter((sql) => /\b(?:FROM|JOIN)\s+orders\b/i.test(sql));

    expect(orderQueries.length).toBeGreaterThan(0);
    for (const sql of orderQueries) {
      expect(sql).toContain("data_class = 'BUSINESS'");
      expect(sql).toContain("admin_hidden_at IS NULL");
    }
  });
});
