-- ============================================================
-- feature_checklist_state - per-user persistence for the in-app Feature
-- Manifest tool (/tools/feature-manifest). One JSONB blob per user
-- (id -> {d:verified, f:flagged}), upserted on every tick. Server-side, so a
-- Thriver's checklist follows them across browsers + devices - no localStorage,
-- no file juggling.
--
-- Additive + backward-compatible (new table only). No realtime / publication
-- needed - it is single-user, read+written by its owner only.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.feature_checklist_state (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_checklist_state ENABLE ROW LEVEL SECURITY;

-- Each user reads + writes only their own row. (The page itself is
-- Thriver-gated in the UI; this policy is the hard backstop.)
DROP POLICY IF EXISTS "own checklist row" ON public.feature_checklist_state;
CREATE POLICY "own checklist row" ON public.feature_checklist_state
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
