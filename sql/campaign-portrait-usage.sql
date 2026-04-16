-- ============================================================
-- Campaign Portrait Usage Log
-- Tracks which portraits have been auto-assigned by the random
-- NPC generator in each campaign. Used to guarantee the no-reuse
-- cycle — every portrait gets used once before any repeats.
-- Independent of campaign_npcs.portrait_url: manual picks from
-- the Library do NOT count as auto-assigned and do NOT affect
-- the cycle. Deleting an NPC does NOT free its auto-assigned
-- portrait (persists so we don't re-roll the same face next time).
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.campaign_portrait_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  portrait_url text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('man', 'woman')),
  used_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, portrait_url)
);

CREATE INDEX IF NOT EXISTS campaign_portrait_usage_campaign_idx
  ON public.campaign_portrait_usage (campaign_id, gender);

ALTER TABLE public.campaign_portrait_usage ENABLE ROW LEVEL SECURITY;

-- Campaign members can read their campaign's usage log
DROP POLICY IF EXISTS "Members read campaign portrait usage" ON public.campaign_portrait_usage;
CREATE POLICY "Members read campaign portrait usage"
  ON public.campaign_portrait_usage FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_members cm
      WHERE cm.campaign_id = campaign_portrait_usage.campaign_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_portrait_usage.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );

-- Only the GM writes (generator is GM-only)
DROP POLICY IF EXISTS "GM writes campaign portrait usage" ON public.campaign_portrait_usage;
CREATE POLICY "GM writes campaign portrait usage"
  ON public.campaign_portrait_usage FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_portrait_usage.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );
