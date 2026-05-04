-- tier-a-rate-limits-wire.sql
-- Layer rate-limit + suspension checks onto the INSERT policies of
-- the highest-abuse-risk tables. Conservative: only the user-typed
-- content surfaces (not character creation, not campaign editing —
-- those have natural ceilings). Keeps cap generous so normal play
-- never hits the limit.
--
--   whispers          → 60 / hour     (1 / minute average; bursts OK)
--   forum_threads     → 10 / hour     (heavy poster: still fine)
--   war_stories       → 5  / hour     (substantial pieces, slower cadence)
--   lfg_posts         → 5  / hour
--   map_pins          → 50 / hour     (rumor pin spamming = main vector)
--   bug_reports       → 10 / hour     (rate-limited via this table too;
--                                       no bot army submitting "test" 1000x)
--
-- Suspension applies to the same set: a suspended user can't create
-- any new content. Reads stay open so the user can wind down their
-- session.
--
-- Idempotent. Re-runs DROP POLICY first so we can safely tweak.

-- ── whispers ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='whispers') THEN
    EXECUTE 'DROP POLICY IF EXISTS whispers_insert ON public.whispers';
    EXECUTE $POL$
      CREATE POLICY whispers_insert ON public.whispers
        FOR INSERT TO authenticated
        WITH CHECK (
          author_user_id = auth.uid()
          AND NOT public.is_user_suspended()
          AND public.check_rate_limit('whisper', 60)
        )
    $POL$;
  END IF;
END $$;

-- ── forum_threads ────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='forum_threads') THEN
    EXECUTE 'DROP POLICY IF EXISTS forum_threads_insert ON public.forum_threads';
    EXECUTE $POL$
      CREATE POLICY forum_threads_insert ON public.forum_threads
        FOR INSERT TO authenticated
        WITH CHECK (
          author_user_id = auth.uid()
          AND NOT public.is_user_suspended()
          AND public.check_rate_limit('forum_thread', 10)
        )
    $POL$;
  END IF;
END $$;

-- ── war_stories ──────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='war_stories') THEN
    EXECUTE 'DROP POLICY IF EXISTS war_stories_insert ON public.war_stories';
    EXECUTE $POL$
      CREATE POLICY war_stories_insert ON public.war_stories
        FOR INSERT TO authenticated
        WITH CHECK (
          author_user_id = auth.uid()
          AND NOT public.is_user_suspended()
          AND public.check_rate_limit('war_story', 5)
        )
    $POL$;
  END IF;
END $$;

-- ── lfg_posts ────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='lfg_posts') THEN
    EXECUTE 'DROP POLICY IF EXISTS lfg_posts_insert ON public.lfg_posts';
    EXECUTE $POL$
      CREATE POLICY lfg_posts_insert ON public.lfg_posts
        FOR INSERT TO authenticated
        WITH CHECK (
          author_user_id = auth.uid()
          AND NOT public.is_user_suspended()
          AND public.check_rate_limit('lfg_post', 5)
        )
    $POL$;
  END IF;
END $$;

-- ── map_pins ─────────────────────────────────────────────────────
-- Existing policy permits author-only inserts. Extend with the new
-- gates without disrupting the existing semantic.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='map_pins') THEN
    EXECUTE 'DROP POLICY IF EXISTS map_pins_insert ON public.map_pins';
    EXECUTE $POL$
      CREATE POLICY map_pins_insert ON public.map_pins
        FOR INSERT TO authenticated
        WITH CHECK (
          user_id = auth.uid()
          AND NOT public.is_user_suspended()
          AND public.check_rate_limit('map_pin', 50)
        )
    $POL$;
  END IF;
END $$;

-- ── bug_reports ──────────────────────────────────────────────────
-- Replace the existing policy with one that keeps the ghost-OK
-- behavior (reporter_id IS NULL allowed) but rate-limits authed users.
DROP POLICY IF EXISTS bug_reports_insert ON public.bug_reports;
CREATE POLICY bug_reports_insert ON public.bug_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    (reporter_id IS NULL OR reporter_id = auth.uid())
    AND NOT public.is_user_suspended()
    AND public.check_rate_limit('bug_report', 10)
  );

NOTIFY pgrst, 'reload schema';
