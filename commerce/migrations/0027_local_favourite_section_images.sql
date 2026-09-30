-- Preserve the three existing Homepage local-favourite images in their canonical
-- published Section versions. Never replace an owner-supplied image.
UPDATE storefront_node_versions
SET image_url = '/images/9.png'
WHERE image_url IS NULL
  AND id = (SELECT current_published_version_id FROM storefront_nodes WHERE id = 'sfn_icecream');

UPDATE storefront_node_versions
SET image_url = '/images/46.png'
WHERE image_url IS NULL
  AND id = (SELECT current_published_version_id FROM storefront_nodes WHERE id = 'sfn_romneys');

UPDATE storefront_node_versions
SET image_url = '/images/49.png'
WHERE image_url IS NULL
  AND id = (SELECT current_published_version_id FROM storefront_nodes WHERE id = 'sfn_hawkshead');
