-- Admin V2 Phase 8: concurrency and idempotency guards.
-- These fields let a D1 batch prove which concurrent mutation actually won.

ALTER TABLE order_revisions
  ADD COLUMN mutation_token TEXT;

ALTER TABLE orders
  ADD COLUMN refund_version INTEGER NOT NULL DEFAULT 0 CHECK (refund_version >= 0);

ALTER TABLE orders
  ADD COLUMN refund_mutation_token TEXT;

ALTER TABLE refunds
  ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX idx_refunds_order_idempotency
  ON refunds(order_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE email_webhook_events
  ADD COLUMN claim_token TEXT;
