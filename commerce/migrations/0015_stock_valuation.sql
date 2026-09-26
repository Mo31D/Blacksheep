-- Stock Value & supplier intelligence foundation.
-- Cost policy:
--   product_variants.cost_minor = actual unit cost EX VAT when known.
--   When cost_minor is NULL, valuation falls back to retail / 2 inc VAT,
--   then removes the product VAT rate to estimate cost ex VAT.
-- Default VAT is 20% (2000 basis points). All estimate outputs are labelled estimated.

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_suppliers_active_name
  ON suppliers(active, name COLLATE NOCASE);

ALTER TABLE product_variants
  ADD COLUMN supplier_id TEXT;

ALTER TABLE product_variants
  ADD COLUMN supplier_product_code TEXT;

ALTER TABLE product_variants
  ADD COLUMN vat_rate_basis_points INTEGER NOT NULL DEFAULT 2000
    CHECK (vat_rate_basis_points >= 0 AND vat_rate_basis_points <= 10000);

CREATE INDEX idx_product_variants_supplier
  ON product_variants(supplier_id, active);

CREATE TABLE inventory_valuation_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_date TEXT NOT NULL,
  location_id TEXT NOT NULL,
  on_hand_units INTEGER NOT NULL DEFAULT 0,
  reserved_units INTEGER NOT NULL DEFAULT 0,
  sellable_units INTEGER NOT NULL DEFAULT 0,
  cost_value_ex_vat_minor INTEGER NOT NULL DEFAULT 0,
  cost_value_inc_vat_minor INTEGER NOT NULL DEFAULT 0,
  retail_value_inc_vat_minor INTEGER NOT NULL DEFAULT 0,
  retail_value_ex_vat_minor INTEGER NOT NULL DEFAULT 0,
  reserved_retail_value_minor INTEGER NOT NULL DEFAULT 0,
  sellable_retail_value_minor INTEGER NOT NULL DEFAULT 0,
  potential_gross_profit_minor INTEGER NOT NULL DEFAULT 0,
  tracked_variants INTEGER NOT NULL DEFAULT 0,
  actual_cost_variants INTEGER NOT NULL DEFAULT 0,
  estimated_cost_variants INTEGER NOT NULL DEFAULT 0,
  missing_valuation_variants INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(snapshot_date, location_id)
);

CREATE INDEX idx_inventory_valuation_snapshots_location_date
  ON inventory_valuation_snapshots(location_id, snapshot_date);
