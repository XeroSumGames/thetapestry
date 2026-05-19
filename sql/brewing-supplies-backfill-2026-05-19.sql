-- Q4-d brewing supplies backfill (2026-05-19).
--
-- Adds brewing_supplies_current + brewing_supplies_max to existing Minnie
-- vehicle rows in campaigns.vehicles so the new Gather Materials UI and
-- the brew-blocked guard work on pre-existing campaigns without a re-seed.
--
-- Minnie's defaults (per lib/setting-vehicles.ts):
--   brewing_supplies_current = 0   (starts empty - they'll gather)
--   brewing_supplies_max     = 2   (matches playtest mark 02:25:36 ask)
--
-- Idempotent: skips rows that already have brewing_supplies_max. Other
-- vehicle types stay opt-in (no still on most of them anyway).

UPDATE campaigns
SET vehicles = (
  SELECT jsonb_agg(
    CASE
      WHEN v->>'name' = 'Minnie' AND NOT (v ? 'brewing_supplies_max')
        THEN v || '{"brewing_supplies_current": 0, "brewing_supplies_max": 2}'::jsonb
      ELSE v
    END
  )
  FROM jsonb_array_elements(vehicles) v
)
WHERE vehicles IS NOT NULL
  AND jsonb_array_length(vehicles) > 0
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(vehicles) v
    WHERE v->>'name' = 'Minnie' AND NOT (v ? 'brewing_supplies_max')
  );
