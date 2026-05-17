-- 000-initiative-order-canonical-2026-05-17.sql
-- Pre-launch audit R9 (tasks/pre-launch-audit-2026-05-17.md).
--
-- Background. `initiative_order` is a core combat table. Until now the
-- repo had NO canonical CREATE TABLE statement for it — the schema was
-- assembled across scattered ALTER TABLE files (combat-actions-v2.sql,
-- coordinate-columns.sql, grapple-column.sql, etc). If the table is
-- ever recreated (point-in-time restore, dev seed, migration to a new
-- project), columns like defense_bonus / aim_active / grappled_by /
-- inspired_this_round / winded would NOT exist anywhere as a single
-- source of truth.
--
-- This file is that single source of truth. Reverse-engineered from
-- the live DB (commit base d2ba6b6 / 2026-05-17) via
-- information_schema + pg_indexes + pg_policy queries. Idempotent —
-- safe to re-apply, will only create missing pieces.
--
-- Also lands a previously-missing performance index on campaign_id —
-- discovered while extracting this schema. Every "load this campaign's
-- initiative order" query was a sequential scan against the pkey-only
-- table; at scale this becomes the dominant cost of opening the
-- live-session page.
--
-- Apply via:
--   npx supabase db query --linked -f sql/000-initiative-order-canonical-2026-05-17.sql

CREATE TABLE IF NOT EXISTS public.initiative_order (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  character_name        text NOT NULL,
  character_id          uuid,
  user_id               uuid,
  roll                  integer NOT NULL,
  is_active             boolean DEFAULT false,
  is_npc                boolean DEFAULT false,
  turn_number           integer DEFAULT 0,
  created_at            timestamptz DEFAULT now(),
  npc_id                uuid,
  portrait_url          text,
  npc_type              text,
  actions_remaining     integer DEFAULT 2,
  aim_bonus             integer DEFAULT 0,
  defense_bonus         integer NOT NULL DEFAULT 0,
  has_cover             boolean NOT NULL DEFAULT false,
  winded                boolean NOT NULL DEFAULT false,
  last_attack_target    text,
  inspired_this_round   boolean NOT NULL DEFAULT false,
  aim_active            boolean NOT NULL DEFAULT false,
  coordinate_target     text,
  coordinate_bonus      integer NOT NULL DEFAULT 0,
  grappled_by           text
);

-- Performance index on campaign_id — every read filters by this and
-- the table previously had only the pkey. Sort by roll within campaign
-- so the initiative-bar fetch can read in-order.
CREATE INDEX IF NOT EXISTS idx_initiative_order_campaign
  ON public.initiative_order (campaign_id, roll DESC);

-- RLS — campaign members + GM read/insert/update; GM only delete.
-- Idempotent DROP+CREATE so re-applying converges.
ALTER TABLE public.initiative_order ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Campaign members read initiative" ON public.initiative_order;
CREATE POLICY "Campaign members read initiative" ON public.initiative_order
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.campaign_members cm
             WHERE cm.campaign_id = initiative_order.campaign_id AND cm.user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.campaigns c
             WHERE c.id = initiative_order.campaign_id AND c.gm_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Campaign members insert initiative" ON public.initiative_order;
CREATE POLICY "Campaign members insert initiative" ON public.initiative_order
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.campaign_members cm
             WHERE cm.campaign_id = initiative_order.campaign_id AND cm.user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.campaigns c
             WHERE c.id = initiative_order.campaign_id AND c.gm_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Campaign members update initiative" ON public.initiative_order;
CREATE POLICY "Campaign members update initiative" ON public.initiative_order
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.campaign_members cm
             WHERE cm.campaign_id = initiative_order.campaign_id AND cm.user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.campaigns c
             WHERE c.id = initiative_order.campaign_id AND c.gm_user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.campaign_members cm
             WHERE cm.campaign_id = initiative_order.campaign_id AND cm.user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.campaigns c
             WHERE c.id = initiative_order.campaign_id AND c.gm_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "GM deletes initiative" ON public.initiative_order;
CREATE POLICY "GM deletes initiative" ON public.initiative_order
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.campaigns c
             WHERE c.id = initiative_order.campaign_id AND c.gm_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "initiative_order_thriver_bypass" ON public.initiative_order;
CREATE POLICY "initiative_order_thriver_bypass" ON public.initiative_order
  FOR ALL USING (is_thriver()) WITH CHECK (is_thriver());

NOTIFY pgrst, 'reload schema';
