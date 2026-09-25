-- Phase 4 — Inventory Core.
-- Forward-only additive migration for staging validation first.
-- No existing product gets an inferred quantity and no variant is auto-enabled for tracking.

ALTER TABLE product_variants
  ADD COLUMN inventory_mutation_token TEXT;

CREATE TABLE inventory_balances (
  variant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  on_hand INTEGER NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  safety_stock INTEGER NOT NULL DEFAULT 0 CHECK (safety_stock >= 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  mutation_token TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (variant_id, location_id),
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT,
  FOREIGN KEY (location_id) REFERENCES inventory_locations(id) ON DELETE RESTRICT
);

CREATE INDEX idx_inventory_balances_location
  ON inventory_balances(location_id, variant_id);

CREATE TABLE inventory_movements (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  movement_type TEXT NOT NULL CHECK (
    movement_type IN (
      'INITIAL_COUNT',
      'MANUAL_ADJUSTMENT',
      'ORDER_RESERVATION',
      'RESERVATION_RELEASE',
      'SALE',
      'RETURN',
      'DAMAGE',
      'LOSS',
      'SUPPLIER_RECEIPT',
      'SAFETY_STOCK_CHANGE',
      'CORRECTION'
    )
  ),
  on_hand_delta INTEGER NOT NULL DEFAULT 0,
  reserved_delta INTEGER NOT NULL DEFAULT 0,
  safety_stock_delta INTEGER NOT NULL DEFAULT 0,
  reason_code TEXT NOT NULL,
  note TEXT,
  order_id TEXT,
  order_revision_id TEXT,
  reservation_id TEXT,
  incoming_id TEXT,
  batch_id TEXT,
  idempotency_key TEXT,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  created_at TEXT NOT NULL,
  balance_on_hand_after INTEGER NOT NULL CHECK (balance_on_hand_after >= 0),
  balance_reserved_after INTEGER NOT NULL CHECK (balance_reserved_after >= 0),
  balance_safety_after INTEGER NOT NULL CHECK (balance_safety_after >= 0),
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT,
  FOREIGN KEY (location_id) REFERENCES inventory_locations(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX idx_inventory_movements_idempotency
  ON inventory_movements(idempotency_key)
  WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';

CREATE UNIQUE INDEX idx_inventory_movements_initial_count
  ON inventory_movements(variant_id, location_id)
  WHERE movement_type = 'INITIAL_COUNT';

CREATE INDEX idx_inventory_movements_variant_created
  ON inventory_movements(variant_id, created_at DESC);

CREATE INDEX idx_inventory_movements_location_created
  ON inventory_movements(location_id, created_at DESC);

CREATE INDEX idx_inventory_movements_batch
  ON inventory_movements(batch_id)
  WHERE batch_id IS NOT NULL;

CREATE TRIGGER inventory_movements_immutable_update
BEFORE UPDATE ON inventory_movements
BEGIN
  SELECT RAISE(ABORT, 'inventory_movements_are_immutable');
END;

CREATE TRIGGER inventory_movements_immutable_delete
BEFORE DELETE ON inventory_movements
BEGIN
  SELECT RAISE(ABORT, 'inventory_movements_are_immutable');
END;

CREATE TABLE inventory_incoming (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('MANUAL','PURCHASE_ORDER','TRANSFER')),
  source_id TEXT,
  expected_quantity INTEGER NOT NULL CHECK (expected_quantity > 0),
  received_quantity INTEGER NOT NULL DEFAULT 0 CHECK (
    received_quantity >= 0 AND received_quantity <= expected_quantity
  ),
  expected_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('OPEN','PARTIAL','RECEIVED','CANCELLED')),
  note TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT,
  FOREIGN KEY (location_id) REFERENCES inventory_locations(id) ON DELETE RESTRICT
);

CREATE INDEX idx_inventory_incoming_variant_status
  ON inventory_incoming(variant_id, status, expected_at);

CREATE INDEX idx_inventory_incoming_location_status
  ON inventory_incoming(location_id, status, expected_at);
