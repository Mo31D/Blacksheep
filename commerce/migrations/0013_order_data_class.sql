-- Final Owner Polish — order data classification and safe clean-start support.
-- Owner confirmed on 26 September 2026 that every order existing before this
-- migration is test/development data. Preserve that audit history, but remove it
-- from normal business views and reports. Future Production orders default to
-- BUSINESS; the staging order route explicitly writes TEST.

ALTER TABLE orders
  ADD COLUMN data_class TEXT NOT NULL DEFAULT 'BUSINESS'
  CHECK (data_class IN ('BUSINESS','TEST','E2E'));

ALTER TABLE orders
  ADD COLUMN admin_hidden_at TEXT;

CREATE INDEX idx_orders_data_class_created
  ON orders(data_class, admin_hidden_at, created_at DESC);

-- One-time clean start. Non-destructive by design: historical test records remain
-- available for audit/debugging, while owner-facing business data starts at zero.
UPDATE orders
SET data_class = 'TEST',
    admin_hidden_at = strftime('%Y-%m-%dT%H:%M:%fZ','now');
