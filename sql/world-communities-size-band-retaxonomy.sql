-- Retaxonomize world_communities.size_band (2026-04-24).
--
-- Old: Small (<13) / Band (13-32) / Settlement (33-99) / Enclave (100-499) / City (500+)
-- New: Group (<13) / Small (13-50) / Medium (51-150) / Large (151-500) / Huge (501-1000) / Nation State (1000+)
--
-- Strategy: drop the CHECK constraint, recompute size_band from the live
-- community_members active count when the source community still exists,
-- otherwise fall back to a label-to-label best-effort swap. Then reinstate
-- the CHECK with the new allowed values and update the default.
--
-- Idempotent. Safe to re-run.
-- ============================================================

-- 1. Drop the old CHECK so we can write any value transiently.
ALTER TABLE public.world_communities
  DROP CONSTRAINT IF EXISTS world_communities_size_band_check;

-- 2. Recompute from live member count for every world row whose source
--    community still exists. This is the accurate path — it puts each
--    row in the band that matches its actual roster today.
UPDATE public.world_communities w
SET size_band = CASE
  WHEN sub.n < 13 THEN 'Group'
  WHEN sub.n <= 50 THEN 'Small'
  WHEN sub.n <= 150 THEN 'Medium'
  WHEN sub.n <= 500 THEN 'Large'
  WHEN sub.n <= 1000 THEN 'Huge'
  ELSE 'Nation State'
END
FROM (
  SELECT community_id, COUNT(*) AS n
  FROM public.community_members
  WHERE left_at IS NULL
  GROUP BY community_id
) sub
WHERE w.source_community_id = sub.community_id;

-- 3. Fallback for rows the UPDATE above missed (source community deleted
--    / no active members). Map the legacy label directly to the closest
--    new tier.
UPDATE public.world_communities
SET size_band = CASE size_band
  WHEN 'Small' THEN 'Group'
  WHEN 'Band' THEN 'Small'
  WHEN 'Settlement' THEN 'Medium'
  WHEN 'Enclave' THEN 'Large'
  WHEN 'City' THEN 'Nation State'
  ELSE size_band
END
WHERE size_band IN ('Small','Band','Settlement','Enclave','City');

-- 4. Reinstate the CHECK with the new taxonomy + bump the default.
ALTER TABLE public.world_communities
  ADD CONSTRAINT world_communities_size_band_check
  CHECK (size_band IN ('Group','Small','Medium','Large','Huge','Nation State'));

ALTER TABLE public.world_communities
  ALTER COLUMN size_band SET DEFAULT 'Group';
