-- CARD 01 — Storefront Structure foundation.
-- Additive, compatibility-first migration.
-- This creates a distinct website hierarchy and version-aware Product placements.
-- It does NOT switch the live storefront, navigation or canonical URLs to this model.

CREATE TABLE storefront_nodes (
  id TEXT PRIMARY KEY,
  stable_key TEXT NOT NULL UNIQUE,
  publication_status TEXT NOT NULL
    CHECK (publication_status IN ('DRAFT','ACTIVE','ARCHIVED')),
  current_published_version_id TEXT,
  current_draft_version_id TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE INDEX idx_storefront_nodes_status_updated
  ON storefront_nodes(publication_status, updated_at DESC);

CREATE TABLE storefront_node_versions (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  parent_node_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  show_in_navigation INTEGER NOT NULL DEFAULT 0
    CHECK (show_in_navigation IN (0,1)),
  short_description TEXT,
  image_url TEXT,
  legacy_path TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT,
  superseded_at TEXT,
  UNIQUE(node_id, version_number),
  FOREIGN KEY (node_id) REFERENCES storefront_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_node_id) REFERENCES storefront_nodes(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX idx_storefront_live_slug
  ON storefront_node_versions(slug)
  WHERE published_at IS NOT NULL AND superseded_at IS NULL;

CREATE UNIQUE INDEX idx_storefront_one_live_version
  ON storefront_node_versions(node_id)
  WHERE published_at IS NOT NULL AND superseded_at IS NULL;

CREATE INDEX idx_storefront_node_versions_parent_sort
  ON storefront_node_versions(parent_node_id, sort_order, name);

CREATE TABLE product_version_storefront_placements (
  product_version_id TEXT NOT NULL,
  storefront_node_id TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  position INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'LEGACY_COMPAT'
    CHECK (source IN ('LEGACY_BACKFILL','LEGACY_COMPAT','OWNER')),
  created_at TEXT NOT NULL,
  PRIMARY KEY(product_version_id, storefront_node_id),
  FOREIGN KEY (product_version_id) REFERENCES product_versions(id) ON DELETE CASCADE,
  FOREIGN KEY (storefront_node_id) REFERENCES storefront_nodes(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX idx_product_storefront_one_primary
  ON product_version_storefront_placements(product_version_id)
  WHERE is_primary = 1;

CREATE INDEX idx_product_storefront_node_version
  ON product_version_storefront_placements(storefront_node_id, product_version_id);

-- Stable node identities. The hierarchy is deliberately separate from categories.
INSERT INTO storefront_nodes (
  id, stable_key, publication_status, current_published_version_id,
  current_draft_version_id, version, created_at, updated_at, archived_at
) VALUES
  ('sfn_gifts','gifts','ACTIVE','sfv_gifts_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfn_icecream','icecream','ACTIVE','sfv_icecream_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfn_romneys','romneys','ACTIVE','sfv_romneys_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfn_hawkshead','hawkshead','ACTIVE','sfv_hawkshead_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),

  ('sfn_gifts_peter_rabbit','gifts/peter-rabbit','ACTIVE','sfv_gifts_peter_rabbit_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfn_gifts_highland_cows','gifts/highland-cows','ACTIVE','sfv_gifts_highland_cows_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfn_gifts_mugs','gifts/mugs','ACTIVE','sfv_gifts_mugs_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfn_gifts_soft_toys','gifts/soft-toys','ACTIVE','sfv_gifts_soft_toys_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfn_gifts_cards','gifts/cards','ACTIVE','sfv_gifts_cards_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfn_gifts_seasonal','gifts/seasonal','ACTIVE','sfv_gifts_seasonal_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfn_gifts_keyrings_badges','gifts/keyrings-badges','ACTIVE','sfv_gifts_keyrings_badges_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfn_gifts_home_gifts','gifts/home-gifts','ACTIVE','sfv_gifts_home_gifts_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfn_gifts_toys_games','gifts/toys-games','ACTIVE','sfv_gifts_toys_games_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),

  ('sfn_romneys_mint_cake','romneys/mint-cake','ACTIVE','sfv_romneys_mint_cake_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfn_romneys_fudge','romneys/fudge','ACTIVE','sfv_romneys_fudge_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfn_romneys_biscuits','romneys/biscuits','ACTIVE','sfv_romneys_biscuits_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfn_romneys_sweets','romneys/sweets','ACTIVE','sfv_romneys_sweets_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfn_romneys_gift_boxes','romneys/gift-boxes','ACTIVE','sfv_romneys_gift_boxes_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),

  ('sfn_hawkshead_chutneys_pickles','hawkshead/chutneys-pickles','ACTIVE','sfv_hawkshead_chutneys_pickles_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfn_hawkshead_jams_preserves','hawkshead/jams-preserves','ACTIVE','sfv_hawkshead_jams_preserves_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfn_hawkshead_honey','hawkshead/honey','ACTIVE','sfv_hawkshead_honey_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfn_hawkshead_mustard','hawkshead/mustard','ACTIVE','sfv_hawkshead_mustard_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfn_hawkshead_savoury_sauces','hawkshead/savoury-sauces','ACTIVE','sfv_hawkshead_savoury_sauces_1',NULL,1,'2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL);

INSERT INTO storefront_node_versions (
  id, node_id, version_number, name, slug, parent_node_id, sort_order,
  show_in_navigation, short_description, image_url, legacy_path,
  created_by, created_at, published_at, superseded_at
) VALUES
  ('sfv_gifts_1','sfn_gifts',1,'Gifts & Souvenirs','gifts',NULL,10,1,NULL,NULL,'/gifts.html','card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfv_icecream_1','sfn_icecream',1,'Ice Cream','ice-cream',NULL,20,1,NULL,NULL,'/icecream.html','card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfv_romneys_1','sfn_romneys',1,'Romney''s','romneys',NULL,30,1,NULL,NULL,'/romneys.html','card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfv_hawkshead_1','sfn_hawkshead',1,'Hawkshead Relish','hawkshead-relish',NULL,40,1,NULL,NULL,'/hawkshead-relish.html','card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),

  ('sfv_gifts_peter_rabbit_1','sfn_gifts_peter_rabbit',1,'Peter Rabbit','peter-rabbit','sfn_gifts',10,0,NULL,'/images/peter-rabbit/peter-rabbit-medium.webp','/gifts-peter-rabbit.html','card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfv_gifts_highland_cows_1','sfn_gifts_highland_cows',1,'Highland Cows','highland-cows','sfn_gifts',20,0,NULL,'/images/highland-cows/highland-cow-flowers-lp73651.webp','/gifts-highland-cows.html','card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfv_gifts_mugs_1','sfn_gifts_mugs',1,'Mugs & Tableware','mugs','sfn_gifts',30,0,NULL,'/images/peter-rabbit/peter-rabbit-english-garden-mug.webp','/gifts-mugs.html','card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfv_gifts_soft_toys_1','sfn_gifts_soft_toys',1,'Soft Toys','soft-toys','sfn_gifts',40,0,NULL,'/images/peter-rabbit/peter-rabbit-medium.webp','/gifts-soft-toys.html','card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfv_gifts_cards_1','sfn_gifts_cards',1,'Cards & Stationery','cards','sfn_gifts',50,0,NULL,'/images/peter-rabbit/beatrix-potter-stationery-set.webp','/gifts-cards.html','card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfv_gifts_seasonal_1','sfn_gifts_seasonal',1,'Christmas','seasonal','sfn_gifts',60,0,NULL,'/images/peter-rabbit/peter-rabbit-christmas-bauble.webp','/gifts-seasonal.html','card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfv_gifts_keyrings_badges_1','sfn_gifts_keyrings_badges',1,'Keyrings & Badges','keyrings-badges','sfn_gifts',70,0,NULL,'/images/peter-rabbit/peter-rabbit-keyring.webp','/gifts-keyrings-badges.html','card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfv_gifts_home_gifts_1','sfn_gifts_home_gifts',1,'Home Gifts & Art','home-gifts','sfn_gifts',80,0,NULL,'/images/highland-cows/highland-cow-flowers-lp73651.webp','/gifts-home-art.html','card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfv_gifts_toys_games_1','sfn_gifts_toys_games',1,'Toys & Games','toys-games','sfn_gifts',90,0,NULL,'/images/peter-rabbit/peter-rabbit-playing-cards.webp','/gifts-toys-games.html','card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),

  ('sfv_romneys_mint_cake_1','sfn_romneys_mint_cake',1,'Mint Cake','mint-cake','sfn_romneys',10,0,NULL,NULL,NULL,'card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfv_romneys_fudge_1','sfn_romneys_fudge',1,'Fudge','fudge','sfn_romneys',20,0,NULL,NULL,NULL,'card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfv_romneys_biscuits_1','sfn_romneys_biscuits',1,'Biscuits','biscuits','sfn_romneys',30,0,NULL,NULL,NULL,'card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfv_romneys_sweets_1','sfn_romneys_sweets',1,'Sweets','sweets','sfn_romneys',40,0,NULL,NULL,NULL,'card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfv_romneys_gift_boxes_1','sfn_romneys_gift_boxes',1,'Gift Boxes','gift-boxes','sfn_romneys',50,0,NULL,NULL,NULL,'card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),

  ('sfv_hawkshead_chutneys_pickles_1','sfn_hawkshead_chutneys_pickles',1,'Chutneys & Pickles','chutneys-pickles','sfn_hawkshead',10,0,NULL,NULL,NULL,'card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfv_hawkshead_jams_preserves_1','sfn_hawkshead_jams_preserves',1,'Jams & Preserves','jams-preserves','sfn_hawkshead',20,0,NULL,NULL,NULL,'card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfv_hawkshead_honey_1','sfn_hawkshead_honey',1,'Honey','honey','sfn_hawkshead',30,0,NULL,NULL,NULL,'card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfv_hawkshead_mustard_1','sfn_hawkshead_mustard',1,'Mustard','mustard','sfn_hawkshead',40,0,NULL,NULL,NULL,'card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL),
  ('sfv_hawkshead_savoury_sauces_1','sfn_hawkshead_savoury_sauces',1,'Savoury Sauces','savoury-sauces','sfn_hawkshead',50,0,NULL,NULL,NULL,'card01-backfill','2026-09-26T20:00:00.000Z','2026-09-26T20:00:00.000Z',NULL);

-- Primary placement: use the legacy primary category when it maps to a
-- storefront destination; otherwise fall back to the legacy Product type root.
WITH
root_map(product_type, node_id) AS (
  VALUES
    ('gifts','sfn_gifts'),
    ('icecream','sfn_icecream'),
    ('romneys','sfn_romneys'),
    ('hawkshead','sfn_hawkshead')
),
category_map(category_slug, node_id) AS (
  VALUES
    ('peter-rabbit','sfn_gifts_peter_rabbit'),
    ('highland-cows','sfn_gifts_highland_cows'),
    ('mugs','sfn_gifts_mugs'),
    ('soft-toys','sfn_gifts_soft_toys'),
    ('cards','sfn_gifts_cards'),
    ('seasonal','sfn_gifts_seasonal'),
    ('keyrings-badges','sfn_gifts_keyrings_badges'),
    ('home-gifts','sfn_gifts_home_gifts'),
    ('toys-games','sfn_gifts_toys_games'),
    ('romneys','sfn_romneys'),
    ('local-food','sfn_romneys'),
    ('mint-cake','sfn_romneys_mint_cake'),
    ('fudge','sfn_romneys_fudge'),
    ('biscuits','sfn_romneys_biscuits'),
    ('sweets','sfn_romneys_sweets'),
    ('gift-boxes','sfn_romneys_gift_boxes'),
    ('icecream','sfn_icecream'),
    ('hawkshead','sfn_hawkshead'),
    ('chutneys-pickles','sfn_hawkshead_chutneys_pickles'),
    ('jams-preserves','sfn_hawkshead_jams_preserves'),
    ('honey','sfn_hawkshead_honey'),
    ('mustard','sfn_hawkshead_mustard'),
    ('savoury-sauces','sfn_hawkshead_savoury_sauces')
),
primary_source AS (
  SELECT
    pv.id AS product_version_id,
    pv.product_type,
    (
      SELECT c.slug
      FROM product_version_categories pvc
      JOIN categories c ON c.id = pvc.category_id
      WHERE pvc.product_version_id = pv.id
      ORDER BY pvc.is_primary DESC, pvc.position ASC, c.slug ASC
      LIMIT 1
    ) AS category_slug
  FROM product_versions pv
),
primary_target AS (
  SELECT
    ps.product_version_id,
    COALESCE(cm.node_id, rm.node_id) AS node_id
  FROM primary_source ps
  LEFT JOIN category_map cm ON cm.category_slug = ps.category_slug
  LEFT JOIN root_map rm ON rm.product_type = ps.product_type
  WHERE COALESCE(cm.node_id, rm.node_id) IS NOT NULL
)
INSERT OR IGNORE INTO product_version_storefront_placements (
  product_version_id, storefront_node_id, is_primary, position, source, created_at
)
SELECT
  product_version_id, node_id, 1, 0, 'LEGACY_BACKFILL', '2026-09-26T20:00:00.000Z'
FROM primary_target;

-- Additional placements preserve every legacy category that maps to a real
-- storefront destination. Duplicate root/category mappings are ignored by PK.
WITH category_map(category_slug, node_id) AS (
  VALUES
    ('peter-rabbit','sfn_gifts_peter_rabbit'),
    ('highland-cows','sfn_gifts_highland_cows'),
    ('mugs','sfn_gifts_mugs'),
    ('soft-toys','sfn_gifts_soft_toys'),
    ('cards','sfn_gifts_cards'),
    ('seasonal','sfn_gifts_seasonal'),
    ('keyrings-badges','sfn_gifts_keyrings_badges'),
    ('home-gifts','sfn_gifts_home_gifts'),
    ('toys-games','sfn_gifts_toys_games'),
    ('romneys','sfn_romneys'),
    ('local-food','sfn_romneys'),
    ('mint-cake','sfn_romneys_mint_cake'),
    ('fudge','sfn_romneys_fudge'),
    ('biscuits','sfn_romneys_biscuits'),
    ('sweets','sfn_romneys_sweets'),
    ('gift-boxes','sfn_romneys_gift_boxes'),
    ('icecream','sfn_icecream'),
    ('hawkshead','sfn_hawkshead'),
    ('chutneys-pickles','sfn_hawkshead_chutneys_pickles'),
    ('jams-preserves','sfn_hawkshead_jams_preserves'),
    ('honey','sfn_hawkshead_honey'),
    ('mustard','sfn_hawkshead_mustard'),
    ('savoury-sauces','sfn_hawkshead_savoury_sauces')
)
INSERT OR IGNORE INTO product_version_storefront_placements (
  product_version_id, storefront_node_id, is_primary, position, source, created_at
)
SELECT
  pvc.product_version_id,
  cm.node_id,
  0,
  100 + pvc.position,
  'LEGACY_BACKFILL',
  '2026-09-26T20:00:00.000Z'
FROM product_version_categories pvc
JOIN categories c ON c.id = pvc.category_id
JOIN category_map cm ON cm.category_slug = c.slug;
