-- Admin V2 P7: verified email delivery telemetry.
-- Stores only delivery metadata required for deduplication/audit; raw webhook payloads are not retained.

CREATE TABLE email_webhook_events (
  webhook_event_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  provider_message_id TEXT,
  received_at TEXT NOT NULL,
  provider_created_at TEXT
);

CREATE INDEX idx_email_webhook_provider_message
  ON email_webhook_events(provider, provider_message_id);

CREATE INDEX idx_email_webhook_received
  ON email_webhook_events(received_at DESC);
