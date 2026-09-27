-- CARD 06 — Homepage Merchandising.
-- Additive, versioned configuration separate from Product and Storefront Structure data.
-- CARD 07 will consume the published configuration on the public homepage.

CREATE TABLE homepage_merchandising (
  id TEXT PRIMARY KEY,
  current_published_version_id TEXT,
  current_draft_version_id TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE homepage_merchandising_versions (
  id TEXT PRIMARY KEY,
  merchandising_id TEXT NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  mode TEXT NOT NULL
    CHECK (mode IN ('NEW_ARRIVALS','FEATURED_PRODUCTS','SELECTED_COLLECTION')),
  product_limit INTEGER NOT NULL DEFAULT 8 CHECK (product_limit BETWEEN 1 AND 20),
  heading TEXT,
  selected_storefront_node_id TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT,
  superseded_at TEXT,
  UNIQUE(merchandising_id, version_number),
  FOREIGN KEY (merchandising_id) REFERENCES homepage_merchandising(id) ON DELETE CASCADE,
  FOREIGN KEY (selected_storefront_node_id) REFERENCES storefront_nodes(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX idx_homepage_merchandising_one_live_version
  ON homepage_merchandising_versions(merchandising_id)
  WHERE published_at IS NOT NULL AND superseded_at IS NULL;

CREATE TABLE homepage_merchandising_products (
  version_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(version_id, product_id),
  FOREIGN KEY (version_id) REFERENCES homepage_merchandising_versions(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE INDEX idx_homepage_merchandising_products_position
  ON homepage_merchandising_products(version_id, position, product_id);

CREATE TABLE homepage_merchandising_audit_events (
  id TEXT PRIMARY KEY,
  merchandising_id TEXT NOT NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('DRAFT_SAVED','PUBLISHED')),
  actor_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (merchandising_id) REFERENCES homepage_merchandising(id) ON DELETE RESTRICT
);

CREATE INDEX idx_homepage_merchandising_audit_created
  ON homepage_merchandising_audit_events(merchandising_id, created_at DESC);

INSERT INTO homepage_merchandising (
  id, current_published_version_id, current_draft_version_id,
  version, created_at, updated_at
) VALUES (
  'home_product_rail', 'hmv_default_1', NULL,
  1, '2026-09-27T08:00:00.000Z', '2026-09-27T08:00:00.000Z'
);

INSERT INTO homepage_merchandising_versions (
  id, merchandising_id, version_number, enabled, mode, product_limit,
  heading, selected_storefront_node_id, created_by, created_at,
  published_at, superseded_at
) VALUES (
  'hmv_default_1', 'home_product_rail', 1, 0, 'NEW_ARRIVALS', 8,
  'Discover something new', NULL, 'card06-default',
  '2026-09-27T08:00:00.000Z', '2026-09-27T08:00:00.000Z', NULL
);
