-- community-events.sql
-- Phase 4D — Per-community Campfire feed.
--
-- Stores event rows for the in-community feed: auto-posts on Morale Check
-- finalize / Schism / Migration / Dissolution, plus manual GM "Post
-- community update" entries. Surfaces on the CampaignCommunity accordion
-- inside the campaign + on the /communities Following card.
--
-- Per the Phase 4 locked design: ship auto first, parse back if too noisy.
-- All four state transitions auto-post; the per-event payload jsonb
-- carries enough detail for the UI to render a consistent card without
-- re-fetching upstream rows.
--
-- author_user_id is the user who triggered the event (the finalizing GM,
-- the schism/migration trigger). System auto-posts therefore still have
-- a real user attached. Manual posts use 'manual' as the event_type.

CREATE TABLE IF NOT EXISTS public.community_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id    uuid        NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  -- Discriminator. Drives the renderer's icon + accent + layout.
  --   morale_outcome — weekly Morale finalize (success or failure tier)
  --   dissolution    — community flipped to status='dissolved'
  --   schism         — large community split; new community spawned
  --   migration      — survivors moved to a target community
  --   manual         — free-form GM post
  event_type      text        NOT NULL CHECK (event_type IN ('morale_outcome','dissolution','schism','migration','manual')),
  -- Per-type payload. Examples:
  --   morale_outcome: { week: 7, outcome: 'success' | 'wild' | 'failure' | …,
  --                     fed: 'success', clothed: 'failure',
  --                     departures_count: 2, modifiers_summary: '+2 Mood, -1 Hands' }
  --   dissolution:    { week: 9, consecutive_failures: 3, members_lost: 14 }
  --   schism:         { new_community_id: <uuid>, new_community_name: '…', members_left: 5 }
  --   migration:      { target_community_id: <uuid>, target_community_name: '…', members_moved: 3 }
  --   manual:         { body: 'free-form text written by GM' }
  payload         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  -- Author. NULL only if a system trigger fires without a user context
  -- (currently no such path; reserved for future server-side automation).
  author_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_events_community
  ON public.community_events (community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_events_type
  ON public.community_events (event_type, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;

-- Read: campaign members get full access (mirrors community_members
-- select pattern in communities-phase-a.sql). PostgREST evaluates
-- policies as OR — the public-published policy below is a separate
-- branch.
DROP POLICY IF EXISTS "ce_select" ON public.community_events;
DROP POLICY IF EXISTS "ce_select_member" ON public.community_events;
CREATE POLICY "ce_select_member" ON public.community_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.communities com
      JOIN public.campaigns c ON c.id = com.campaign_id
      WHERE com.id = community_events.community_id
        AND (
          c.gm_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid())
        )
    )
  );

-- Read: any signed-in user can read events for a community whose
-- world_communities mirror is published + approved. Lets followers see
-- the event feed on the /communities Following card without joining
-- the source campaign. Mirrors world_communities' approved-public
-- read policy.
DROP POLICY IF EXISTS "ce_select_published" ON public.community_events;
CREATE POLICY "ce_select_published" ON public.community_events
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.world_communities wc
      WHERE wc.source_community_id = community_events.community_id
        AND wc.moderation_status = 'approved'
    )
  );

-- Insert: campaign GM or any campaign member (the auto-post hooks fire
-- from whoever triggered the action, including PCs; the manual composer
-- is GM-only — UI gates the manual case).
DROP POLICY IF EXISTS "ce_insert" ON public.community_events;
CREATE POLICY "ce_insert" ON public.community_events
  FOR INSERT
  WITH CHECK (
    author_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.communities com
      JOIN public.campaigns c ON c.id = com.campaign_id
      WHERE com.id = community_events.community_id
        AND (
          c.gm_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid())
        )
    )
  );

-- Update: the GM can edit a manual post they wrote; auto-posts are
-- effectively immutable (UI doesn't expose edit). Allow the campaign
-- GM to amend any event for moderation.
DROP POLICY IF EXISTS "ce_update_gm" ON public.community_events;
CREATE POLICY "ce_update_gm" ON public.community_events
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.communities com
      JOIN public.campaigns c ON c.id = com.campaign_id
      WHERE com.id = community_events.community_id AND c.gm_user_id = auth.uid()
    )
  );

-- Delete: GM can remove an event (e.g. retract a noisy auto-post).
DROP POLICY IF EXISTS "ce_delete_gm" ON public.community_events;
CREATE POLICY "ce_delete_gm" ON public.community_events
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.communities com
      JOIN public.campaigns c ON c.id = com.campaign_id
      WHERE com.id = community_events.community_id AND c.gm_user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
