import type { D1DatabaseLike } from "./d1";
import type { R2BucketLike } from "./product-media";
import { sharedMediaStorageOwnedByLibrary } from "./shared-media";

/** Compensate a failed upload only after proving its new, unique key has no owner.
 * Not for deleting existing assets: those require the normal reference/claim flow.
 */
export async function cleanupUnownedMediaUpload(
  db: D1DatabaseLike,
  bucket: R2BucketLike,
  storageKey: string,
): Promise<void> {
  try {
    // Include historical/deleted rows: upload compensation must not erase history.
    const productOwner = await db.prepare(
      "SELECT id FROM product_media WHERE storage_provider = 'R2' AND storage_key = ? LIMIT 1",
    ).bind(storageKey).first<{ id: string }>();
    if (productOwner || await sharedMediaStorageOwnedByLibrary(db, storageKey)) return;
    await bucket.delete(storageKey);
  } catch {
    // A failed/ambiguous commit or ownership read can still have persisted an owner.
    // Preserve both its object and the original request error; cleanup can wait.
  }
}
