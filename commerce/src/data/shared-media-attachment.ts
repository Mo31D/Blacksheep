// SQL predicates for the first write in an atomic content/association batch.
// Each consumes one binding: a storage key, or a JSON array of newly used URLs.
// Existing non-library references remain valid; unavailable library assets do not.
const unavailable = "a.status <> 'ACTIVE' OR EXISTS (" +
  "SELECT 1 FROM shared_media_delete_jobs j WHERE j.asset_id = a.id)";

export const sharedMediaStorageAvailableSql =
  "NOT EXISTS (SELECT 1 FROM shared_media_assets a WHERE a.storage_key = ? " +
  "AND (" + unavailable + "))";

export const sharedMediaUrlsAvailableSql =
  "NOT EXISTS (SELECT 1 FROM shared_media_assets a " +
  "WHERE a.public_url IN (SELECT value FROM json_each(?)) " +
  "AND (" + unavailable + "))";
