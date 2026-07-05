-- ============================================================
-- Path to Citizenship - code-review fixes (2026-07-01)
-- Two live-data corrections from the 2026-07-01 review of the PtC ship:
--
-- 1. The 6 PtC drop-in pregens were seeded with author_id = Xero's UUID, but
--    the official story-page picker loaders (lib/data/pregens.ts
--    loadOfficialPregens / loadOfficialPregensByCampaign) filter
--    author_id IS NULL - so the campaign mapping was dead and none of the six
--    appeared in "Pre-generated for this story". NULLing author_id matches the
--    official-pregen convention (Carly/Gus/Marv are author_id NULL); the Use
--    flow ignores author_id and Xero keeps edit access via the Thriver branch.
--
-- 2. Gates folder sort_order ran 1,3,3,4 (North Gate duplicated East Gate's 3;
--    no gate had 2) - a copy-paste artifact in the live data that made
--    North/East ordering fall to the created_at tiebreak. North Gate -> 2
--    gives the natural W/N/E/S = 1/2/3/4.
--
-- Idempotent: both UPDATEs are no-ops once applied.
-- Companion seed files updated in the same commit so re-runs agree:
--   sql/path-to-citizenship-pregens.sql (inserts now author_id NULL)
--   sql/district-zero-pins-capture-2026-06-30.sql (North Gate sort_order 2)
-- ============================================================

UPDATE public.pregen_library
SET author_id = NULL
WHERE setting = 'district_zero'
  AND name IN ('Rae Okafor','Boone Tucker','Imani Reyes','Hank Delgado','Lonnie Pace','Dot Mwangi');

UPDATE public.campaign_pins
SET sort_order = 2
WHERE campaign_id = '6dd8611b-62ef-4810-b998-b9c5682d0a62'
  AND name = 'North Gate';
