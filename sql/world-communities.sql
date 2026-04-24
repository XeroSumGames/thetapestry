-- Phase E (The Tapestry) Sprint 1 — world_communities mirror table.
-- Mirrors the world_npcs pattern: a sanitized public-facing copy of a
-- campaign community, created when the owning GM clicks "Publish to
-- Distemperverse". Thriver moderation flips status pending → approved.
-- Only approved rows render on the world map / cross-campaign surfaces.
-- The source community's private data never leaves its campaign; only
-- the columns here cross into world scope.

CREATE TABLE IF NOT EXISTS public.world_communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Lineage — the campaign-scoped source. CASCADE so deleting a
  -- community auto-removes its world-facing row.
  source_community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  source_campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  -- Who published (for attribution + per-user moderation tracking).
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Public-facing metadata. All GM-authored / GM-sanitized.
  name text NOT NULL,
  description text,
  -- Homestead location as flat lat/lng (no campaign pin link — the
  -- world map doesn't know about campaign_pins).
  homestead_lat double precision,
  homestead_lng double precision,
  -- Narrative labels. size_band computed at publish time from the
  -- source community's roster; can be overridden by GM. faction_label
  -- freeform (e.g. "Mercantile", "Reformed Church", "Mongrels").
  size_band text NOT NULL DEFAULT 'Group' CHECK (size_band IN ('Group','Small','Medium','Large','Huge','Nation State')),
  faction_label text,
  -- Public status — the Distemperverse-facing health label. Distinct
  -- from moderation_status below. Set at publish time from current
  -- community state; updated when the GM sends a public update.
  community_status text NOT NULL DEFAULT 'Holding' CHECK (community_status IN ('Thriving','Holding','Struggling','Dying','Dissolved')),
  -- Moderation — Thriver gate. Matches world_npcs pattern.
  moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending','approved','rejected')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  moderator_notes text,
  -- Lifecycle timestamps.
  created_at timestamptz NOT NULL DEFAULT now(),
  last_public_update_at timestamptz NOT NULL DEFAULT now(),
  -- One published row per source community. Re-publishing reuses the
  -- row via UPDATE (preserves moderation + stats).
  CONSTRAINT world_communities_one_per_source UNIQUE (source_community_id)
);

CREATE INDEX IF NOT EXISTS idx_world_communities_moderation
  ON public.world_communities(moderation_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_communities_source
  ON public.world_communities(source_community_id);

-- Back-link — optional FK so existing communities.world_community_id
-- column (added day-one in communities-phase-a.sql) points at the
-- right row. Nullable: unpublished communities have no world row.
-- Dropping first so re-running is idempotent.
ALTER TABLE public.communities
  DROP CONSTRAINT IF EXISTS communities_world_community_fk;
ALTER TABLE public.communities
  ADD CONSTRAINT communities_world_community_fk
  FOREIGN KEY (world_community_id)
  REFERENCES public.world_communities(id)
  ON DELETE SET NULL;

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.world_communities ENABLE ROW LEVEL SECURITY;

-- Anyone (authenticated or not) can read APPROVED rows — they're
-- public by definition.
DROP POLICY IF EXISTS "world_communities_read_approved" ON public.world_communities;
CREATE POLICY "world_communities_read_approved"
  ON public.world_communities FOR SELECT
  USING (moderation_status = 'approved');

-- The publishing user (or any campaign member of the source
-- campaign) can read their own pending/rejected rows to see
-- moderation status. Keeps private drafts visible to their owners.
DROP POLICY IF EXISTS "world_communities_read_own" ON public.world_communities;
CREATE POLICY "world_communities_read_own"
  ON public.world_communities FOR SELECT
  USING (
    published_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.campaign_members cm
      WHERE cm.campaign_id = world_communities.source_campaign_id
        AND cm.user_id = auth.uid()
    )
  );

-- Thrivers can read everything (moderation queue).
DROP POLICY IF EXISTS "world_communities_read_thriver" ON public.world_communities;
CREATE POLICY "world_communities_read_thriver"
  ON public.world_communities FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

-- Any authenticated user can INSERT rows, BUT only where:
--   - they are the GM of the source campaign, AND
--   - published_by = auth.uid().
-- This keeps random users from publishing communities they don't own.
DROP POLICY IF EXISTS "world_communities_insert_gm" ON public.world_communities;
CREATE POLICY "world_communities_insert_gm"
  ON public.world_communities FOR INSERT
  WITH CHECK (
    published_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = world_communities.source_campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );

-- UPDATE — Thriver can update moderation fields; the original
-- publisher (or the campaign GM) can update public metadata like
-- description, faction_label, community_status, last_public_update_at.
-- Single broad policy because Postgres row-level security doesn't
-- gate by column; client must respect the split (Thriver UI updates
-- moderation_status; GM UI updates the rest).
DROP POLICY IF EXISTS "world_communities_update" ON public.world_communities;
CREATE POLICY "world_communities_update"
  ON public.world_communities FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
    OR published_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = world_communities.source_campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );

-- DELETE — same surface as UPDATE (publisher / GM / Thriver). Useful
-- for "unpublish" which just removes the row.
DROP POLICY IF EXISTS "world_communities_delete" ON public.world_communities;
CREATE POLICY "world_communities_delete"
  ON public.world_communities FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
    OR published_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = world_communities.source_campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );
