-- ============================================================
-- Communities — Phase A foundation schema
-- Spec: tasks/spec-communities.md
--
-- Implements XSE SRD v1.1 §08 Communities + Recruitment + Morale.
-- Phase A = DB + RLS + manual member management. Phases B–E layer on
-- top. Day-one columns marked (PHASE E) below so the Tapestry persistent-
-- world migration (spec §11 Phase E) is additive, not a breaking change.
--
-- Run once in the Supabase SQL Editor. Idempotent.
-- ============================================================

-- ── 1. communities ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  homestead_pin_id uuid REFERENCES public.campaign_pins(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'forming' CHECK (status IN ('forming','active','dissolved')),
  leader_npc_id uuid REFERENCES public.campaign_npcs(id) ON DELETE SET NULL,
  leader_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  consecutive_failures int NOT NULL DEFAULT 0,
  week_number int NOT NULL DEFAULT 0,              -- PHASE C tracks Morale weeks
  created_at timestamptz NOT NULL DEFAULT now(),
  dissolved_at timestamptz,
  -- PHASE E — persistent-world layer (unused in Phase A but reserved so the
  -- migration to world_communities is additive rather than ALTER-heavy).
  published_at timestamptz,                        -- when GM published to Distemperverse
  world_visibility text NOT NULL DEFAULT 'private' CHECK (world_visibility IN ('private','published')),
  world_community_id uuid                          -- FK to world_communities (future table)
);
CREATE INDEX IF NOT EXISTS idx_communities_campaign ON public.communities(campaign_id, status);

-- ── 2. community_members ─────────────────────────────────────
-- An NPC or PC in the community. Exactly ONE of npc_id / character_id is set.
CREATE TABLE IF NOT EXISTS public.community_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  npc_id uuid REFERENCES public.campaign_npcs(id) ON DELETE CASCADE,
  character_id uuid REFERENCES public.characters(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'unassigned' CHECK (role IN ('gatherer','maintainer','safety','unassigned')),
  recruitment_type text NOT NULL DEFAULT 'founder' CHECK (recruitment_type IN ('cohort','conscript','convert','apprentice','founder')),
  apprentice_of_character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  left_reason text CHECK (left_reason IS NULL OR left_reason IN ('morale_25','morale_50','dissolved','manual','killed')),
  -- XOR constraint: exactly one of npc_id / character_id must be set.
  CONSTRAINT community_member_one_subject CHECK (
    (npc_id IS NOT NULL AND character_id IS NULL) OR
    (npc_id IS NULL AND character_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_community_members_community ON public.community_members(community_id, role) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_community_members_npc ON public.community_members(npc_id) WHERE npc_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_members_character ON public.community_members(character_id) WHERE character_id IS NOT NULL;

-- ── 3. community_morale_checks (Phase C writes here) ─────────
-- Phase A creates the table so the audit log exists from day one; writes
-- begin in Phase C when the weekly Morale Check flow lands.
CREATE TABLE IF NOT EXISTS public.community_morale_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  week_number int NOT NULL,
  rolled_at timestamptz NOT NULL DEFAULT now(),
  rolled_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  die1 int NOT NULL,
  die2 int NOT NULL,
  amod int NOT NULL DEFAULT 0,
  smod int NOT NULL DEFAULT 0,
  cmod_total int NOT NULL DEFAULT 0,
  total int NOT NULL,
  outcome text NOT NULL,                            -- success / wild_success / high_insight / failure / dire_failure / low_insight
  cmod_for_next int NOT NULL DEFAULT 0,
  modifiers_json jsonb NOT NULL DEFAULT '{}'::jsonb,-- snapshot of 6 slots + extras
  members_before int NOT NULL,
  members_after int NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_community_morale_community ON public.community_morale_checks(community_id, week_number DESC);

-- ── 4. community_resource_checks (Phase C writes here) ───────
CREATE TABLE IF NOT EXISTS public.community_resource_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('fed','clothed')),
  week_number int NOT NULL,
  rolled_at timestamptz NOT NULL DEFAULT now(),
  rolled_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  die1 int NOT NULL,
  die2 int NOT NULL,
  amod int NOT NULL DEFAULT 0,
  smod int NOT NULL DEFAULT 0,
  cmod_total int NOT NULL DEFAULT 0,
  total int NOT NULL,
  outcome text NOT NULL,
  cmod_for_next_morale int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_community_resource_community ON public.community_resource_checks(community_id, week_number DESC, kind);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_morale_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_resource_checks ENABLE ROW LEVEL SECURITY;

-- Helper: campaign member predicate. Inlined in each policy so policy
-- expressions stay deterministic and ad-hoc.

-- ── communities ──
DROP POLICY IF EXISTS communities_select ON public.communities;
CREATE POLICY communities_select ON public.communities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = communities.campaign_id
        AND (
          c.gm_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS communities_insert ON public.communities;
CREATE POLICY communities_insert ON public.communities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = communities.campaign_id AND c.gm_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS communities_update ON public.communities;
CREATE POLICY communities_update ON public.communities FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = communities.campaign_id AND c.gm_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS communities_delete ON public.communities;
CREATE POLICY communities_delete ON public.communities FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = communities.campaign_id AND c.gm_user_id = auth.uid()
    )
  );

-- ── community_members ──
DROP POLICY IF EXISTS community_members_select ON public.community_members;
CREATE POLICY community_members_select ON public.community_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.communities com
      JOIN public.campaigns c ON c.id = com.campaign_id
      WHERE com.id = community_members.community_id
        AND (
          c.gm_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS community_members_insert ON public.community_members;
CREATE POLICY community_members_insert ON public.community_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.communities com
      JOIN public.campaigns c ON c.id = com.campaign_id
      WHERE com.id = community_members.community_id AND c.gm_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS community_members_update ON public.community_members;
CREATE POLICY community_members_update ON public.community_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.communities com
      JOIN public.campaigns c ON c.id = com.campaign_id
      WHERE com.id = community_members.community_id AND c.gm_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS community_members_delete ON public.community_members;
CREATE POLICY community_members_delete ON public.community_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.communities com
      JOIN public.campaigns c ON c.id = com.campaign_id
      WHERE com.id = community_members.community_id AND c.gm_user_id = auth.uid()
    )
  );

-- ── community_morale_checks ──
DROP POLICY IF EXISTS community_morale_select ON public.community_morale_checks;
CREATE POLICY community_morale_select ON public.community_morale_checks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.communities com
      JOIN public.campaigns c ON c.id = com.campaign_id
      WHERE com.id = community_morale_checks.community_id
        AND (
          c.gm_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS community_morale_insert ON public.community_morale_checks;
CREATE POLICY community_morale_insert ON public.community_morale_checks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.communities com
      JOIN public.campaigns c ON c.id = com.campaign_id
      WHERE com.id = community_morale_checks.community_id AND c.gm_user_id = auth.uid()
    )
  );

-- ── community_resource_checks ──
DROP POLICY IF EXISTS community_resource_select ON public.community_resource_checks;
CREATE POLICY community_resource_select ON public.community_resource_checks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.communities com
      JOIN public.campaigns c ON c.id = com.campaign_id
      WHERE com.id = community_resource_checks.community_id
        AND (
          c.gm_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS community_resource_insert ON public.community_resource_checks;
CREATE POLICY community_resource_insert ON public.community_resource_checks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.communities com
      JOIN public.campaigns c ON c.id = com.campaign_id
      WHERE com.id = community_resource_checks.community_id AND c.gm_user_id = auth.uid()
    )
  );
