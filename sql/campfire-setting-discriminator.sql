-- campfire-setting-discriminator.sql
-- Phase 4A — per-setting feed layer for Campfire surfaces.
--
-- Adds a `setting` slug column to the three Campfire feed tables so posts
-- can be tagged with a canonical setting (district_zero, kings_crossroads_mall,
-- etc.) and surfaced in setting-specific feeds + the eventual setting hubs
-- (Phase 4C).
--
--   setting IS NULL  → "global" scope (visible everywhere; not tagged to any setting)
--   setting = <slug> → "setting" scope (shows in that setting's hub + filter chip)
--
-- For war_stories, posts can ALSO carry a campaign_id (already exists). When
-- both campaign_id and setting are NULL, the post is global. When campaign_id
-- is set, the post is campaign-private (4B will gate moderation off this).
--
-- LFG already has a free-text `setting` column that was being used as a
-- descriptive label ("Distemper, Chased, Homebrew..."). We're repurposing it
-- as the slug discriminator. Existing free-text rows survive but won't match
-- any setting filter chip — they show only in the "All" view.

-- ── forum_threads ─────────────────────────────────────────────────
ALTER TABLE public.forum_threads
  ADD COLUMN IF NOT EXISTS setting text NULL;

CREATE INDEX IF NOT EXISTS idx_forum_threads_setting
  ON public.forum_threads (setting, created_at DESC);

-- ── war_stories ───────────────────────────────────────────────────
ALTER TABLE public.war_stories
  ADD COLUMN IF NOT EXISTS setting text NULL;

CREATE INDEX IF NOT EXISTS idx_war_stories_setting
  ON public.war_stories (setting, created_at DESC);

-- ── lfg_posts ─────────────────────────────────────────────────────
-- Column already exists (created in sql/lfg.sql). Just add the index so the
-- new chip-filter queries can use it.
CREATE INDEX IF NOT EXISTS idx_lfg_posts_setting
  ON public.lfg_posts (setting, created_at DESC);

-- ── PostgREST schema cache reload ─────────────────────────────────
-- So the new column shows up to the JS client without restarting Supabase.
NOTIFY pgrst, 'reload schema';
