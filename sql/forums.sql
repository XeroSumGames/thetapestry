-- forums.sql
-- Campfire Forums: threaded community discussion. Two tables — top-level
-- threads and replies. Cross-campaign (this is the meta layer).
--
-- Categories are a fixed enum in the app (lore / rules / session-recaps /
-- general); we store as text so adding a new category is a one-file change.
--
-- Sort key for the thread index is `latest_reply_at`, maintained by a
-- trigger on inserts into forum_replies. New threads start with
-- latest_reply_at = created_at so they appear at the top until someone
-- replies.

CREATE TABLE IF NOT EXISTS public.forum_threads (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category         text        NOT NULL CHECK (category IN ('lore', 'rules', 'session-recaps', 'general')),
  title            text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  body             text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
  pinned           boolean     NOT NULL DEFAULT false,
  locked           boolean     NOT NULL DEFAULT false,
  reply_count      int         NOT NULL DEFAULT 0,
  latest_reply_at  timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_threads_latest   ON public.forum_threads (pinned DESC, latest_reply_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_threads_category ON public.forum_threads (category);
CREATE INDEX IF NOT EXISTS idx_forum_threads_author   ON public.forum_threads (author_user_id);

CREATE TABLE IF NOT EXISTS public.forum_replies (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id        uuid        NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  author_user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body             text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_replies_thread  ON public.forum_replies (thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_forum_replies_author  ON public.forum_replies (author_user_id);

-- ── Triggers ──────────────────────────────────────────────────────
-- Touch updated_at on threads + replies.
CREATE OR REPLACE FUNCTION public.forum_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS forum_threads_touch_updated_at ON public.forum_threads;
CREATE TRIGGER forum_threads_touch_updated_at
  BEFORE UPDATE ON public.forum_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.forum_touch_updated_at();

DROP TRIGGER IF EXISTS forum_replies_touch_updated_at ON public.forum_replies;
CREATE TRIGGER forum_replies_touch_updated_at
  BEFORE UPDATE ON public.forum_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.forum_touch_updated_at();

-- Bump thread.reply_count + latest_reply_at on new replies; decrement
-- on deletes so the index stays correct when posts are removed.
CREATE OR REPLACE FUNCTION public.forum_replies_after_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.forum_threads
     SET reply_count = reply_count + 1,
         latest_reply_at = NEW.created_at
   WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS forum_replies_after_insert ON public.forum_replies;
CREATE TRIGGER forum_replies_after_insert
  AFTER INSERT ON public.forum_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.forum_replies_after_insert();

CREATE OR REPLACE FUNCTION public.forum_replies_after_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  newest timestamptz;
BEGIN
  SELECT MAX(created_at) INTO newest
    FROM public.forum_replies
   WHERE thread_id = OLD.thread_id;

  UPDATE public.forum_threads
     SET reply_count = GREATEST(reply_count - 1, 0),
         latest_reply_at = COALESCE(newest, created_at)
   WHERE id = OLD.thread_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS forum_replies_after_delete ON public.forum_replies;
CREATE TRIGGER forum_replies_after_delete
  AFTER DELETE ON public.forum_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.forum_replies_after_delete();

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;

-- Threads: anyone authenticated can read. Author writes own.
DROP POLICY IF EXISTS "ft_select" ON public.forum_threads;
CREATE POLICY "ft_select" ON public.forum_threads
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "ft_insert" ON public.forum_threads;
CREATE POLICY "ft_insert" ON public.forum_threads
  FOR INSERT
  WITH CHECK (author_user_id = auth.uid());

DROP POLICY IF EXISTS "ft_update_own" ON public.forum_threads;
CREATE POLICY "ft_update_own" ON public.forum_threads
  FOR UPDATE
  USING (author_user_id = auth.uid())
  WITH CHECK (author_user_id = auth.uid());

DROP POLICY IF EXISTS "ft_delete_own" ON public.forum_threads;
CREATE POLICY "ft_delete_own" ON public.forum_threads
  FOR DELETE
  USING (author_user_id = auth.uid());

-- Replies: anyone authenticated can read. Author writes own. Insert
-- additionally requires the thread not be locked.
DROP POLICY IF EXISTS "fr_select" ON public.forum_replies;
CREATE POLICY "fr_select" ON public.forum_replies
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "fr_insert" ON public.forum_replies;
CREATE POLICY "fr_insert" ON public.forum_replies
  FOR INSERT
  WITH CHECK (
    author_user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.forum_threads t
      WHERE t.id = thread_id AND t.locked = true
    )
  );

DROP POLICY IF EXISTS "fr_update_own" ON public.forum_replies;
CREATE POLICY "fr_update_own" ON public.forum_replies
  FOR UPDATE
  USING (author_user_id = auth.uid())
  WITH CHECK (author_user_id = auth.uid());

DROP POLICY IF EXISTS "fr_delete_own" ON public.forum_replies;
CREATE POLICY "fr_delete_own" ON public.forum_replies
  FOR DELETE
  USING (author_user_id = auth.uid());
