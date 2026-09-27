-- CARD 11 hardening — crash-safe shared-media object deletion.
-- A D1 claim is recorded before destructive R2 deletion. Failed/ambiguous
-- attempts can be retried idempotently without losing the audit trail.

CREATE TABLE shared_media_delete_jobs (
  asset_id TEXT PRIMARY KEY,
  storage_key TEXT NOT NULL,
  state TEXT NOT NULL
    CHECK (state IN ('CLAIMED','FAILED','DONE')),
  attempt_count INTEGER NOT NULL DEFAULT 0
    CHECK (attempt_count >= 0),
  claim_token TEXT NOT NULL,
  last_error TEXT,
  claimed_by TEXT NOT NULL,
  claimed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (asset_id) REFERENCES shared_media_assets(id) ON DELETE RESTRICT
);

CREATE INDEX idx_shared_media_delete_jobs_state_updated
  ON shared_media_delete_jobs(state, updated_at);
