-- CARD 08 — Website Appearance foundation.
-- Safe, versioned design tokens. No arbitrary CSS is stored or rendered.

CREATE TABLE website_appearance (
  id TEXT PRIMARY KEY,
  current_published_version_id TEXT,
  current_draft_version_id TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE website_appearance_versions (
  id TEXT PRIMARY KEY,
  appearance_id TEXT NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  preset_key TEXT NOT NULL DEFAULT 'DEFAULT',
  background_color TEXT NOT NULL,
  surface_color TEXT NOT NULL,
  text_color TEXT NOT NULL,
  muted_text_color TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  button_color TEXT NOT NULL,
  border_color TEXT NOT NULL,
  header_color TEXT NOT NULL,
  hero_image_url TEXT,
  hero_heading TEXT,
  hero_text TEXT,
  hero_button_label TEXT,
  hero_button_href TEXT,
  section_images_json TEXT NOT NULL DEFAULT '{}',
  scheduled_start_at TEXT,
  scheduled_end_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT,
  superseded_at TEXT,
  UNIQUE(appearance_id, version_number),
  FOREIGN KEY (appearance_id) REFERENCES website_appearance(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_website_appearance_one_live_version
  ON website_appearance_versions(appearance_id)
  WHERE published_at IS NOT NULL AND superseded_at IS NULL;

CREATE INDEX idx_website_appearance_versions_created
  ON website_appearance_versions(appearance_id, created_at DESC);

CREATE TABLE website_appearance_audit_events (
  id TEXT PRIMARY KEY,
  appearance_id TEXT NOT NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('DRAFT_SAVED','PUBLISHED','RESTORED')),
  actor_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (appearance_id) REFERENCES website_appearance(id) ON DELETE RESTRICT
);

CREATE INDEX idx_website_appearance_audit_created
  ON website_appearance_audit_events(appearance_id, created_at DESC);

INSERT INTO website_appearance (
  id, current_published_version_id, current_draft_version_id,
  version, created_at, updated_at
) VALUES (
  'site_appearance', 'wav_default_1', NULL,
  1, '2026-09-27T09:30:00.000Z', '2026-09-27T09:30:00.000Z'
);

INSERT INTO website_appearance_versions (
  id, appearance_id, version_number, preset_key,
  background_color, surface_color, text_color, muted_text_color,
  accent_color, button_color, border_color, header_color,
  hero_image_url, hero_heading, hero_text, hero_button_label, hero_button_href,
  section_images_json, scheduled_start_at, scheduled_end_at,
  created_by, created_at, published_at, superseded_at
) VALUES (
  'wav_default_1', 'site_appearance', 1, 'DEFAULT',
  '#f8f4ea', '#fffefa', '#151512', '#706b61',
  '#b7904c', '#151512', '#ddd5c6', '#f8f4ea',
  '/images/1.png',
  'A gift shop full of character.',
  'Explore a broad, colourful in-store range built around Peter Rabbit, Highland cows, Ambleside and Lake District souvenirs, soft toys, cards, local treats and regional favourites.',
  'Browse all products',
  '/all-products.html',
  '{}', NULL, NULL,
  'card08-default', '2026-09-27T09:30:00.000Z',
  '2026-09-27T09:30:00.000Z', NULL
);
