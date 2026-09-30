-- Forward-only ownership transfer. Published Storefront node versions own
-- Section images; Website Appearance retains historical versions only.
-- Never replace a non-null Section image with an Appearance override.

CREATE TABLE IF NOT EXISTS _migration_0030_targets (
  node_id TEXT PRIMARY KEY,
  image_url TEXT NOT NULL
);
DELETE FROM _migration_0030_targets;

INSERT INTO _migration_0030_targets (node_id, image_url)
SELECT n.id, j.value
FROM website_appearance a
JOIN website_appearance_versions av ON av.id = a.current_published_version_id
JOIN json_each(av.section_images_json) j
JOIN storefront_nodes n ON n.stable_key = j.key AND n.publication_status = 'ACTIVE'
JOIN storefront_node_versions nv ON nv.id = n.current_published_version_id
WHERE nv.image_url IS NULL
  AND j.type = 'text'
  AND length(trim(j.value)) > 0;

-- Stop before changing any published data if a pending owner draft might
-- conflict with the transfer. The release must reconcile that draft first.
CREATE TABLE IF NOT EXISTS _migration_0030_draft_guard (
  draft_count INTEGER NOT NULL CHECK (draft_count = 0)
);
DELETE FROM _migration_0030_draft_guard;
INSERT INTO _migration_0030_draft_guard
SELECT COUNT(*) FROM storefront_nodes n
JOIN _migration_0030_targets t ON t.node_id = n.id
WHERE n.current_draft_version_id IS NOT NULL;
INSERT INTO _migration_0030_draft_guard
SELECT COUNT(*) FROM website_appearance a
JOIN website_appearance_versions v ON v.id = a.current_draft_version_id
WHERE EXISTS (SELECT 1 FROM json_each(v.section_images_json));
DROP TABLE _migration_0030_draft_guard;

INSERT INTO storefront_audit_events (
  id, node_id, event_type, actor_id, before_json, after_json, reason, created_at
)
SELECT 'sae_m0030_' || t.node_id, t.node_id, 'NODE_UPDATED', 'migration:0030',
  json_object('imageUrl', NULL), json_object('imageUrl', t.image_url),
  'Transfer published Appearance-only Section image to canonical node',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM _migration_0030_targets t;

UPDATE storefront_node_versions
SET superseded_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id IN (
  SELECT n.current_published_version_id FROM storefront_nodes n
  JOIN _migration_0030_targets t ON t.node_id = n.id
);

INSERT INTO storefront_node_versions (
  id, node_id, version_number, name, slug, parent_node_id, sort_order,
  show_in_navigation, short_description, image_url, legacy_path,
  created_by, created_at, published_at, superseded_at
)
SELECT 'sfv_m0030_' || n.id, n.id,
  (SELECT MAX(version_number) + 1 FROM storefront_node_versions WHERE node_id = n.id),
  v.name, v.slug, v.parent_node_id, v.sort_order, v.show_in_navigation,
  v.short_description, t.image_url, v.legacy_path,
  'migration:0030', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL
FROM _migration_0030_targets t
JOIN storefront_nodes n ON n.id = t.node_id
JOIN storefront_node_versions v ON v.id = n.current_published_version_id;

UPDATE storefront_nodes
SET current_published_version_id = 'sfv_m0030_' || id,
    version = version + 1,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id IN (SELECT node_id FROM _migration_0030_targets);

-- Preserve the old Appearance publication in history, then publish the
-- same theme/hero with no active Section image overrides.
CREATE TABLE IF NOT EXISTS _migration_0030_appearance (appearance_id TEXT PRIMARY KEY);
DELETE FROM _migration_0030_appearance;
INSERT INTO _migration_0030_appearance
SELECT a.id FROM website_appearance a
JOIN website_appearance_versions v ON v.id = a.current_published_version_id
WHERE v.section_images_json <> '{}';

INSERT INTO website_appearance_audit_events (
  id, appearance_id, event_type, actor_id, before_json, after_json, created_at
)
SELECT 'wae_m0030_' || a.appearance_id, a.appearance_id, 'PUBLISHED',
  'migration:0030', json_object('sectionImages', v.section_images_json),
  json_object('sectionImages', '{}'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM _migration_0030_appearance a
JOIN website_appearance wa ON wa.id = a.appearance_id
JOIN website_appearance_versions v ON v.id = wa.current_published_version_id;

UPDATE website_appearance_versions
SET superseded_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id IN (
  SELECT wa.current_published_version_id FROM website_appearance wa
  JOIN _migration_0030_appearance a ON a.appearance_id = wa.id
);

INSERT INTO website_appearance_versions (
  id, appearance_id, version_number, preset_key, decorations_enabled,
  background_color, surface_color, text_color, muted_text_color,
  accent_color, button_color, border_color, header_color,
  hero_image_url, hero_heading, hero_text, hero_button_label, hero_button_href,
  section_images_json, scheduled_start_at, scheduled_end_at,
  created_by, created_at, published_at, superseded_at
)
SELECT 'wav_m0030_' || wa.id, wa.id,
  (SELECT MAX(version_number) + 1 FROM website_appearance_versions WHERE appearance_id = wa.id),
  v.preset_key, v.decorations_enabled, v.background_color, v.surface_color, v.text_color,
  v.muted_text_color, v.accent_color, v.button_color, v.border_color,
  v.header_color, v.hero_image_url, v.hero_heading, v.hero_text,
  v.hero_button_label, v.hero_button_href, '{}', v.scheduled_start_at,
  v.scheduled_end_at, 'migration:0030',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL
FROM _migration_0030_appearance a
JOIN website_appearance wa ON wa.id = a.appearance_id
JOIN website_appearance_versions v ON v.id = wa.current_published_version_id;

UPDATE website_appearance
SET current_published_version_id = 'wav_m0030_' || id,
    version = version + 1,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id IN (SELECT appearance_id FROM _migration_0030_appearance);

DROP TABLE _migration_0030_appearance;
DROP TABLE _migration_0030_targets;
