-- ============================================================
-- campaign_pins: Thriver role can manage any pin in any campaign
-- ============================================================
--
-- Thriver is the app-level admin role (moderation queue, visitor
-- logs, seed sync, etc.). They need parity on campaign_pins so
-- they can clean up bad/spam/test pins across campaigns they
-- don't GM. The existing "GM can manage campaign pins" FOR ALL
-- policy stays in place for regular campaign GMs; this new
-- policy is ADDITIVE — Postgres allows the action if ANY matching
-- policy passes.
--
-- Idempotent. Safe to re-run.
-- ============================================================

DROP POLICY IF EXISTS "Thrivers can manage campaign pins" ON public.campaign_pins;
CREATE POLICY "Thrivers can manage campaign pins"
  ON public.campaign_pins FOR ALL TO authenticated
  -- profiles.role is auto-lowercased by trg_normalize_role (see
  -- tasks/lessons.md), so compare against 'thriver' (lowercase).
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'thriver'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'thriver'
    )
  );

-- ── Diagnostic ──
-- SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr,
--        pg_get_expr(polwithcheck, polrelid) AS check_expr
-- FROM pg_policy WHERE polrelid = 'public.campaign_pins'::regclass
-- ORDER BY polcmd, polname;
