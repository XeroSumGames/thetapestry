-- ============================================================
-- Thriver role-case fix
-- ============================================================
--
-- profiles.role is auto-lowercased by trigger trg_normalize_role
-- (see tasks/lessons.md). The original is_thriver() helper and the
-- campaign_pins Thriver bypass were written against the old
-- 'Thriver' (capital T) convention, so they silently returned
-- false for every Thriver and every godmode policy in the system
-- was a no-op. This migration repairs both.
--
-- After running:
--   SELECT public.is_thriver();   -- run as the Thriver in the app, not the SQL editor
-- should return true, and the Thriver bypass policies on
-- tactical_scenes / scene_tokens / campaign_pins / etc. start
-- permitting writes again.
--
-- Idempotent. Safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_thriver()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'thriver'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_thriver() TO authenticated;

-- campaign_pins inlines the same check rather than calling
-- is_thriver(), so it needs its own fix.
DROP POLICY IF EXISTS "Thrivers can manage campaign pins" ON public.campaign_pins;
CREATE POLICY "Thrivers can manage campaign pins"
  ON public.campaign_pins FOR ALL TO authenticated
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
