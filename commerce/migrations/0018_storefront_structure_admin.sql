-- CARD 02 — Storefront Structure Admin audit foundation.
-- Additive only. The public storefront still does not read Storefront Structure.

CREATE TABLE storefront_audit_events (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('NODE_CREATED','NODE_UPDATED','NODE_MOVED','NODE_ARCHIVED','NODE_RESTORED')),
  actor_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  reason TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (node_id) REFERENCES storefront_nodes(id) ON DELETE RESTRICT
);

CREATE INDEX idx_storefront_audit_node_created
  ON storefront_audit_events(node_id, created_at DESC);

CREATE INDEX idx_storefront_audit_event_created
  ON storefront_audit_events(event_type, created_at DESC);
