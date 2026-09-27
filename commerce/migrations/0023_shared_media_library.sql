-- CARD 11 — Shared Media Library on R2.
-- Additive staging-first foundation. Existing Product Media remains compatible.
-- Archived assets continue to resolve publicly so historical published versions and restore paths cannot break.

CREATE TABLE shared_media_assets (
  id TEXT PRIMARY KEY,
  storage_provider TEXT NOT NULL DEFAULT 'R2'
    CHECK (storage_provider IN ('R2')),
  storage_key TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  checksum_sha256 TEXT NOT NULL,
  title TEXT,
  alt_text TEXT,
  context TEXT NOT NULL DEFAULT 'GENERAL'
    CHECK (context IN ('GENERAL','PRODUCT','HOMEPAGE','SECTION','THEME')),
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','ARCHIVED','DELETED')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  deleted_at TEXT
);

CREATE INDEX idx_shared_media_assets_status_context
  ON shared_media_assets(status, context, updated_at DESC);

CREATE INDEX idx_shared_media_assets_checksum
  ON shared_media_assets(checksum_sha256, status);

CREATE TABLE shared_media_references (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  surface TEXT NOT NULL
    CHECK (surface IN ('PRODUCT','HOMEPAGE','SECTION','THEME')),
  owner_id TEXT NOT NULL,
  owner_version_id TEXT,
  slot_key TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  released_at TEXT,
  FOREIGN KEY (asset_id) REFERENCES shared_media_assets(id) ON DELETE RESTRICT
);

CREATE INDEX idx_shared_media_references_asset
  ON shared_media_references(asset_id, released_at, surface);

CREATE INDEX idx_shared_media_references_owner
  ON shared_media_references(surface, owner_id, owner_version_id, released_at);

CREATE TABLE shared_media_audit_events (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'UPLOADED','METADATA_UPDATED','ARCHIVED','RESTORED',
      'REFERENCE_ADDED','REFERENCE_RELEASED','OBJECT_DELETED'
    )),
  actor_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_shared_media_audit_asset_created
  ON shared_media_audit_events(asset_id, created_at DESC);
