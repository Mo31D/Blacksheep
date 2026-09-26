-- CARD 05 — persistent, scoped stocktake sessions.
-- Additive only. Existing inventory balances/movements remain authoritative.

CREATE TABLE stocktake_sessions (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  scope_type TEXT NOT NULL
    CHECK (scope_type IN ('ENTIRE_SHOP','STOREFRONT_NODE','BRAND_RANGE','CATEGORY','CUSTOM')),
  scope_ref_id TEXT,
  scope_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS'
    CHECK (status IN ('IN_PROGRESS','REVIEW','COMPLETED','CANCELLED')),
  total_items INTEGER NOT NULL DEFAULT 0 CHECK (total_items >= 0),
  counted_items INTEGER NOT NULL DEFAULT 0 CHECK (counted_items >= 0),
  skipped_items INTEGER NOT NULL DEFAULT 0 CHECK (skipped_items >= 0),
  conflict_items INTEGER NOT NULL DEFAULT 0 CHECK (conflict_items >= 0),
  current_position INTEGER NOT NULL DEFAULT 0 CHECK (current_position >= 0),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  FOREIGN KEY (location_id) REFERENCES inventory_locations(id) ON DELETE RESTRICT
);

CREATE INDEX idx_stocktake_sessions_status_updated
  ON stocktake_sessions(status, updated_at DESC);

CREATE INDEX idx_stocktake_sessions_location_status
  ON stocktake_sessions(location_id, status, updated_at DESC);

CREATE TABLE stocktake_session_items (
  session_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  title_snapshot TEXT NOT NULL,
  sku_snapshot TEXT,
  thumbnail_url_snapshot TEXT,
  tracked_snapshot INTEGER NOT NULL CHECK (tracked_snapshot IN (0,1)),
  system_on_hand_snapshot INTEGER,
  available_snapshot INTEGER,
  expected_balance_version INTEGER,
  variant_version_snapshot INTEGER NOT NULL CHECK (variant_version_snapshot >= 1),
  counted_on_hand INTEGER CHECK (counted_on_hand IS NULL OR counted_on_hand >= 0),
  item_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (item_status IN ('PENDING','COUNTED','SKIPPED','APPLIED','UNCHANGED','CONFLICT')),
  conflict_code TEXT,
  saved_at TEXT,
  applied_at TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  PRIMARY KEY (session_id, variant_id),
  UNIQUE (session_id, position),
  FOREIGN KEY (session_id) REFERENCES stocktake_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE INDEX idx_stocktake_items_session_position
  ON stocktake_session_items(session_id, position);

CREATE INDEX idx_stocktake_items_session_status
  ON stocktake_session_items(session_id, item_status, position);
