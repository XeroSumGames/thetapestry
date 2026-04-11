-- ============================================================
-- Allow campaign members (players + GM) to UPDATE initiative_order
-- rows for campaigns they belong to.
--
-- Why: consumeAction() and nextTurn() write to initiative_order from
-- whichever client triggered them. When a player's weapon attack ends
-- and their client tries to decrement actions_remaining, the write
-- silently fails under a GM-only RLS policy — no JS exception, just
-- `{ error }` on the Supabase response, which the code only logs.
-- Symptom: a PC takes two attacks, dots never drop, initiative never
-- advances, no visible error.
--
-- Idempotent. Run in Supabase SQL Editor.
-- ============================================================

-- Make sure RLS is on (safe to run even if already enabled).
ALTER TABLE public.initiative_order ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user who is a member of the campaign
-- (or the GM) can read the initiative order. Replace a looser
-- existing policy if one is in place.
DROP POLICY IF EXISTS "Campaign members read initiative" ON public.initiative_order;
CREATE POLICY "Campaign members read initiative"
  ON public.initiative_order FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_members cm
      WHERE cm.campaign_id = initiative_order.campaign_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = initiative_order.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );

-- INSERT: GM creates combat; players generally don't insert rows,
-- but allow members so Start Combat broadcasts don't get weird.
DROP POLICY IF EXISTS "Campaign members insert initiative" ON public.initiative_order;
CREATE POLICY "Campaign members insert initiative"
  ON public.initiative_order FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaign_members cm
      WHERE cm.campaign_id = initiative_order.campaign_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = initiative_order.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );

-- UPDATE: THIS IS THE ONE THAT WAS MISSING (or too narrow).
-- Any campaign member can update initiative rows in their campaign.
-- This lets consumeAction / nextTurn / deferInitiative work when the
-- player's own client issues the write after their attack resolves.
DROP POLICY IF EXISTS "Campaign members update initiative" ON public.initiative_order;
CREATE POLICY "Campaign members update initiative"
  ON public.initiative_order FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_members cm
      WHERE cm.campaign_id = initiative_order.campaign_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = initiative_order.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaign_members cm
      WHERE cm.campaign_id = initiative_order.campaign_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = initiative_order.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );

-- DELETE: GM ends combat. Keep this GM-only to avoid surprises.
DROP POLICY IF EXISTS "GM deletes initiative" ON public.initiative_order;
CREATE POLICY "GM deletes initiative"
  ON public.initiative_order FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = initiative_order.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );
