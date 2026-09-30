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

INSERT INTO homepage_merchandising_cards SELECT id, 'COLLECTIONS', 'sfn_gifts_peter_rabbit', 10 FROM homepage_merchandising_versions;
INSERT INTO homepage_merchandising_cards SELECT id, 'COLLECTIONS', 'sfn_gifts_highland_cows', 20 FROM homepage_merchandising_versions;
INSERT INTO homepage_merchandising_cards SELECT id, 'COLLECTIONS', 'sfn_gifts_mugs', 30 FROM homepage_merchandising_versions;
INSERT INTO homepage_merchandising_cards SELECT id, 'COLLECTIONS', 'sfn_gifts_soft_toys', 40 FROM homepage_merchandising_versions;
INSERT INTO homepage_merchandising_cards SELECT id, 'COLLECTIONS', 'sfn_gifts_cards', 50 FROM homepage_merchandising_versions;
INSERT INTO homepage_merchandising_cards SELECT id, 'COLLECTIONS', 'sfn_gifts_seasonal', 60 FROM homepage_merchandising_versions;
INSERT INTO homepage_merchandising_cards SELECT id, 'LOCAL_FAVOURITES', 'sfn_icecream', 10 FROM homepage_merchandising_versions;
INSERT INTO homepage_merchandising_cards SELECT id, 'LOCAL_FAVOURITES', 'sfn_romneys', 20 FROM homepage_merchandising_versions;
INSERT INTO homepage_merchandising_cards SELECT id, 'LOCAL_FAVOURITES', 'sfn_hawkshead', 30 FROM homepage_merchandising_versions;
