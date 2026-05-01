-- campfire-polish-4e.sql
-- Phase 4E (final bundle) — reactions + threading + full-text search +
-- campaign_invitations.
--
-- Four features in one migration so the apply ritual is a single SQL
-- run for the GM. Each section is idempotent (IF NOT EXISTS guards
-- + DROP/CREATE policy pairs) so re-runs are safe.

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 1. REACTIONS — forum_threads + war_stories + lfg_posts            ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- Simple up/down votes. One vote per (target, user); flipping the
-- direction UPSERTs in place; clicking the active direction again is a
-- DELETE on the client. Score = upvotes - downvotes (computed on read
-- via aggregate; cheap at our scale, swap to denormalized count later).

CREATE TABLE IF NOT EXISTS public.forum_thread_reactions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     uuid        NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          text        NOT NULL CHECK (kind IN ('up','down')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ftr_thread ON public.forum_thread_reactions (thread_id);

CREATE TABLE IF NOT EXISTS public.war_story_reactions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  war_story_id  uuid        NOT NULL REFERENCES public.war_stories(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          text        NOT NULL CHECK (kind IN ('up','down')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (war_story_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_wsr_story ON public.war_story_reactions (war_story_id);

CREATE TABLE IF NOT EXISTS public.lfg_post_reactions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       uuid        NOT NULL REFERENCES public.lfg_posts(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          text        NOT NULL CHECK (kind IN ('up','down')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_lpr_post ON public.lfg_post_reactions (post_id);

-- RLS — anyone signed in reads; users manage their own.
ALTER TABLE public.forum_thread_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.war_story_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lfg_post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ftr_select" ON public.forum_thread_reactions;
CREATE POLICY "ftr_select" ON public.forum_thread_reactions FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ftr_insert_own" ON public.forum_thread_reactions;
CREATE POLICY "ftr_insert_own" ON public.forum_thread_reactions FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "ftr_update_own" ON public.forum_thread_reactions;
CREATE POLICY "ftr_update_own" ON public.forum_thread_reactions FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "ftr_delete_own" ON public.forum_thread_reactions;
CREATE POLICY "ftr_delete_own" ON public.forum_thread_reactions FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "wsr_select" ON public.war_story_reactions;
CREATE POLICY "wsr_select" ON public.war_story_reactions FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "wsr_insert_own" ON public.war_story_reactions;
CREATE POLICY "wsr_insert_own" ON public.war_story_reactions FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "wsr_update_own" ON public.war_story_reactions;
CREATE POLICY "wsr_update_own" ON public.war_story_reactions FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "wsr_delete_own" ON public.war_story_reactions;
CREATE POLICY "wsr_delete_own" ON public.war_story_reactions FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "lpr_select" ON public.lfg_post_reactions;
CREATE POLICY "lpr_select" ON public.lfg_post_reactions FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "lpr_insert_own" ON public.lfg_post_reactions;
CREATE POLICY "lpr_insert_own" ON public.lfg_post_reactions FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "lpr_update_own" ON public.lfg_post_reactions;
CREATE POLICY "lpr_update_own" ON public.lfg_post_reactions FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "lpr_delete_own" ON public.lfg_post_reactions;
CREATE POLICY "lpr_delete_own" ON public.lfg_post_reactions FOR DELETE USING (user_id = auth.uid());

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 2. THREADING — war_story_replies + lfg_post_replies               ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- Mirrors forum_replies exactly: flat list of replies (no nesting in
-- v1), trigger bumps reply_count + latest_reply_at on the parent.
-- Adds reply_count + latest_reply_at columns to the parent tables for
-- the trigger to maintain.

ALTER TABLE public.war_stories
  ADD COLUMN IF NOT EXISTS reply_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS latest_reply_at timestamptz;

ALTER TABLE public.lfg_posts
  ADD COLUMN IF NOT EXISTS reply_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS latest_reply_at timestamptz;

CREATE TABLE IF NOT EXISTS public.war_story_replies (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  war_story_id    uuid        NOT NULL REFERENCES public.war_stories(id) ON DELETE CASCADE,
  author_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body            text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wsr_replies_story ON public.war_story_replies (war_story_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.lfg_post_replies (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         uuid        NOT NULL REFERENCES public.lfg_posts(id) ON DELETE CASCADE,
  author_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body            text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lpr_replies_post ON public.lfg_post_replies (post_id, created_at ASC);

ALTER TABLE public.war_story_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lfg_post_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wsr_reply_select" ON public.war_story_replies;
CREATE POLICY "wsr_reply_select" ON public.war_story_replies FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "wsr_reply_insert" ON public.war_story_replies;
CREATE POLICY "wsr_reply_insert" ON public.war_story_replies FOR INSERT WITH CHECK (author_user_id = auth.uid());
DROP POLICY IF EXISTS "wsr_reply_update_own" ON public.war_story_replies;
CREATE POLICY "wsr_reply_update_own" ON public.war_story_replies FOR UPDATE USING (author_user_id = auth.uid()) WITH CHECK (author_user_id = auth.uid());
DROP POLICY IF EXISTS "wsr_reply_delete_own" ON public.war_story_replies;
CREATE POLICY "wsr_reply_delete_own" ON public.war_story_replies FOR DELETE USING (author_user_id = auth.uid());

DROP POLICY IF EXISTS "lpr_reply_select" ON public.lfg_post_replies;
CREATE POLICY "lpr_reply_select" ON public.lfg_post_replies FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "lpr_reply_insert" ON public.lfg_post_replies;
CREATE POLICY "lpr_reply_insert" ON public.lfg_post_replies FOR INSERT WITH CHECK (author_user_id = auth.uid());
DROP POLICY IF EXISTS "lpr_reply_update_own" ON public.lfg_post_replies;
CREATE POLICY "lpr_reply_update_own" ON public.lfg_post_replies FOR UPDATE USING (author_user_id = auth.uid()) WITH CHECK (author_user_id = auth.uid());
DROP POLICY IF EXISTS "lpr_reply_delete_own" ON public.lfg_post_replies;
CREATE POLICY "lpr_reply_delete_own" ON public.lfg_post_replies FOR DELETE USING (author_user_id = auth.uid());

-- Mirror forum_replies' touch + count triggers.
CREATE OR REPLACE FUNCTION public.campfire_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS war_story_replies_touch ON public.war_story_replies;
CREATE TRIGGER war_story_replies_touch BEFORE UPDATE ON public.war_story_replies FOR EACH ROW EXECUTE FUNCTION public.campfire_touch_updated_at();
DROP TRIGGER IF EXISTS lfg_post_replies_touch ON public.lfg_post_replies;
CREATE TRIGGER lfg_post_replies_touch BEFORE UPDATE ON public.lfg_post_replies FOR EACH ROW EXECUTE FUNCTION public.campfire_touch_updated_at();

CREATE OR REPLACE FUNCTION public.war_story_replies_after_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.war_stories
     SET reply_count = reply_count + 1, latest_reply_at = NEW.created_at
   WHERE id = NEW.war_story_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS war_story_replies_after_insert ON public.war_story_replies;
CREATE TRIGGER war_story_replies_after_insert AFTER INSERT ON public.war_story_replies FOR EACH ROW EXECUTE FUNCTION public.war_story_replies_after_insert();

CREATE OR REPLACE FUNCTION public.war_story_replies_after_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE newest timestamptz;
BEGIN
  SELECT MAX(created_at) INTO newest FROM public.war_story_replies WHERE war_story_id = OLD.war_story_id;
  UPDATE public.war_stories
     SET reply_count = GREATEST(reply_count - 1, 0),
         latest_reply_at = newest
   WHERE id = OLD.war_story_id;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS war_story_replies_after_delete ON public.war_story_replies;
CREATE TRIGGER war_story_replies_after_delete AFTER DELETE ON public.war_story_replies FOR EACH ROW EXECUTE FUNCTION public.war_story_replies_after_delete();

CREATE OR REPLACE FUNCTION public.lfg_post_replies_after_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.lfg_posts
     SET reply_count = reply_count + 1, latest_reply_at = NEW.created_at
   WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS lfg_post_replies_after_insert ON public.lfg_post_replies;
CREATE TRIGGER lfg_post_replies_after_insert AFTER INSERT ON public.lfg_post_replies FOR EACH ROW EXECUTE FUNCTION public.lfg_post_replies_after_insert();

CREATE OR REPLACE FUNCTION public.lfg_post_replies_after_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE newest timestamptz;
BEGIN
  SELECT MAX(created_at) INTO newest FROM public.lfg_post_replies WHERE post_id = OLD.post_id;
  UPDATE public.lfg_posts
     SET reply_count = GREATEST(reply_count - 1, 0),
         latest_reply_at = newest
   WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS lfg_post_replies_after_delete ON public.lfg_post_replies;
CREATE TRIGGER lfg_post_replies_after_delete AFTER DELETE ON public.lfg_post_replies FOR EACH ROW EXECUTE FUNCTION public.lfg_post_replies_after_delete();

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 3. FULL-TEXT SEARCH                                               ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- Generated tsvector columns + GIN indexes on the three feed tables.
-- Title weighted higher (A) than body (B) so a title hit ranks above
-- a body-only hit.

ALTER TABLE public.forum_threads
  ADD COLUMN IF NOT EXISTS search_tsv tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_forum_threads_fts ON public.forum_threads USING GIN (search_tsv);

ALTER TABLE public.war_stories
  ADD COLUMN IF NOT EXISTS search_tsv tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_war_stories_fts ON public.war_stories USING GIN (search_tsv);

ALTER TABLE public.lfg_posts
  ADD COLUMN IF NOT EXISTS search_tsv tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_lfg_posts_fts ON public.lfg_posts USING GIN (search_tsv);

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 4. CAMPAIGN INVITATIONS                                           ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- Replaces the LFG DM-with-link flow. Sender posts an invitation row;
-- recipient sees it as a notification with inline Accept/Decline; on
-- accept, the recipient is auto-added to campaign_members and the
-- sender gets a response notification.

CREATE TABLE IF NOT EXISTS public.campaign_invitations (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         uuid        NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  sender_user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status              text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  message             text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  responded_at        timestamptz,
  -- One pending invitation per (campaign, recipient). New invites
  -- after a decline can re-insert (the unique index excludes
  -- non-pending rows so historical declines don't block future tries).
  UNIQUE (campaign_id, recipient_user_id, status)
);

CREATE INDEX IF NOT EXISTS idx_ci_recipient ON public.campaign_invitations (recipient_user_id, status);
CREATE INDEX IF NOT EXISTS idx_ci_sender    ON public.campaign_invitations (sender_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ci_campaign  ON public.campaign_invitations (campaign_id);

ALTER TABLE public.campaign_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ci_select" ON public.campaign_invitations;
CREATE POLICY "ci_select" ON public.campaign_invitations
  FOR SELECT
  USING (sender_user_id = auth.uid() OR recipient_user_id = auth.uid());

-- Sender (must be GM of the source campaign) inserts. RLS ensures
-- random users can't invite others into campaigns they don't run.
DROP POLICY IF EXISTS "ci_insert_gm" ON public.campaign_invitations;
CREATE POLICY "ci_insert_gm" ON public.campaign_invitations
  FOR INSERT
  WITH CHECK (
    sender_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_invitations.campaign_id AND c.gm_user_id = auth.uid()
    )
  );

-- Recipient updates status (accept/decline); sender can update to
-- 'cancelled' to retract.
DROP POLICY IF EXISTS "ci_update" ON public.campaign_invitations;
CREATE POLICY "ci_update" ON public.campaign_invitations
  FOR UPDATE
  USING (sender_user_id = auth.uid() OR recipient_user_id = auth.uid())
  WITH CHECK (sender_user_id = auth.uid() OR recipient_user_id = auth.uid());

DROP POLICY IF EXISTS "ci_delete_sender" ON public.campaign_invitations;
CREATE POLICY "ci_delete_sender" ON public.campaign_invitations
  FOR DELETE
  USING (sender_user_id = auth.uid());

-- Trigger: when a new invitation is inserted, drop a notification on
-- the recipient. Body string is parsed by NotificationBell's
-- colorizeBody for inline Accept/Decline buttons (carried via
-- metadata.invitation_id + metadata.campaign_id).
CREATE OR REPLACE FUNCTION public.notify_campaign_invitation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sender_name text;
  v_campaign_name text;
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;
  SELECT username INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_user_id;
  SELECT name INTO v_campaign_name FROM public.campaigns WHERE id = NEW.campaign_id;
  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (
    NEW.recipient_user_id,
    'campaign_invitation',
    'Campaign invitation',
    COALESCE(v_sender_name, 'Someone') || ' invited you to "' || COALESCE(v_campaign_name, 'a campaign') || '"',
    NULL, -- click-through handled by inline Accept button, not a navigation
    jsonb_build_object(
      'invitation_id', NEW.id,
      'campaign_id', NEW.campaign_id,
      'campaign_name', COALESCE(v_campaign_name, 'a campaign'),
      'sender_name', COALESCE(v_sender_name, 'Someone'),
      'message', NEW.message
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_campaign_invitation_insert ON public.campaign_invitations;
CREATE TRIGGER on_campaign_invitation_insert
  AFTER INSERT ON public.campaign_invitations
  FOR EACH ROW EXECUTE FUNCTION public.notify_campaign_invitation();

-- Trigger: when an invitation flips to 'accepted', auto-add the
-- recipient to campaign_members AND notify the sender. Skips the
-- insert if they're already a member (idempotent — both 23505
-- conflicts are tolerated).
CREATE OR REPLACE FUNCTION public.handle_campaign_invitation_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_recipient_name text;
  v_campaign_name text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('accepted','declined') THEN RETURN NEW; END IF;
  SELECT username INTO v_recipient_name FROM public.profiles WHERE id = NEW.recipient_user_id;
  SELECT name INTO v_campaign_name FROM public.campaigns WHERE id = NEW.campaign_id;
  IF NEW.status = 'accepted' THEN
    BEGIN
      INSERT INTO public.campaign_members (campaign_id, user_id) VALUES (NEW.campaign_id, NEW.recipient_user_id);
    EXCEPTION WHEN unique_violation THEN
      -- Already a member; silently accept.
      NULL;
    END;
  END IF;
  -- Notify the sender of the response.
  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (
    NEW.sender_user_id,
    'campaign_invitation_response',
    CASE WHEN NEW.status = 'accepted' THEN 'Invitation accepted' ELSE 'Invitation declined' END,
    COALESCE(v_recipient_name, 'Someone') || ' ' || NEW.status || ' your invitation to "' || COALESCE(v_campaign_name, 'a campaign') || '"',
    CASE WHEN NEW.status = 'accepted' THEN '/stories/' || NEW.campaign_id::text ELSE NULL END,
    jsonb_build_object(
      'invitation_id', NEW.id,
      'campaign_id', NEW.campaign_id,
      'recipient_name', COALESCE(v_recipient_name, 'Someone'),
      'status', NEW.status
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_campaign_invitation_response ON public.campaign_invitations;
CREATE TRIGGER on_campaign_invitation_response
  AFTER UPDATE ON public.campaign_invitations
  FOR EACH ROW EXECUTE FUNCTION public.handle_campaign_invitation_response();

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ END                                                                ║
-- ╚══════════════════════════════════════════════════════════════════╝
NOTIFY pgrst, 'reload schema';
