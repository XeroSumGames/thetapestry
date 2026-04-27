-- Bump Minnie's Speed from 2 → 3 on already-seeded campaigns.
--
-- Rationale: Speed 2 (= bicycle on good ground per CRB p.138) was too
-- slow for a 9000lb RV. Speed 3 (= horse galloping) better reflects
-- her actual road pace and gives her 90 ft/round on the tactical
-- Move button (Speed × 30 ft/round mapping).
--
-- Idempotent — safe to re-run. Uses jsonb_set to mutate only the
-- 'speed' field on the first vehicle (Minnie is always vehicles[0]
-- in the seed). Skips campaigns whose first vehicle isn't named
-- "Minnie" so a campaign that customized vehicles[0] for something
-- else won't get clobbered.
--
-- For brand-new campaigns this is unnecessary — the seed at
-- lib/setting-vehicles.ts already has speed 3.

UPDATE campaigns
SET vehicles = jsonb_set(vehicles, '{0,speed}', '3'::jsonb)
WHERE jsonb_typeof(vehicles) = 'array'
  AND jsonb_array_length(vehicles) > 0
  AND vehicles->0->>'name' = 'Minnie'
  AND COALESCE((vehicles->0->>'speed')::int, 0) <> 3;
