-- Admin V2 P1A: immutable order revision foundation.
-- Existing orders/order_items remain the original customer request.

CREATE TABLE order_revisions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  state TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
    state IN ('DRAFT', 'SENT', 'SUPERSEDED', 'ACCEPTED', 'DECLINED', 'EXPIRED')
  ),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  currency TEXT NOT NULL DEFAULT 'GBP' CHECK (length(currency) = 3),
  items_subtotal_minor INTEGER NOT NULL CHECK (items_subtotal_minor >= 0),
  delivery_amount_minor INTEGER CHECK (
    delivery_amount_minor IS NULL OR delivery_amount_minor >= 0
  ),
  adjustment_amount_minor INTEGER NOT NULL DEFAULT 0,
  final_total_minor INTEGER CHECK (
    final_total_minor IS NULL OR final_total_minor >= 0
  ),
  customer_message TEXT,
  internal_note TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  accepted_at TEXT,
  declined_at TEXT,
  superseded_at TEXT,
  expires_at TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  UNIQUE (order_id, revision_number)
);

CREATE TABLE order_revision_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  revision_id TEXT NOT NULL,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  source_order_item_id INTEGER,
  catalog_product_id TEXT NOT NULL,
  sku TEXT,
  slug TEXT NOT NULL,
  product_name TEXT NOT NULL,
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
  requested_quantity INTEGER NOT NULL CHECK (requested_quantity BETWEEN 0 AND 99),
  confirmed_quantity INTEGER NOT NULL CHECK (confirmed_quantity BETWEEN 0 AND 99),
  availability_status TEXT NOT NULL CHECK (
    availability_status IN ('CONFIRMED', 'REDUCED', 'UNAVAILABLE', 'SUBSTITUTE', 'ADDED')
  ),
  reason_code TEXT,
  customer_note TEXT,
  internal_note TEXT,
  line_total_minor INTEGER NOT NULL CHECK (line_total_minor >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (revision_id) REFERENCES order_revisions(id) ON DELETE CASCADE,
  FOREIGN KEY (source_order_item_id) REFERENCES order_items(id) ON DELETE SET NULL,
  UNIQUE (revision_id, line_number),
  CHECK (line_total_minor = unit_price_minor * confirmed_quantity),
  CHECK (availability_status <> 'UNAVAILABLE' OR confirmed_quantity = 0),
  CHECK (availability_status <> 'REDUCED' OR confirmed_quantity < requested_quantity),
  CHECK (availability_status <> 'ADDED' OR requested_quantity = 0)
);

CREATE TABLE order_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  revision_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (
    kind IN ('DISCOUNT', 'SURCHARGE', 'MANUAL_CORRECTION')
  ),
  label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 120),
  amount_minor INTEGER NOT NULL CHECK (amount_minor <> 0),
  internal_reason TEXT NOT NULL CHECK (length(trim(internal_reason)) BETWEEN 1 AND 500),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (revision_id) REFERENCES order_revisions(id) ON DELETE CASCADE
);

CREATE INDEX idx_order_revisions_order_number
  ON order_revisions(order_id, revision_number DESC);

CREATE INDEX idx_order_revisions_state
  ON order_revisions(state, created_at DESC);

CREATE UNIQUE INDEX idx_order_revisions_one_sent
  ON order_revisions(order_id)
  WHERE state = 'SENT';

CREATE INDEX idx_order_revision_items_revision
  ON order_revision_items(revision_id, line_number);

CREATE INDEX idx_order_adjustments_revision
  ON order_adjustments(revision_id, id);
