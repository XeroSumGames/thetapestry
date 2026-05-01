-- forum-threads-campaign-id.sql
-- Phase 4A.5 — Add campaign scope to Forums.
--
-- Backstory: Phase 4A's locked design says "Default scope on new posts =
-- campaign-private (Vegas-rules content stays in-campaign)." War Stories
-- already had a campaign_id column for this; LFG doesn't need one (LFG is
-- by nature cross-campaign). Forums had no campaign_id, so the 4A
-- composer shipped with Setting/Global only.
--
-- This migration unblocks Phase 4B's moderation gate: campaign-internal
-- posts skip review, setting/global posts get queued. Without
-- campaign_id on forum_threads, EVERY new forum thread would land in the
-- thriver review queue.
--
-- Mirrors war_stories.campaign_id exactly: NULL allowed, FK with
-- ON DELETE SET NULL so deleting a campaign doesn't take its forum
-- threads with it.
--
-- Visibility note: this column is purely a tag in 4A.5 — RLS still says
-- "anyone signed in can read." That matches War Stories behavior today.
-- Tightening to "only campaign members see campaign-tagged threads" is a
-- separate decision (would also need to apply to War Stories for
-- consistency). Not in 4A.5 scope.

ALTER TABLE public.forum_threads
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_forum_threads_campaign
  ON public.forum_threads (campaign_id);

NOTIFY pgrst, 'reload schema';
