-- Product & Inventory Phase 1 foundation.
-- Additive/read-only foundation only. No existing commerce tables are modified.
-- Production application of this migration is NOT part of Phase 1.

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  legacy_catalog_id TEXT UNIQUE,
  current_slug TEXT NOT NULL UNIQUE,
  publication_status TEXT NOT NULL CHECK (publication_status IN ('DRAFT','ACTIVE','ARCHIVED')),
  sell_status TEXT NOT NULL DEFAULT 'AUTO'
    CHECK (sell_status IN ('AUTO','OUT_OF_STOCK','ARRIVING_SOON','NOT_FOR_SALE')),
  online_ordering_enabled INTEGER NOT NULL DEFAULT 1 CHECK (online_ordering_enabled IN (0,1)),
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0,1)),
  current_published_version_id TEXT,
  current_draft_version_id TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE INDEX idx_products_publication_status
  ON products(publication_status, updated_at DESC);
CREATE INDEX idx_products_sell_status
  ON products(sell_status, updated_at DESC);

CREATE TABLE product_slugs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  created_at TEXT NOT NULL,
  retired_at TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_product_slugs_one_primary
  ON product_slugs(product_id)
  WHERE is_primary = 1 AND retired_at IS NULL;

CREATE TABLE product_versions (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  title TEXT NOT NULL,
  short_description TEXT NOT NULL,
  long_description TEXT,
  brand TEXT,
  collection_label TEXT,
  product_type TEXT NOT NULL,
  public_note TEXT,
  seo_title TEXT,
  seo_description TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT,
  superseded_at TEXT,
  UNIQUE(product_id, version_number),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_product_versions_product
  ON product_versions(product_id, version_number DESC);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_id TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);

CREATE TABLE product_version_categories (
  product_version_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(product_version_id, category_id),
  FOREIGN KEY (product_version_id) REFERENCES product_versions(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE INDEX idx_product_version_categories_category
  ON product_version_categories(category_id, product_version_id);

CREATE TABLE product_source_records (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('OWNER','OFFICIAL','SUPPLIER','LEGACY','OTHER')),
  source_name TEXT,
  source_url TEXT,
  supplier_url TEXT,
  external_product_code TEXT,
  confidence TEXT,
  source_status TEXT,
  notes TEXT,
  verified_at TEXT,
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_product_source_records_product
  ON product_source_records(product_id, source_type);

CREATE TABLE product_attributes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_version_id TEXT NOT NULL,
  attribute_key TEXT NOT NULL,
  label TEXT NOT NULL,
  value_text TEXT,
  value_json TEXT,
  visibility TEXT NOT NULL DEFAULT 'PUBLIC'
    CHECK (visibility IN ('PUBLIC','ADMIN')),
  position INTEGER NOT NULL DEFAULT 0,
  source_record_id TEXT,
  UNIQUE(product_version_id, attribute_key),
  FOREIGN KEY (product_version_id) REFERENCES product_versions(id) ON DELETE CASCADE,
  FOREIGN KEY (source_record_id) REFERENCES product_source_records(id)
);

CREATE TABLE product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Default',
  sku TEXT,
  barcode TEXT,
  price_minor INTEGER CHECK (price_minor IS NULL OR price_minor >= 0),
  compare_at_price_minor INTEGER CHECK (compare_at_price_minor IS NULL OR compare_at_price_minor >= 0),
  cost_minor INTEGER CHECK (cost_minor IS NULL OR cost_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'GBP',
  track_inventory INTEGER NOT NULL DEFAULT 0 CHECK (track_inventory IN (0,1)),
  low_stock_threshold INTEGER CHECK (low_stock_threshold IS NULL OR low_stock_threshold >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_product_variants_sku
  ON product_variants(sku)
  WHERE sku IS NOT NULL AND sku <> '';

CREATE UNIQUE INDEX idx_product_variants_barcode
  ON product_variants(barcode)
  WHERE barcode IS NOT NULL AND barcode <> '';

CREATE UNIQUE INDEX idx_product_variants_one_default
  ON product_variants(product_id)
  WHERE is_default = 1 AND active = 1;

CREATE INDEX idx_product_variants_product
  ON product_variants(product_id, active);

CREATE TABLE product_media (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  storage_provider TEXT NOT NULL CHECK (storage_provider IN ('LEGACY_REPO','R2')),
  storage_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  checksum_sha256 TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id)
);

CREATE INDEX idx_product_media_product
  ON product_media(product_id, created_at);

CREATE TABLE product_version_media (
  product_version_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  alt_text TEXT,
  display_fit TEXT CHECK (display_fit IS NULL OR display_fit IN ('CONTAIN','COVER')),
  PRIMARY KEY(product_version_id, media_id),
  FOREIGN KEY (product_version_id) REFERENCES product_versions(id) ON DELETE CASCADE,
  FOREIGN KEY (media_id) REFERENCES product_media(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_product_version_media_one_primary
  ON product_version_media(product_version_id)
  WHERE is_primary = 1;

CREATE TABLE product_audit_events (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  request_id TEXT,
  idempotency_key TEXT,
  before_json TEXT,
  after_json TEXT,
  reason TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id)
);

CREATE INDEX idx_product_audit_events_product_created
  ON product_audit_events(product_id, created_at DESC);

CREATE TABLE inventory_locations (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO inventory_locations (
  id, code, name, active, created_at, updated_at
) VALUES (
  'loc_ambleside',
  'AMBLESIDE',
  'Black Sheep Shop — Ambleside',
  1,
  '2026-09-25T00:00:00.000Z',
  '2026-09-25T00:00:00.000Z'
);
