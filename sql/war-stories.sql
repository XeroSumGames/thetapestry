-- war-stories.sql
-- Campfire War Stories: players post memorable moments, session highlights,
-- and legendary rolls. Cross-campaign feed (anyone signed in can read);
-- authors manage their own posts; optional campaign tag surfaces which
-- story each came from.

CREATE TABLE IF NOT EXISTS public.war_stories (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id     uuid        REFERENCES public.campaigns(id) ON DELETE SET NULL,
  title           text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  body            text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_war_stories_created   ON public.war_stories (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_war_stories_author    ON public.war_stories (author_user_id);
CREATE INDEX IF NOT EXISTS idx_war_stories_campaign  ON public.war_stories (campaign_id);

-- Touch updated_at so the feed can sort by recent activity.
CREATE OR REPLACE FUNCTION public.war_stories_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS war_stories_touch_updated_at ON public.war_stories;
CREATE TRIGGER war_stories_touch_updated_at
  BEFORE UPDATE ON public.war_stories
  FOR EACH ROW
  EXECUTE FUNCTION public.war_stories_touch_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.war_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ws_select" ON public.war_stories;
CREATE POLICY "ws_select" ON public.war_stories
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "ws_insert" ON public.war_stories;
CREATE POLICY "ws_insert" ON public.war_stories
  FOR INSERT
  WITH CHECK (author_user_id = auth.uid());

DROP POLICY IF EXISTS "ws_update_own" ON public.war_stories;
CREATE POLICY "ws_update_own" ON public.war_stories
  FOR UPDATE
  USING (author_user_id = auth.uid())
  WITH CHECK (author_user_id = auth.uid());

DROP POLICY IF EXISTS "ws_delete_own" ON public.war_stories;
CREATE POLICY "ws_delete_own" ON public.war_stories
  FOR DELETE
  USING (author_user_id = auth.uid());
