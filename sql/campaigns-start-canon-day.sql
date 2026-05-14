-- ============================================================
-- campaigns.start_canon_day - anchor for "Campaign Day N" math
-- ============================================================
-- Stores the canon_day at which the campaign began. The Campaign
-- Sheet computes "Campaign Day N" as (current clock.canon_day -
-- start_canon_day + 1). NULL is back-compat for campaigns created
-- before this column existed; backfill below sets it to the current
-- clock.canon_day for those campaigns (treats "today" as Day 1, which
-- is correct enough since we don't have historical state to recover
-- the real start day).
--
-- Apply once. Idempotent.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS start_canon_day int;

COMMENT ON COLUMN public.campaigns.start_canon_day IS
  'Canon day this campaign started on (anchors Campaign Day N math). Same units as clock.canon_day - days since 2-Mar-Year0 (first recorded H724 death).';

-- Backfill: set start_canon_day = (clock->>canon_day)::int for any
-- existing campaign that has a clock value and no start_canon_day yet.
-- This means existing campaigns show "Campaign Day 1" until the GM
-- advances the clock OR retroactively edits start_canon_day via the
-- new GM edit affordance.
UPDATE public.campaigns
SET start_canon_day = (clock->>'canon_day')::int
WHERE start_canon_day IS NULL
  AND clock IS NOT NULL
  AND clock->>'canon_day' IS NOT NULL;

NOTIFY pgrst, 'reload schema';
