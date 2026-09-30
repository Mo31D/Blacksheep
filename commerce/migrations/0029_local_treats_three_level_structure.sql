-- Forward-only publication of the owner's six main sections. Existing
-- Storefront node IDs and Product placement rows are deliberately untouched.
-- Keep legacy_path/slug so indexed URLs continue to resolve.

INSERT INTO storefront_nodes (
  id, stable_key, publication_status, current_published_version_id,
  current_draft_version_id, version, created_at, updated_at, archived_at
) VALUES (
  'sfn_local_treats', 'local-treats', 'ACTIVE', 'sfv_local_treats_0029',
  NULL, 1, '2026-09-30T12:00:00.000Z', '2026-09-30T12:00:00.000Z', NULL
);

INSERT INTO storefront_node_versions (
  id, node_id, version_number, name, slug, parent_node_id, sort_order,
  show_in_navigation, short_description, image_url, legacy_path,
  created_by, created_at, published_at, superseded_at
) VALUES (
  'sfv_local_treats_0029', 'sfn_local_treats', 1, 'Local Treats',
  'local-treats', NULL, 10, 1,
  'Discover local favourites from Romney''s and Hawkshead Relish.',
  NULL, NULL, 'migration:0029', '2026-09-30T12:00:00.000Z',
  '2026-09-30T12:00:00.000Z', NULL
);

INSERT INTO storefront_audit_events (
  id, node_id, event_type, actor_id, before_json, after_json, reason, created_at
) VALUES (
  'sae_m0029_local_treats', 'sfn_local_treats', 'NODE_CREATED',
  'migration:0029', NULL, '{"name":"Local Treats","parentNodeId":null}',
  'Owner-approved six-section hierarchy', '2026-09-30T12:00:00.000Z'
);

CREATE TABLE _migration_0029_targets (
  node_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_node_id TEXT,
  sort_order INTEGER NOT NULL,
  show_in_navigation INTEGER NOT NULL
);
INSERT INTO _migration_0029_targets VALUES
  ('sfn_gifts', 'Lake District Souvenirs', NULL, 20, 1),
  ('sfn_gifts_peter_rabbit', 'Peter Rabbit Gifts', NULL, 30, 1),
  ('sfn_gifts_highland_cows', 'Highland Cows Ornaments', NULL, 40, 1),
  ('sfn_icecream', 'Ice cream', NULL, 50, 1),
  ('sfn_gifts_seasonal', 'Christmas', NULL, 60, 1),
  ('sfn_romneys', 'Romney''s', 'sfn_local_treats', 10, 0),
  ('sfn_hawkshead', 'Hawkshead Relish', 'sfn_local_treats', 20, 0);

INSERT INTO storefront_audit_events (
  id, node_id, event_type, actor_id, before_json, after_json, reason, created_at
)
SELECT
  'sae_m0029_' || t.node_id, n.id, 'NODE_UPDATED', 'migration:0029',
  json_object('name', v.name, 'parentNodeId', v.parent_node_id),
  json_object('name', t.name, 'parentNodeId', t.parent_node_id),
  'Owner-approved six-section hierarchy; stable Product placements retained',
  '2026-09-30T12:00:00.000Z'
FROM _migration_0029_targets t
JOIN storefront_nodes n ON n.id = t.node_id
JOIN storefront_node_versions v ON v.id = n.current_published_version_id;

-- Supersede the old published snapshots before cloning: both live-version
-- unique indexes prohibit simultaneous versions of one node/slug.
UPDATE storefront_node_versions
SET superseded_at = '2026-09-30T12:00:00.000Z'
WHERE id IN (
  SELECT n.current_published_version_id
  FROM storefront_nodes n
  JOIN _migration_0029_targets t ON t.node_id = n.id
);

INSERT INTO storefront_node_versions (
  id, node_id, version_number, name, slug, parent_node_id, sort_order,
  show_in_navigation, short_description, image_url, legacy_path,
  created_by, created_at, published_at, superseded_at
)
SELECT
  'sfv_m0029_' || n.id, n.id,
  (SELECT MAX(version_number) + 1 FROM storefront_node_versions WHERE node_id = n.id),
  t.name, v.slug, t.parent_node_id, t.sort_order, t.show_in_navigation,
  v.short_description, v.image_url, v.legacy_path,
  'migration:0029', '2026-09-30T12:00:00.000Z',
  '2026-09-30T12:00:00.000Z', NULL
FROM _migration_0029_targets t
JOIN storefront_nodes n ON n.id = t.node_id
JOIN storefront_node_versions v ON v.id = n.current_published_version_id;

-- Preserve any owner draft content; align only the hierarchy fields so a
-- later draft publication cannot silently undo this navigation change.
UPDATE storefront_node_versions
SET name = (SELECT t.name FROM _migration_0029_targets t WHERE t.node_id = storefront_node_versions.node_id),
    parent_node_id = (SELECT t.parent_node_id FROM _migration_0029_targets t WHERE t.node_id = storefront_node_versions.node_id),
    sort_order = (SELECT t.sort_order FROM _migration_0029_targets t WHERE t.node_id = storefront_node_versions.node_id),
    show_in_navigation = (SELECT t.show_in_navigation FROM _migration_0029_targets t WHERE t.node_id = storefront_node_versions.node_id)
WHERE id IN (
  SELECT n.current_draft_version_id
  FROM storefront_nodes n
  JOIN _migration_0029_targets t ON t.node_id = n.id
  WHERE n.current_draft_version_id IS NOT NULL
);

UPDATE storefront_nodes
SET current_published_version_id = 'sfv_m0029_' || id,
    version = version + 1,
    updated_at = '2026-09-30T12:00:00.000Z'
WHERE id IN (SELECT node_id FROM _migration_0029_targets);

DROP TABLE _migration_0029_targets;
