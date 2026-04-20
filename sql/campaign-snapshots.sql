-- Campaign snapshots — GM-authored save points.
-- Each row captures a moment of a campaign (NPCs, pins, scenes, scene tokens,
-- notes, pregens, optionally character_states). Restoring wipes the campaign's
-- current rows and re-inserts from the snapshot, in place, preserving the
-- campaign id + invite code + player memberships. Same jsonb shape the
-- Module System will use (spec-modules.md §5/§6) — intentional overlap so
-- Phase 5A can leverage this work.

CREATE TABLE IF NOT EXISTS public.campaign_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  snapshot jsonb NOT NULL,            -- { npcs, pins, scenes, tokens, notes, pregens, character_states? }
  includes_character_states boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_campaign_snapshots_campaign
  ON public.campaign_snapshots(campaign_id, created_at DESC);

ALTER TABLE public.campaign_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaign_snapshots_select ON public.campaign_snapshots;
CREATE POLICY campaign_snapshots_select ON public.campaign_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_snapshots.campaign_id AND c.gm_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS campaign_snapshots_insert ON public.campaign_snapshots;
CREATE POLICY campaign_snapshots_insert ON public.campaign_snapshots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_snapshots.campaign_id AND c.gm_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS campaign_snapshots_delete ON public.campaign_snapshots;
CREATE POLICY campaign_snapshots_delete ON public.campaign_snapshots FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_snapshots.campaign_id AND c.gm_user_id = auth.uid()
    )
  );
