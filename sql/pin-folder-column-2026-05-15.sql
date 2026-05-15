-- Pin folder column (2026-05-15 v2).
--
-- After the per-user-folders approach (139edcf) got reverted, the new
-- shape mirrors NPCs exactly: a single `folder text` column on the pin
-- row, GM-shared across all viewers. NULL or empty = "Uncategorized."
--
-- Render is grouped client-side: pins.filter(p => (p.folder ?? '...')
-- === folderName). Bulk SHOW/HIDE per folder uses
-- UPDATE campaign_pins SET revealed = ? WHERE campaign_id = ? AND folder = ?
--
-- See lib/setting-pins.ts seed data for the canonical landmarks Xero
-- usually wants pre-foldered (Mongrels waypoints, Chased mall, etc.).

ALTER TABLE public.campaign_pins ADD COLUMN IF NOT EXISTS folder text;

NOTIFY pgrst, 'reload schema';
