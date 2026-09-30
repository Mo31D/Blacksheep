-- Versioned Homepage card selections reference canonical Storefront Structure nodes.
-- Names, images and routes remain owned by the referenced node versions.
CREATE TABLE homepage_merchandising_cards (
  version_id TEXT NOT NULL,
  module_key TEXT NOT NULL CHECK (module_key IN ('COLLECTIONS','LOCAL_FAVOURITES')),
  storefront_node_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (version_id, module_key, storefront_node_id),
  FOREIGN KEY (version_id) REFERENCES homepage_merchandising_versions(id) ON DELETE CASCADE,
  FOREIGN KEY (storefront_node_id) REFERENCES storefront_nodes(id) ON DELETE RESTRICT
);

CREATE INDEX idx_homepage_merchandising_cards_order
  ON homepage_merchandising_cards(version_id, module_key, position);

INSERT INTO homepage_merchandising_cards (version_id, module_key, storefront_node_id, position)
SELECT v.id, 'COLLECTIONS', d.node_id, d.position
FROM homepage_merchandising_versions v
CROSS JOIN (
  SELECT 'sfn_gifts_peter_rabbit' AS node_id, 10 AS position UNION ALL
  SELECT 'sfn_gifts_highland_cows', 20 UNION ALL
  SELECT 'sfn_gifts_mugs', 30 UNION ALL
  SELECT 'sfn_gifts_soft_toys', 40 UNION ALL
  SELECT 'sfn_gifts_cards', 50 UNION ALL
  SELECT 'sfn_gifts_seasonal', 60
) d;

INSERT INTO homepage_merchandising_cards (version_id, module_key, storefront_node_id, position)
SELECT v.id, 'LOCAL_FAVOURITES', d.node_id, d.position
FROM homepage_merchandising_versions v
CROSS JOIN (
  SELECT 'sfn_icecream' AS node_id, 10 AS position UNION ALL
  SELECT 'sfn_romneys', 20 UNION ALL
  SELECT 'sfn_hawkshead', 30
) d;
