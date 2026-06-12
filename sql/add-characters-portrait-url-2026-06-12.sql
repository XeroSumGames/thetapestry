-- Add portrait_url to characters table.
-- PC tokens read pc.portraitUrl in lib/data/scenes.ts:32 but the column
-- didn't exist - this is the root blocker for "player uploads a photo = their map token".
-- Nullable; existing rows stay NULL and existing token flow is unchanged.
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS portrait_url text NULL;
