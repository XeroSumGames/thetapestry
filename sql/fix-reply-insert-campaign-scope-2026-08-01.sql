-- Fix: forum_replies and war_story_replies INSERT policies don't check
-- campaign membership at all - only the sibling SELECT policies do
-- (fr_select / wsr_reply_select correctly gate on campaign_id IS NULL
-- OR GM OR campaign_member). Read is scoped, write is not, on the same
-- table.
--
-- Any authenticated user who obtains a thread_id/war_story_id belonging
-- to a private campaign they are NOT a member of (an ex-member who was
-- removed, a leaked share link, a UUID pasted outside the app) can
-- INSERT a reply row directly. They can't read it back themselves
-- (SELECT is properly gated), but the campaign's real members/GM will
-- see the injected content in-thread - a cross-campaign content-
-- injection/harassment vector that fully bypasses campaign privacy on
-- the write side. Also lets a reply land on a thread/story that hasn't
-- cleared moderation yet (pending, campaign_id IS NULL case).
--
-- Fix: add the identical campaign-scoping EXISTS clause the SELECT
-- policies already use, so INSERT requires the same membership. Also
-- adds the analogous check to war_story_replies, which previously had
-- no scoping condition beyond author_user_id at all.

BEGIN;

DROP POLICY IF EXISTS fr_insert ON public.forum_replies;
CREATE POLICY fr_insert ON public.forum_replies
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM forum_threads t WHERE t.id = forum_replies.thread_id AND t.locked = true)
    AND EXISTS (
      SELECT 1 FROM forum_threads t
      WHERE t.id = forum_replies.thread_id
        AND (
          t.campaign_id IS NULL
          OR EXISTS (SELECT 1 FROM campaigns c WHERE c.id = t.campaign_id AND c.gm_user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM campaign_members cm WHERE cm.campaign_id = t.campaign_id AND cm.user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS wsr_reply_insert ON public.war_story_replies;
CREATE POLICY wsr_reply_insert ON public.war_story_replies
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM war_stories s
      WHERE s.id = war_story_replies.war_story_id
        AND (
          s.campaign_id IS NULL
          OR EXISTS (SELECT 1 FROM campaigns c WHERE c.id = s.campaign_id AND c.gm_user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM campaign_members cm WHERE cm.campaign_id = s.campaign_id AND cm.user_id = auth.uid())
        )
    )
  );

COMMIT;
