CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  public_reference TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (
    status IN (
      'SUBMITTED',
      'UNDER_REVIEW',
      'QUOTED',
      'AWAITING_PAYMENT',
      'PAID',
      'PREPARING',
      'SHIPPED',
      'READY_FOR_COLLECTION',
      'COMPLETED',
      'CANCELLED'
    )
  ),
  currency TEXT NOT NULL DEFAULT 'GBP' CHECK (length(currency) = 3),
  fulfilment_method TEXT NOT NULL CHECK (fulfilment_method IN ('delivery', 'collection')),
  customer_name TEXT NOT NULL CHECK (length(trim(customer_name)) BETWEEN 1 AND 120),
  customer_email TEXT NOT NULL CHECK (length(trim(customer_email)) BETWEEN 3 AND 254),
  customer_phone TEXT,
  delivery_address_line1 TEXT,
  delivery_address_line2 TEXT,
  delivery_town TEXT,
  delivery_county TEXT,
  delivery_postcode TEXT,
  delivery_country TEXT CHECK (delivery_country IS NULL OR length(delivery_country) = 2),
  customer_note TEXT,
  items_subtotal_minor INTEGER NOT NULL CHECK (items_subtotal_minor >= 0),
  delivery_amount_minor INTEGER CHECK (delivery_amount_minor IS NULL OR delivery_amount_minor >= 0),
  final_total_minor INTEGER CHECK (final_total_minor IS NULL OR final_total_minor >= 0),
  payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (
    payment_status IN ('UNPAID', 'PAYMENT_REQUESTED', 'PAID', 'REFUNDED', 'FAILED', 'CANCELLED')
  ),
  payment_provider TEXT,
  payment_reference TEXT,
  payment_request_url TEXT,
  tracking_reference TEXT,
  tracking_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  quoted_at TEXT,
  paid_at TEXT,
  shipped_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  CHECK (
    fulfilment_method = 'collection'
    OR (
      delivery_address_line1 IS NOT NULL
      AND length(trim(delivery_address_line1)) > 0
      AND delivery_town IS NOT NULL
      AND length(trim(delivery_town)) > 0
      AND delivery_postcode IS NOT NULL
      AND length(trim(delivery_postcode)) > 0
      AND delivery_country IS NOT NULL
    )
  )
);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  catalog_product_id TEXT NOT NULL,
  sku TEXT,
  slug TEXT NOT NULL,
  product_name TEXT NOT NULL,
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  line_total_minor INTEGER NOT NULL CHECK (line_total_minor >= 0),
  options_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  UNIQUE (order_id, line_number),
  CHECK (line_total_minor = unit_price_minor * quantity)
);

CREATE TABLE order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('system', 'customer', 'admin', 'payment_provider')),
  actor_id TEXT,
  note TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX idx_orders_status_created
  ON orders(status, created_at DESC);

CREATE INDEX idx_orders_customer_email_created
  ON orders(customer_email, created_at DESC);

CREATE INDEX idx_order_items_order
  ON order_items(order_id, line_number);

CREATE INDEX idx_order_events_order_created
  ON order_events(order_id, created_at);
