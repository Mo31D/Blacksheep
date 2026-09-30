-- Promote Peter Rabbit from a Gifts sub-section to a main website section.
-- Product placements point to the stable storefront node ID, so no product
-- reassignment is required and all existing Peter Rabbit products stay attached.

INSERT OR IGNORE INTO storefront_audit_events (
  id, node_id, event_type, actor_id, before_json, after_json, reason, created_at
)
SELECT
  'sae_migration_0028_peter_rabbit_main',
  n.id,
  'NODE_UPDATED',
  'migration:0028',
  '{"parentNodeId":"sfn_gifts"}',
  '{"parentNodeId":null}',
  'Owner requested Peter Rabbit to become a main Storefront section without moving products',
  '2026-09-30T09:50:00.000Z'
FROM storefront_nodes n
JOIN storefront_node_versions v
  ON v.id = COALESCE(n.current_draft_version_id, n.current_published_version_id)
WHERE n.id = 'sfn_gifts_peter_rabbit'
  AND v.parent_node_id = 'sfn_gifts';

UPDATE storefront_nodes
SET version = version + 1,
    updated_at = '2026-09-30T09:50:00.000Z'
WHERE id = 'sfn_gifts_peter_rabbit'
  AND EXISTS (
    SELECT 1
    FROM storefront_node_versions v
    WHERE v.id = COALESCE(
      storefront_nodes.current_draft_version_id,
      storefront_nodes.current_published_version_id
    )
      AND v.parent_node_id = 'sfn_gifts'
  );

UPDATE storefront_node_versions
SET parent_node_id = NULL
WHERE node_id = 'sfn_gifts_peter_rabbit'
  AND parent_node_id = 'sfn_gifts'
  AND id IN (
    SELECT current_published_version_id
    FROM storefront_nodes
    WHERE id = 'sfn_gifts_peter_rabbit'
      AND current_published_version_id IS NOT NULL
    UNION
    SELECT current_draft_version_id
    FROM storefront_nodes
    WHERE id = 'sfn_gifts_peter_rabbit'
      AND current_draft_version_id IS NOT NULL
  );
