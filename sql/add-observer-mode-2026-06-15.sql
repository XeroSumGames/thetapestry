-- Observer mode: campaign members who join via the observer link are hidden
-- from the player bar and excluded from combat initiative.
ALTER TABLE public.campaign_members
  ADD COLUMN IF NOT EXISTS observer boolean NOT NULL DEFAULT false;
