-- ============================================================
-- campaign_pins: let campaign members insert pins (Quick Add modal)
-- ============================================================
--
-- The original Phase 2 RLS (sql/campaign-pins.sql) restricted all
-- writes to the campaign GM. Quick Add's "Drop a Pin" flow is used
-- by players too — pins for their own sightings, places they've
-- found, homestead candidates, etc. Restricting INSERT to GMs blocks
-- the primary UX of /table's map double-click.
--
-- This migration adds an INSERT policy that widens to any campaign
-- member (GM included). UPDATE and DELETE stay GM-only — edits and
-- removals remain a GM act since there's no per-pin ownership
-- column yet. If a player wants to edit their pin, they ask the GM
-- (or we add a user_id column in a future pass and tighten).
--
-- Idempotent: DROP POLICY IF EXISTS + re-CREATE.

DROP POLICY IF EXISTS "Campaign members can insert campaign pins" ON public.campaign_pins;
CREATE POLICY "Campaign members can insert campaign pins"
  ON public.campaign_pins FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaign_members cm
      WHERE cm.campaign_id = campaign_pins.campaign_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_pins.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );

-- The pre-existing "GM can manage campaign pins" FOR ALL policy
-- still covers UPDATE / DELETE / SELECT for the GM. SELECT for
-- members already permitted by the original "Campaign members can
-- read campaign pins" policy.

-- ── Diagnostic ──
-- SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr,
--        pg_get_expr(polwithcheck, polrelid) AS check_expr
-- FROM pg_policy WHERE polrelid = 'public.campaign_pins'::regclass
-- ORDER BY polcmd, polname;
