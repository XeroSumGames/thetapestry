-- Two long-standing schema gaps on campaign_npcs:
--   1. lasting_wounds  - NPCs had no place to persist Day-0 Lasting
--                        Wounds, so the drainer logged but couldn't
--                        store them. Now mirrors PCs' data.lastingWounds
--                        as a jsonb array of strings.
--   2. acuity          - ACU was missing from the 4-column attribute
--                        set (PHY/DEX/RSN/INF). Any ACU-based skill
--                        check (Navigation default, Farming, Gambling,
--                        Lock-Picking) read AMod=0 for NPCs. Default
--                        keeps existing NPCs at 0 (their current
--                        effective value); per-NPC backfill via the
--                        editor when Xero has time.

ALTER TABLE campaign_npcs
  ADD COLUMN IF NOT EXISTS lasting_wounds jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS acuity smallint NOT NULL DEFAULT 0;
