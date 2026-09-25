-- Admin V2 P6/P3: secure customer review tokens and auditable message history.

CREATE TABLE customer_review_tokens (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_used_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (revision_id) REFERENCES order_revisions(id) ON DELETE CASCADE
);

CREATE INDEX idx_customer_review_tokens_order
  ON customer_review_tokens(order_id, created_at DESC);

CREATE INDEX idx_customer_review_tokens_revision
  ON customer_review_tokens(revision_id, created_at DESC);

CREATE TABLE order_messages (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  revision_id TEXT,
  direction TEXT NOT NULL CHECK (
    direction IN ('SHOP_TO_CUSTOMER', 'CUSTOMER_TO_SHOP')
  ),
  kind TEXT NOT NULL CHECK (
    kind IN (
      'CUSTOMER_QUESTION',
      'CUSTOM_MESSAGE',
      'AVAILABILITY_UPDATE',
      'PAYMENT_REMINDER',
      'SYSTEM_NOTIFICATION'
    )
  ),
  subject TEXT,
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
  delivery_status TEXT NOT NULL DEFAULT 'RECORDED' CHECK (
    delivery_status IN (
      'RECORDED',
      'QUEUED',
      'SENT',
      'DELIVERED',
      'DELAYED',
      'BOUNCED',
      'COMPLAINED',
      'FAILED'
    )
  ),
  provider TEXT,
  provider_message_id TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  delivered_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (revision_id) REFERENCES order_revisions(id) ON DELETE SET NULL
);

CREATE INDEX idx_order_messages_order_created
  ON order_messages(order_id, created_at DESC);

CREATE INDEX idx_order_messages_provider_message
  ON order_messages(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX idx_order_messages_delivery_status
  ON order_messages(delivery_status, updated_at DESC);
