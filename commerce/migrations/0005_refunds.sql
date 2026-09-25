-- Admin V2 P4: auditable manual refund ledger.
-- This table records refunds only after money has actually been returned externally.
-- It does not move funds.

CREATE TABLE refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'GBP' CHECK (length(currency) = 3),
  reason_code TEXT NOT NULL CHECK (
    reason_code IN (
      'CUSTOMER_CANCELLED',
      'ITEM_UNAVAILABLE',
      'QUANTITY_REDUCED',
      'RETURNED_GOODS',
      'FAULTY_OR_DAMAGED',
      'DELIVERY_ADJUSTMENT',
      'PRICE_CORRECTION',
      'GOODWILL',
      'OTHER'
    )
  ),
  refund_method TEXT NOT NULL CHECK (
    refund_method IN ('ORIGINAL_METHOD', 'BANK_TRANSFER', 'CASH', 'OTHER')
  ),
  external_reference TEXT,
  internal_note TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX idx_refunds_order_created
  ON refunds(order_id, created_at DESC);

CREATE INDEX idx_refunds_created
  ON refunds(created_at DESC);
