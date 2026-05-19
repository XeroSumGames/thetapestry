-- Q4-c fuel storage backfill (2026-05-19).
--
-- Adds fuel_max_base + fuel_storage_max to existing Minnie vehicle rows
-- in campaigns.vehicles so the new install/uninstall UI works on
-- pre-existing campaigns without re-seeding from scratch.
--
-- Minnie's defaults (per lib/setting-vehicles.ts):
--   fuel_max_base    = 4   (un-expanded capacity)
--   fuel_storage_max = 6   (absolute cap after install)
--
-- The fields are added only to vehicle objects where:
--   - name = 'Minnie' (other vehicles haven't had their numbers spec'd
--     yet - rules pass post-campaign per Xero 2026-05-19)
--   - the fields don't already exist (idempotent re-run)
--
-- New campaigns get these via the seed in lib/setting-vehicles.ts. Other
-- vehicle types stay opt-in (no feature, no install button) until rules
-- catch up.

UPDATE campaigns
SET vehicles = (
  SELECT jsonb_agg(
    CASE
      WHEN v->>'name' = 'Minnie' AND NOT (v ? 'fuel_storage_max')
        THEN v || '{"fuel_max_base": 4, "fuel_storage_max": 6}'::jsonb
      ELSE v
    END
  )
  FROM jsonb_array_elements(vehicles) v
)
WHERE vehicles IS NOT NULL
  AND jsonb_array_length(vehicles) > 0
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(vehicles) v
    WHERE v->>'name' = 'Minnie' AND NOT (v ? 'fuel_storage_max')
  );
