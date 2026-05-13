-- ============================================================
-- modules.start_canon_day - module's canonical start date
-- ============================================================
-- Adds the same canon_day concept that campaigns.clock uses
-- (days since 2-Mar-Year0, the first recorded H724 death) to the
-- modules table. When a campaign is cloned from a module version,
-- the campaign's clock is seeded with this value. NULL = no
-- canonical start (clone leaves the campaign at canon_day 0).
--
-- Range is conventionally -60 to ~7000 (Year 0 Jan 1 through Year
-- 19 Dec 31). No CHECK constraint - if a Thriver wants a campaign
-- 100 years post-pandemic for some reason, that's their call.
--
-- Apply once. Idempotent.

ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS start_canon_day int;

COMMENT ON COLUMN public.modules.start_canon_day IS
  'Canonical start day for campaigns cloned from this module. Days since 2-Mar-Year0 (first recorded H724 death). NULL = no canonical start (clone defaults to canon_day 0).';

-- Mirror on module_versions so published snapshots carry the same
-- value. Clone path reads from the version, not the draft module.
ALTER TABLE public.module_versions
  ADD COLUMN IF NOT EXISTS start_canon_day int;

COMMENT ON COLUMN public.module_versions.start_canon_day IS
  'Snapshot of modules.start_canon_day at publish time. Used by cloneModuleIntoCampaign to seed campaigns.clock.';

NOTIFY pgrst, 'reload schema';
