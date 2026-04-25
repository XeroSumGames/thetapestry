-- lfg-interests.sql
-- Asymmetric LFG flow: a viewer clicks "I'm Interested" on someone else's
-- LFG post; the post's author gets a notification and a list of interested
-- users on their own post (with a 💬 Message button next to each).
--
-- Why asymmetric (and not just letting anyone DM the author): unsolicited
-- DMs feel spammy on a public board. Pressing Interested is a one-click
-- way to opt in; the author then chooses who to start a conversation with.

CREATE TABLE IF NOT EXISTS public.lfg_interests (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id              uuid        NOT NULL REFERENCES public.lfg_posts(id) ON DELETE CASCADE,
  interested_user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, interested_user_id)
);

CREATE INDEX IF NOT EXISTS idx_lfg_interests_post  ON public.lfg_interests (post_id);
CREATE INDEX IF NOT EXISTS idx_lfg_interests_user  ON public.lfg_interests (interested_user_id);

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.lfg_interests ENABLE ROW LEVEL SECURITY;

-- Visible to: the interested user (their own row) AND the post author
-- (so they can see who's interested in their post). No one else.
DROP POLICY IF EXISTS "lfg_int_select" ON public.lfg_interests;
CREATE POLICY "lfg_int_select" ON public.lfg_interests
  FOR SELECT
  USING (
    interested_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.lfg_posts p
      WHERE p.id = lfg_interests.post_id
        AND p.author_user_id = auth.uid()
    )
  );

-- Insert: only as yourself, and you can't express interest in your own post
-- (no point — you'd just be spamming yourself a notification).
DROP POLICY IF EXISTS "lfg_int_insert" ON public.lfg_interests;
CREATE POLICY "lfg_int_insert" ON public.lfg_interests
  FOR INSERT
  WITH CHECK (
    interested_user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.lfg_posts p
      WHERE p.id = post_id AND p.author_user_id = auth.uid()
    )
  );

-- Delete: you can withdraw your own interest. Author can't delete others'
-- interest (would be confusing — leave that to the user).
DROP POLICY IF EXISTS "lfg_int_delete_own" ON public.lfg_interests;
CREATE POLICY "lfg_int_delete_own" ON public.lfg_interests
  FOR DELETE
  USING (interested_user_id = auth.uid());

-- ── Notification trigger ──────────────────────────────────────────
-- When someone presses Interested, notify the post author so they see a
-- bell on the sidebar. Reuses the existing notifications table contract
-- (user_id, type, title, body, link) — see sql/pass2-notification-triggers.sql.
CREATE OR REPLACE FUNCTION public.notify_lfg_interest()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_author uuid;
  v_username text;
  v_title text;
BEGIN
  SELECT author_user_id, title INTO v_author, v_title
    FROM public.lfg_posts
   WHERE id = NEW.post_id;

  -- Defensive: should never trigger because the INSERT policy blocks self-
  -- interest, but skip just in case (notifying yourself is noise).
  IF v_author IS NULL OR v_author = NEW.interested_user_id THEN
    RETURN NEW;
  END IF;

  SELECT username INTO v_username
    FROM public.profiles
   WHERE id = NEW.interested_user_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    v_author,
    'lfg_interest',
    'New interest on your LFG post',
    COALESCE(v_username, 'Someone') || ' is interested in "' || COALESCE(v_title, 'your post') || '"',
    '/campfire/lfg#lfg-' || NEW.post_id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_lfg_interest ON public.lfg_interests;
CREATE TRIGGER on_lfg_interest
  AFTER INSERT ON public.lfg_interests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_lfg_interest();
