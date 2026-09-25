export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all?<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  batch<T = unknown>(statements: D1PreparedStatementLike[]): Promise<T[]>;
}


/**
 * Returns whether a D1 mutating statement changed at least one row.
 *
 * Real D1 batch results expose meta.changes. Legacy unit-test fakes in this
 * repository may omit metadata, so null means "not observable in this fake"
 * rather than failure.
 */
export function d1StatementChanged(result: unknown): boolean | null {
  if (!result || typeof result !== "object") return null;
  const meta = (result as { meta?: { changes?: unknown } }).meta;
  if (!meta || typeof meta.changes !== "number") return null;
  return meta.changes > 0;
}
