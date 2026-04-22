-- Adds an optional destroyed-portrait image URL to object scene tokens.
-- When a token with this field set hits 0 WP, TacticalMap swaps the intact
-- portrait for the destroyed one. Falls back to the shatter-crack overlay
-- when the field is null, so existing tokens keep working.
ALTER TABLE scene_tokens ADD COLUMN IF NOT EXISTS destroyed_portrait_url text;
