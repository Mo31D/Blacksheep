import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import type { D1DatabaseLike, D1PreparedStatementLike } from "../../src/data/d1";

// Real migration schema and SQL execution; the hook models a competing write
// after domain reads and immediately before the atomic D1 batch.
export class SqliteD1 implements D1DatabaseLike {
  sqlite = new DatabaseSync(":memory:");
  constructor() {
    const migrations = new URL("../../migrations/", import.meta.url);
    for (const name of readdirSync(migrations).filter(name => name.endsWith(".sql")).sort()) {
      this.sqlite.exec(readFileSync(new URL(name, migrations), "utf8"));
    }
  }
  beforeBatch?: () => void | Promise<void>;
  prepare(sql: string): D1PreparedStatementLike {
    const statement = this.sqlite.prepare(sql);
    let values: SQLInputValue[] = [];
    return {
      bind(...input) { values = input as SQLInputValue[]; return this; },
      async first<T>() { return (statement.get(...values) ?? null) as T | null; },
      async all<T>() { return { results: statement.all(...values) as T[] }; },
      async run() { return { meta: { changes: Number(statement.run(...values).changes) } }; },
    };
  }
  async batch<T>(statements: D1PreparedStatementLike[]): Promise<T[]> {
    const hook = this.beforeBatch;
    this.beforeBatch = undefined;
    await hook?.();
    this.sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec("COMMIT");
      return results as T[];
    } catch (cause) {
      this.sqlite.exec("ROLLBACK");
      throw cause;
    }
  }
}

