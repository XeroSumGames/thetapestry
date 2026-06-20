-- Link pregens to a specific campaign instead of a setting-type string.
-- Nullable so existing pregens without a campaign are unaffected.
ALTER TABLE pregen_library
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL;
