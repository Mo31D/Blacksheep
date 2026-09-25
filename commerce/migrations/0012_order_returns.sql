-- Phase 5 — explicit return-to-stock marker.
-- Additive staging-first migration.
-- A consumed reservation may be returned to stock once after financial refund.
-- The reservation remains CONSUMED as historical fulfilment truth; returned_at
-- records that physical stock was explicitly put back.

ALTER TABLE inventory_reservations
  ADD COLUMN returned_at TEXT;

CREATE INDEX idx_inventory_reservations_returned
  ON inventory_reservations(state, returned_at, updated_at);
