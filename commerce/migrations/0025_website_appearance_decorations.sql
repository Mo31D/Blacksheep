-- Optional decorative layers belong to each versioned Appearance draft.
-- Existing live versions remain undecorated until the owner publishes a new draft.
ALTER TABLE website_appearance_versions
  ADD COLUMN decorations_enabled INTEGER NOT NULL DEFAULT 0
  CHECK (decorations_enabled IN (0, 1));
