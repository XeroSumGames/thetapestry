-- ============================================================
-- Indexes for campaign_members to make RLS fast.
-- Run in Supabase SQL Editor.
-- Idempotent: safe to re-run.
-- ============================================================
--
-- Why: the new RLS policies on characters and profiles do a self-join
-- on campaign_members. Without indexes, every read of those tables
-- triggers a full scan inside the RLS check. With these indexes, the
-- check becomes a fast index lookup.

CREATE INDEX IF NOT EXISTS campaign_members_user_id_idx
  ON public.campaign_members(user_id);

CREATE INDEX IF NOT EXISTS campaign_members_campaign_id_idx
  ON public.campaign_members(campaign_id);

CREATE INDEX IF NOT EXISTS campaign_members_campaign_user_idx
  ON public.campaign_members(campaign_id, user_id);

-- Verify (avoid `table` reserved word)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'campaign_members'
ORDER BY indexname;
