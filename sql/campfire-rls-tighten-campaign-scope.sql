-- campfire-rls-tighten-campaign-scope.sql
-- Phase 4 Campfire — security follow-up. Closes the SELECT RLS gap on
-- campaign-scoped Campfire content so only campaign members + the GM
-- can read rows tagged with a campaign_id. NULL stays public.
--
-- Backstory: Phase 4A.5 (forum-threads-campaign-id.sql) added the
-- column but explicitly deferred RLS tightening. Phase 4B
-- (campfire-moderation.sql) split SELECT into three permissive
-- policies (`*_select_approved`, `*_select_own`, `*_select_thriver`)
-- that get OR'd. Pre-launch triage (2026-05-01) flagged the gap as
-- the #1 BLOCKING item — campaign-private threads/stories were
-- readable by every signed-in user via the `_select_approved` path.
--
-- Strategy: merge the campaign-scope check INTO `*_select_approved`
-- so the public-read path is gated. `*_select_own` and
-- `*_select_thriver` remain untouched — author always sees own,
-- Thriver always sees all (moderation queue).
--
-- Reply + reaction tables don't have moderation_status; they have a
-- single SELECT policy each. Those policies are replaced with a
-- check that inherits visibility from the parent thread/story.
--
-- Coverage:
--   - public.forum_threads          ft_select_approved (campaign-aware)
--   - public.forum_replies          fr_select          (inherits via thread)
--   - public.forum_thread_reactions ftr_select         (inherits via thread)
--   - public.war_stories            ws_select_approved (campaign-aware)
--   - public.war_story_replies      wsr_reply_select   (inherits via story)
--   - public.war_story_reactions    wsr_select         (inherits via story)
--
-- Out of scope (intentionally):
--   - lfg_posts: cross-campaign by design, no campaign_id column.
--   - storage bucket 'war-stories': public-read by design (random
--     paths, low enumerability). Re-evaluate if a real leak surfaces.
--
-- Idempotent — safe to re-run.

-- ── forum_threads.ft_select_approved (campaign-aware) ─────────────
DROP POLICY IF EXISTS "ft_select_approved" ON public.forum_threads;
CREATE POLICY "ft_select_approved" ON public.forum_threads
  FOR SELECT TO authenticated
  USING (
    moderation_status = 'approved'
    AND (
      campaign_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = forum_threads.campaign_id
          AND c.gm_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.campaign_members cm
        WHERE cm.campaign_id = forum_threads.campaign_id
          AND cm.user_id = auth.uid()
      )
    )
  );

-- ── forum_replies.fr_select (inherit via thread) ─────────────────
DROP POLICY IF EXISTS "fr_select" ON public.forum_replies;
CREATE POLICY "fr_select" ON public.forum_replies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.forum_threads t
      WHERE t.id = forum_replies.thread_id
        AND (
          t.campaign_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.campaigns c
            WHERE c.id = t.campaign_id
              AND c.gm_user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.campaign_members cm
            WHERE cm.campaign_id = t.campaign_id
              AND cm.user_id = auth.uid()
          )
        )
    )
  );

-- ── forum_thread_reactions.ftr_select (inherit via thread) ───────
DROP POLICY IF EXISTS "ftr_select" ON public.forum_thread_reactions;
CREATE POLICY "ftr_select" ON public.forum_thread_reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.forum_threads t
      WHERE t.id = forum_thread_reactions.thread_id
        AND (
          t.campaign_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.campaigns c
            WHERE c.id = t.campaign_id
              AND c.gm_user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.campaign_members cm
            WHERE cm.campaign_id = t.campaign_id
              AND cm.user_id = auth.uid()
          )
        )
    )
  );

-- ── war_stories.ws_select_approved (campaign-aware) ──────────────
DROP POLICY IF EXISTS "ws_select_approved" ON public.war_stories;
CREATE POLICY "ws_select_approved" ON public.war_stories
  FOR SELECT TO authenticated
  USING (
    moderation_status = 'approved'
    AND (
      campaign_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = war_stories.campaign_id
          AND c.gm_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.campaign_members cm
        WHERE cm.campaign_id = war_stories.campaign_id
          AND cm.user_id = auth.uid()
      )
    )
  );

-- ── war_story_replies.wsr_reply_select (inherit via story) ───────
DROP POLICY IF EXISTS "wsr_reply_select" ON public.war_story_replies;
CREATE POLICY "wsr_reply_select" ON public.war_story_replies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.war_stories s
      WHERE s.id = war_story_replies.war_story_id
        AND (
          s.campaign_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.campaigns c
            WHERE c.id = s.campaign_id
              AND c.gm_user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.campaign_members cm
            WHERE cm.campaign_id = s.campaign_id
              AND cm.user_id = auth.uid()
          )
        )
    )
  );

-- ── war_story_reactions.wsr_select (inherit via story) ───────────
DROP POLICY IF EXISTS "wsr_select" ON public.war_story_reactions;
CREATE POLICY "wsr_select" ON public.war_story_reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.war_stories s
      WHERE s.id = war_story_reactions.war_story_id
        AND (
          s.campaign_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.campaigns c
            WHERE c.id = s.campaign_id
              AND c.gm_user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.campaign_members cm
            WHERE cm.campaign_id = s.campaign_id
              AND cm.user_id = auth.uid()
          )
        )
    )
  );

NOTIFY pgrst, 'reload schema';
