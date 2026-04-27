-- Bump Minnie's Speed from 2 → 3 on already-seeded campaigns.
--
-- Rationale: Speed 2 (= bicycle on good ground per CRB p.138) was too
-- slow for a 9000lb RV. Speed 3 (= horse galloping) better reflects
-- her actual road pace and gives her 90 ft/round on the tactical
-- Move button (Speed × 30 ft/round mapping).
--
-- Idempotent — safe to re-run. Mirrors the style of
-- sql/minnie-floorplan-update.sql which is known to work.
--
-- For brand-new campaigns this is unnecessary — the seed at
-- lib/setting-vehicles.ts already has speed 3.

UPDATE public.campaigns
SET vehicles = jsonb_set(
  vehicles,
  '{0,speed}',
  '3'::jsonb
)
WHERE setting = 'mongrels'
  AND vehicles IS NOT NULL
  AND jsonb_array_length(vehicles) > 0
  AND vehicles->0->>'name' = 'Minnie';
