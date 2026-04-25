-- lfg.sql
-- Looking-for-Group posts. Lightweight bulletin board surfaced at
-- /campfire/lfg. Anyone signed-in can browse; only the author can edit
-- or delete their own posts. There's no per-campaign scoping — LFG is
-- explicitly cross-campaign discovery (Campfire = the meta layer).

CREATE TABLE IF NOT EXISTS public.lfg_posts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind            text        NOT NULL CHECK (kind IN ('gm_seeking_players', 'player_seeking_game')),
  title           text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body            text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  setting         text,            -- free-text: "Distemper", "Chased (Delaware)", "homebrew", etc.
  schedule        text,            -- free-text: "Sundays 7pm EST", "weekly", "play-by-post"
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lfg_posts_created  ON public.lfg_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lfg_posts_kind     ON public.lfg_posts (kind);
CREATE INDEX IF NOT EXISTS idx_lfg_posts_author   ON public.lfg_posts (author_user_id);

-- Auto-bump updated_at on UPDATE so the list can sort by recent activity.
CREATE OR REPLACE FUNCTION public.lfg_posts_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lfg_posts_touch_updated_at ON public.lfg_posts;
CREATE TRIGGER lfg_posts_touch_updated_at
  BEFORE UPDATE ON public.lfg_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.lfg_posts_touch_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.lfg_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lfg_select" ON public.lfg_posts;
CREATE POLICY "lfg_select" ON public.lfg_posts
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "lfg_insert" ON public.lfg_posts;
CREATE POLICY "lfg_insert" ON public.lfg_posts
  FOR INSERT
  WITH CHECK (author_user_id = auth.uid());

DROP POLICY IF EXISTS "lfg_update_own" ON public.lfg_posts;
CREATE POLICY "lfg_update_own" ON public.lfg_posts
  FOR UPDATE
  USING (author_user_id = auth.uid())
  WITH CHECK (author_user_id = auth.uid());

DROP POLICY IF EXISTS "lfg_delete_own" ON public.lfg_posts;
CREATE POLICY "lfg_delete_own" ON public.lfg_posts
  FOR DELETE
  USING (author_user_id = auth.uid());
