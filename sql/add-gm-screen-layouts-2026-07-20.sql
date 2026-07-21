-- GM Screen redesign: per-GM saved layout (order / collapsed / filter).
--
-- The redesigned GM Screen (app/gm-screen/page.tsx) replaces the hand-rolled
-- free-float drag engine with a dnd-kit sortable card grid. The saved layout is
-- per-GM and follows the user's ACCOUNT across every table and device (Xero
-- 2026-07-20), so it lives in the DB, not per-browser localStorage.
--
-- ONE row per user, jsonb blob (mirrors feature_checklist_state) so the shape
-- can evolve without a migration. RLS: a user reads/writes only their own row.
-- Additive, no backfill. No function body -> no em/en-dash concern.
--
-- Apply with:
--   npx supabase db query --linked -f sql/add-gm-screen-layouts-2026-07-20.sql
-- Then mirror into sql/_baseline/schema.sql (already reflected in
-- lib/database.types.ts). Verify: table + RLS in information_schema / pg_policies.

CREATE TABLE IF NOT EXISTS public.gm_screen_layouts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gm_screen_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own gm layout" ON public.gm_screen_layouts;
CREATE POLICY "own gm layout" ON public.gm_screen_layouts
  AS PERMISSIVE FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
