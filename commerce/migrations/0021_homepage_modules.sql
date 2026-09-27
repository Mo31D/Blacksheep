-- CARD 07 — Safe Homepage module composition.
-- Modules are versioned with Homepage Merchandising; no free-form HTML/CSS is permitted.

CREATE TABLE homepage_merchandising_modules (
  version_id TEXT NOT NULL,
  module_key TEXT NOT NULL
    CHECK (module_key IN ('HERO','COLLECTIONS','PRODUCT_RAIL','LOCAL_FAVOURITES','VISIT_SHOP')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (version_id, module_key),
  FOREIGN KEY (version_id) REFERENCES homepage_merchandising_versions(id) ON DELETE CASCADE
);

CREATE INDEX idx_homepage_merchandising_modules_position
  ON homepage_merchandising_modules(version_id, position, module_key);

INSERT INTO homepage_merchandising_modules (version_id, module_key, enabled, position)
SELECT id, 'HERO', 1, 10 FROM homepage_merchandising_versions
UNION ALL
SELECT id, 'COLLECTIONS', 1, 20 FROM homepage_merchandising_versions
UNION ALL
SELECT id, 'PRODUCT_RAIL', 1, 30 FROM homepage_merchandising_versions
UNION ALL
SELECT id, 'LOCAL_FAVOURITES', 1, 40 FROM homepage_merchandising_versions
UNION ALL
SELECT id, 'VISIT_SHOP', 1, 50 FROM homepage_merchandising_versions;
