-- campfire-moderation.sql
-- Phase 4B — Promotion + moderation flow for the three Campfire surfaces.
--
-- Adds the standard world_communities-style moderation columns
-- (moderation_status / approved_by / approved_at / moderator_notes) to
-- forum_threads, war_stories, lfg_posts, and tightens SELECT RLS so
-- pending/rejected rows are only visible to their author or to a Thriver.
-- Approved rows remain readable to anyone signed in.
--
-- Compose flow (enforced on the client per the locked design):
--   scope = 'campaign'         → moderation_status = 'approved'  (instant)
--   scope = 'setting' / global → moderation_status = 'pending'   (queue)
--
-- Migration is additive on schema (existing rows default to 'approved'
-- so nothing currently public goes dark on apply). The RLS replace is
-- atomic — DROP + CREATE in a single statement pair per policy.

-- ── forum_threads ─────────────────────────────────────────────────
ALTER TABLE public.forum_threads
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderator_notes text;

CREATE INDEX IF NOT EXISTS idx_forum_threads_moderation
  ON public.forum_threads (moderation_status, created_at DESC);

-- Replace the open SELECT policy with the three-tier read pattern from
-- world_communities. Note: PostgREST evaluates these as OR — any matching
-- USING gives access. So author, thriver, and approved-public all
-- satisfy independently.
DROP POLICY IF EXISTS "ft_select" ON public.forum_threads;
DROP POLICY IF EXISTS "ft_select_approved" ON public.forum_threads;
DROP POLICY IF EXISTS "ft_select_own" ON public.forum_threads;
DROP POLICY IF EXISTS "ft_select_thriver" ON public.forum_threads;

CREATE POLICY "ft_select_approved" ON public.forum_threads
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND moderation_status = 'approved');

CREATE POLICY "ft_select_own" ON public.forum_threads
  FOR SELECT
  USING (author_user_id = auth.uid());

CREATE POLICY "ft_select_thriver" ON public.forum_threads
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

-- Update policy expansion: existing ft_update_own only let the author
-- update. Add a thriver policy so the moderation page can flip status.
DROP POLICY IF EXISTS "ft_update_thriver" ON public.forum_threads;
CREATE POLICY "ft_update_thriver" ON public.forum_threads
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

-- ── war_stories ───────────────────────────────────────────────────
ALTER TABLE public.war_stories
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderator_notes text;

CREATE INDEX IF NOT EXISTS idx_war_stories_moderation
  ON public.war_stories (moderation_status, created_at DESC);

DROP POLICY IF EXISTS "ws_select" ON public.war_stories;
DROP POLICY IF EXISTS "ws_select_approved" ON public.war_stories;
DROP POLICY IF EXISTS "ws_select_own" ON public.war_stories;
DROP POLICY IF EXISTS "ws_select_thriver" ON public.war_stories;

CREATE POLICY "ws_select_approved" ON public.war_stories
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND moderation_status = 'approved');

CREATE POLICY "ws_select_own" ON public.war_stories
  FOR SELECT
  USING (author_user_id = auth.uid());

CREATE POLICY "ws_select_thriver" ON public.war_stories
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

DROP POLICY IF EXISTS "ws_update_thriver" ON public.war_stories;
CREATE POLICY "ws_update_thriver" ON public.war_stories
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

-- ── lfg_posts ─────────────────────────────────────────────────────
ALTER TABLE public.lfg_posts
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderator_notes text;

CREATE INDEX IF NOT EXISTS idx_lfg_posts_moderation
  ON public.lfg_posts (moderation_status, created_at DESC);

-- LFG's existing SELECT policy may or may not be named the same as the
-- others — drop both candidates to be safe. Then create the same three.
DROP POLICY IF EXISTS "lfg_select" ON public.lfg_posts;
DROP POLICY IF EXISTS "lfg_posts_select" ON public.lfg_posts;
DROP POLICY IF EXISTS "lfg_select_approved" ON public.lfg_posts;
DROP POLICY IF EXISTS "lfg_select_own" ON public.lfg_posts;
DROP POLICY IF EXISTS "lfg_select_thriver" ON public.lfg_posts;

CREATE POLICY "lfg_select_approved" ON public.lfg_posts
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND moderation_status = 'approved');

CREATE POLICY "lfg_select_own" ON public.lfg_posts
  FOR SELECT
  USING (author_user_id = auth.uid());

CREATE POLICY "lfg_select_thriver" ON public.lfg_posts
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

DROP POLICY IF EXISTS "lfg_update_thriver" ON public.lfg_posts;
CREATE POLICY "lfg_update_thriver" ON public.lfg_posts
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

-- ── PostgREST schema cache reload ─────────────────────────────────
NOTIFY pgrst, 'reload schema';
