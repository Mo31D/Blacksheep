-- Phase 5 — Order Reservations foundation.
-- Forward-only additive migration for staging validation first.
-- This migration creates reservation structures only:
-- it does NOT reserve stock, mutate inventory balances, create movements,
-- change existing order/revision state, or enable storefront inventory authority.

CREATE TABLE inventory_reservations (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  revision_id TEXT NOT NULL UNIQUE,
  location_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (
    state IN ('ACTIVE','COMMITTED','RELEASED','EXPIRED','CONSUMED')
  ),
  expires_at TEXT NOT NULL,
  committed_at TEXT,
  released_at TEXT,
  consumed_at TEXT,
  release_reason TEXT CHECK (
    release_reason IS NULL OR length(trim(release_reason)) BETWEEN 1 AND 240
  ),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  mutation_token TEXT NOT NULL CHECK (length(trim(mutation_token)) > 0),
  idempotency_key TEXT NOT NULL CHECK (length(trim(idempotency_key)) > 0),
  created_by TEXT NOT NULL CHECK (length(trim(created_by)) > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  FOREIGN KEY (revision_id) REFERENCES order_revisions(id) ON DELETE RESTRICT,
  FOREIGN KEY (location_id) REFERENCES inventory_locations(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX idx_inventory_reservations_idempotency
  ON inventory_reservations(idempotency_key);

CREATE INDEX idx_inventory_reservations_order_state
  ON inventory_reservations(order_id, state, created_at DESC);

CREATE INDEX idx_inventory_reservations_state_expiry
  ON inventory_reservations(state, expires_at);

CREATE INDEX idx_inventory_reservations_location_state
  ON inventory_reservations(location_id, state, expires_at);

CREATE TABLE inventory_reservation_items (
  id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL,
  revision_item_id INTEGER NOT NULL UNIQUE,
  variant_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TEXT NOT NULL,
  FOREIGN KEY (reservation_id) REFERENCES inventory_reservations(id) ON DELETE RESTRICT,
  FOREIGN KEY (revision_item_id) REFERENCES order_revision_items(id) ON DELETE RESTRICT,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT
);

CREATE INDEX idx_inventory_reservation_items_reservation
  ON inventory_reservation_items(reservation_id, id);

CREATE INDEX idx_inventory_reservation_items_variant
  ON inventory_reservation_items(variant_id, reservation_id);

-- Reservation item membership is historical truth once created.
-- Quantity changes are represented by releasing/superseding a reservation,
-- never by rewriting the original reservation line.
CREATE TRIGGER inventory_reservation_items_immutable_update
BEFORE UPDATE ON inventory_reservation_items
BEGIN
  SELECT RAISE(ABORT, 'inventory_reservation_items_are_immutable');
END;

CREATE TRIGGER inventory_reservation_items_immutable_delete
BEFORE DELETE ON inventory_reservation_items
BEGIN
  SELECT RAISE(ABORT, 'inventory_reservation_items_are_immutable');
END;
