-- Force-refresh Minnie's floorplan URL on already-seeded Mongrels
-- campaigns. The file at /public/minnie-floorplan.png was overwritten
-- with the new hand-drawn version, but browsers + Vercel's CDN may
-- still be serving the old image. Adding a ?v=20260427 query param
-- bypasses every cache layer for a clean fetch.
--
-- Idempotent — safe to re-run. If the floorplan_url already has a
-- version param, this overwrites with the new one.

UPDATE public.campaigns
SET vehicles = jsonb_set(
  vehicles,
  '{0,floorplan_url}',
  '"/minnie-floorplan.png?v=20260427"'::jsonb
)
WHERE setting = 'mongrels'
  AND vehicles IS NOT NULL
  AND jsonb_array_length(vehicles) > 0
  AND vehicles->0->>'name' = 'Minnie';
