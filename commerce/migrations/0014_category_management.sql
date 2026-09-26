-- Category Manager foundation.
-- Persist the owner-facing category group instead of inferring it from category names.

ALTER TABLE categories
  ADD COLUMN category_type TEXT NOT NULL DEFAULT 'PRODUCT_CATEGORY'
  CHECK (category_type IN ('BRAND_RANGE','PRODUCT_CATEGORY','COLLECTION_THEME'));

UPDATE categories
SET category_type = 'BRAND_RANGE'
WHERE LOWER(name) IN (
  'hawkshead relish',
  'peter rabbit',
  'romney''s'
);

UPDATE categories
SET category_type = 'COLLECTION_THEME'
WHERE LOWER(name) IN (
  'gift boxes',
  'highland cows',
  'home & gifts',
  'seasonal'
);

CREATE INDEX idx_categories_type_active_sort
  ON categories(category_type, active, sort_order, name);
