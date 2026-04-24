-- Phase 5 Sprint 1 — Module System MVP.
--
-- Modules are publishable, versioned, clone-into-campaign snapshots of
-- GM-authored content. Phase A covers the minimum viable loop:
--   1. Schema for modules / module_versions / module_subscriptions
--   2. Source-tracking columns on the campaign-scoped tables that
--      cloneModuleIntoCampaign writes into (so Phase B can diff/merge
--      updates without guessing provenance)
--   3. RLS policies that mirror the spec's visibility tiers
--      (private / unlisted / listed — with listed gated by Thriver
--      moderation for quality floor)
--
-- Idempotent — safe to re-run.

-- ── modules ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The author. Keeps modules alive if the author leaves (hard delete
  -- of auth row just nulls this out; the module keeps working for
  -- existing subscribers).
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- The campaign the author worked inside. Nullable because Phase B
  -- will let authors delete the source after publish without breaking
  -- downstream campaigns (the snapshot is self-contained).
  source_campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  -- Presentation fields. Most are optional for MVP; Phase 5 marketplace
  -- will tighten required fields.
  name text NOT NULL,
  tagline text,
  description text,
  cover_image_url text,
  -- Parent setting slug (matches lib/settings.ts keys) so downstream
  -- campaign-create UI can theme appropriately.
  parent_setting text,
  -- Free-form tags for the Phase C marketplace filter.
  content_tags text[],
  session_count_estimate int,
  player_count_recommended int,
  -- Visibility tier per spec §2b.
  visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private','unlisted','listed')),
  -- Listed modules go through Thriver moderation. Default status is
  -- 'pending' for all rows; it only matters once visibility='listed'.
  -- Private / unlisted modules are usable immediately by the author.
  moderation_status text NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending','approved','rejected')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  -- Cached pointer to the most recent published version so listing
  -- queries don't need a LATERAL join. Updated by the publish wizard
  -- (Sprint 2) and by a trigger below when a new version lands.
  latest_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_modules_author ON public.modules(author_user_id);
CREATE INDEX IF NOT EXISTS idx_modules_visibility
  ON public.modules(visibility, moderation_status)
  WHERE visibility = 'listed';

-- ── module_versions ─────────────────────────────────────────────
-- One immutable snapshot per publish. Never edited after insert;
-- authors publish a new version instead. Snapshot is a flat jsonb
-- payload: { npcs: [], pins: [], scenes: [{...,tokens:[]}],
-- handouts: [], objects?: [], pregens?: [], communities?: [] }.
CREATE TABLE IF NOT EXISTS public.module_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  -- Semver string ('1.0.0') + parsed parts so version ordering works
  -- as a plain ORDER BY without string tricks. Parsed parts are
  -- denormalized but cheap to keep in sync.
  version text NOT NULL,
  version_major int NOT NULL DEFAULT 1,
  version_minor int NOT NULL DEFAULT 0,
  version_patch int NOT NULL DEFAULT 0,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Author-authored release notes. Phase 2 review UI renders this.
  changelog text,
  -- The payload. Shape validated by the publish wizard (Sprint 2);
  -- at DB level we only require non-null.
  snapshot jsonb NOT NULL,
  subscriber_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, version)
);

CREATE INDEX IF NOT EXISTS idx_module_versions_module
  ON public.module_versions(module_id, published_at DESC);

-- Keep modules.latest_version_id in sync as versions land. The cache
-- lets the marketplace render a module card with one SELECT.
CREATE OR REPLACE FUNCTION public.bump_module_latest_version()
RETURNS trigger AS $$
BEGIN
  UPDATE public.modules
    SET latest_version_id = NEW.id
  WHERE id = NEW.module_id
    AND (latest_version_id IS NULL
         OR (SELECT published_at FROM public.module_versions WHERE id = latest_version_id) < NEW.published_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_module_versions_bump_latest ON public.module_versions;
CREATE TRIGGER trg_module_versions_bump_latest
  AFTER INSERT ON public.module_versions
  FOR EACH ROW EXECUTE FUNCTION public.bump_module_latest_version();

-- ── module_subscriptions ────────────────────────────────────────
-- One row per (campaign, module) pair. Created by
-- cloneModuleIntoCampaign at campaign-create time. Phase B will use
-- this to surface "a new version of X is out" on the subscriber's
-- dashboard.
CREATE TABLE IF NOT EXISTS public.module_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  current_version_id uuid REFERENCES public.module_versions(id) ON DELETE SET NULL,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  -- 'active' = tracking upstream updates; 'forked' = opted out of
  -- updates; 'unsubscribed' = user explicitly severed the link.
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','forked','unsubscribed')),
  UNIQUE (campaign_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_module_subscriptions_campaign
  ON public.module_subscriptions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_module_subscriptions_module
  ON public.module_subscriptions(module_id);

-- ── Source tracking on cloned content ──────────────────────────
-- Every cloned row records which module version it came from, so
-- Phase B can identify "author changed this NPC; subscriber also
-- edited it; show a merge prompt." Nullable — non-module-derived
-- rows just leave these null.

ALTER TABLE public.campaign_npcs
  ADD COLUMN IF NOT EXISTS source_module_id uuid
    REFERENCES public.modules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_module_version_id uuid
    REFERENCES public.module_versions(id) ON DELETE SET NULL;

ALTER TABLE public.campaign_pins
  ADD COLUMN IF NOT EXISTS source_module_id uuid
    REFERENCES public.modules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_module_version_id uuid
    REFERENCES public.module_versions(id) ON DELETE SET NULL;

ALTER TABLE public.tactical_scenes
  ADD COLUMN IF NOT EXISTS source_module_id uuid
    REFERENCES public.modules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_module_version_id uuid
    REFERENCES public.module_versions(id) ON DELETE SET NULL;

ALTER TABLE public.scene_tokens
  ADD COLUMN IF NOT EXISTS source_module_id uuid
    REFERENCES public.modules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_module_version_id uuid
    REFERENCES public.module_versions(id) ON DELETE SET NULL;

ALTER TABLE public.campaign_notes
  ADD COLUMN IF NOT EXISTS source_module_id uuid
    REFERENCES public.modules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_module_version_id uuid
    REFERENCES public.module_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_npcs_source_module_version
  ON public.campaign_npcs(source_module_version_id)
  WHERE source_module_version_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_pins_source_module_version
  ON public.campaign_pins(source_module_version_id)
  WHERE source_module_version_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tactical_scenes_source_module_version
  ON public.tactical_scenes(source_module_version_id)
  WHERE source_module_version_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scene_tokens_source_module_version
  ON public.scene_tokens(source_module_version_id)
  WHERE source_module_version_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_notes_source_module_version
  ON public.campaign_notes(source_module_version_id)
  WHERE source_module_version_id IS NOT NULL;

-- ── RLS — modules ──────────────────────────────────────────────
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

-- Read: author always; listed+approved → everyone; unlisted → anyone
-- who knows the id (effectively everyone at the RLS level, but the UI
-- gates discovery behind invite links only); private → author only;
-- Thriver god-read.
DROP POLICY IF EXISTS "modules_read" ON public.modules;
CREATE POLICY "modules_read"
  ON public.modules FOR SELECT
  USING (
    author_user_id = auth.uid()
    OR (visibility = 'listed' AND moderation_status = 'approved')
    OR visibility = 'unlisted'
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

-- Insert: only as your own author_user_id.
DROP POLICY IF EXISTS "modules_insert" ON public.modules;
CREATE POLICY "modules_insert"
  ON public.modules FOR INSERT
  WITH CHECK (author_user_id = auth.uid());

-- Update: author owns their module. Thriver can flip
-- moderation_status (approve/reject listed submissions).
DROP POLICY IF EXISTS "modules_update" ON public.modules;
CREATE POLICY "modules_update"
  ON public.modules FOR UPDATE
  USING (
    author_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

-- Delete: author or Thriver. Cascades to module_versions +
-- subscriptions via FK.
DROP POLICY IF EXISTS "modules_delete" ON public.modules;
CREATE POLICY "modules_delete"
  ON public.modules FOR DELETE
  USING (
    author_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

-- ── RLS — module_versions ──────────────────────────────────────
ALTER TABLE public.module_versions ENABLE ROW LEVEL SECURITY;

-- Read: if you can SELECT the parent module, you can SELECT its
-- versions. Subscribers need this to clone the snapshot; browsers
-- need it to preview a listing.
DROP POLICY IF EXISTS "module_versions_read" ON public.module_versions;
CREATE POLICY "module_versions_read"
  ON public.module_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.modules m
      WHERE m.id = module_versions.module_id
        AND (
          m.author_user_id = auth.uid()
          OR (m.visibility = 'listed' AND m.moderation_status = 'approved')
          OR m.visibility = 'unlisted'
          OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
        )
    )
  );

-- Insert: only the module's author can publish a new version.
DROP POLICY IF EXISTS "module_versions_insert" ON public.module_versions;
CREATE POLICY "module_versions_insert"
  ON public.module_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.modules m
      WHERE m.id = module_versions.module_id
        AND m.author_user_id = auth.uid()
    )
  );

-- Update / Delete: versions are immutable in principle, but we allow
-- Thriver to delete a version in case of moderation removal. Authors
-- can't mutate a published version (subscribers depend on it).
DROP POLICY IF EXISTS "module_versions_delete" ON public.module_versions;
CREATE POLICY "module_versions_delete"
  ON public.module_versions FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

-- Allow author to UPDATE subscriber_count (the trigger approach is
-- overkill for MVP; we'll maintain it from the subscribe action).
DROP POLICY IF EXISTS "module_versions_update" ON public.module_versions;
CREATE POLICY "module_versions_update"
  ON public.module_versions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.modules m
      WHERE m.id = module_versions.module_id
        AND m.author_user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

-- ── RLS — module_subscriptions ──────────────────────────────────
ALTER TABLE public.module_subscriptions ENABLE ROW LEVEL SECURITY;

-- Read: the subscribing campaign's GM + the module's author (so the
-- author can see who's running their module). Thriver god-read.
DROP POLICY IF EXISTS "module_subscriptions_read" ON public.module_subscriptions;
CREATE POLICY "module_subscriptions_read"
  ON public.module_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = module_subscriptions.campaign_id
        AND c.gm_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.modules m
      WHERE m.id = module_subscriptions.module_id
        AND m.author_user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

-- Insert / Update / Delete: the subscribing campaign's GM only.
DROP POLICY IF EXISTS "module_subscriptions_insert" ON public.module_subscriptions;
CREATE POLICY "module_subscriptions_insert"
  ON public.module_subscriptions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = module_subscriptions.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "module_subscriptions_update" ON public.module_subscriptions;
CREATE POLICY "module_subscriptions_update"
  ON public.module_subscriptions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = module_subscriptions.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "module_subscriptions_delete" ON public.module_subscriptions;
CREATE POLICY "module_subscriptions_delete"
  ON public.module_subscriptions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = module_subscriptions.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );
