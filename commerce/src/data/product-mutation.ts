import type { D1DatabaseLike, D1PreparedStatementLike } from "./d1";

// The first product UPDATE assigns NULL to the required version on conflict.
// D1 then rolls back the whole batch before timestamp-gated dependent writes;
// updated_at is a timestamp, not a unique ownership token.
export async function commitProductMutationBatch(
  db: D1DatabaseLike,
  statements: D1PreparedStatementLike[],
): Promise<void> {
  try {
    await db.batch(statements);
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes("NOT NULL constraint failed: products.version")) {
      throw new Error("product_version_conflict");
    }
    throw cause;
  }
}
