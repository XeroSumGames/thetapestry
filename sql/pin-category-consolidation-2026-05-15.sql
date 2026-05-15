-- Pin category consolidation 2026-05-15.
--
-- Picker dropped from 9x2 (19 categories with 1 dangler) to a clean
-- 8x2 grid (16 categories). The four removed categories are migrated
-- to surviving ones so existing pins keep meaningful icons:
--
--   military    -> government  (gates/watchtowers are state-controlled
--                                infrastructure; closest semantic fit)
--   hospital    -> medical     (medical infrastructure -> medical icon)
--   settlement  -> community   (small community fits the community
--                                category, which spans larger settlements
--                                too)
--   landmark    -> location    (catch-all for notable scenery without
--                                a more specific type)
--
-- All target categories are still in the canonical PIN_CATEGORIES list,
-- so renderers continue to resolve the icon.

UPDATE public.campaign_pins SET category = 'government' WHERE category = 'military';
UPDATE public.campaign_pins SET category = 'medical'    WHERE category = 'hospital';
UPDATE public.campaign_pins SET category = 'community'  WHERE category = 'settlement';
UPDATE public.campaign_pins SET category = 'location'   WHERE category = 'landmark';

UPDATE public.map_pins      SET category = 'government' WHERE category = 'military';
UPDATE public.map_pins      SET category = 'medical'    WHERE category = 'hospital';
UPDATE public.map_pins      SET category = 'community'  WHERE category = 'settlement';
UPDATE public.map_pins      SET category = 'location'   WHERE category = 'landmark';

-- Verification: should return zero rows after migration.
SELECT 'orphan ' || category AS issue, COUNT(*) AS n
FROM (
  SELECT category FROM public.campaign_pins
  UNION ALL
  SELECT category FROM public.map_pins
) AS all_pins
WHERE category IN ('military','hospital','settlement','landmark')
GROUP BY category;
