-- GM Screen becomes a single SHARED STANDARD layout, Thriver-curated (Xero
-- 2026-07-20): "make this the standard; only a Thriver should be able to edit
-- this going forward." Replaces the per-GM gm_screen_layouts model. One row
-- holds the canonical arrangement; every signed-in user reads it (locked),
-- only Thrivers can write it.
--
-- gm_screen_layouts (the per-user table from earlier today) is now obsolete but
-- left in place - dropping a live table is a separate, explicit step. It simply
-- stops being read/written.
--
-- Additive; seeded with Xero's current arrangement so the standard is exactly
-- what he laid out. No function body -> no em/en-dash concern.
--
-- Apply with:
--   npx supabase db query --linked -f sql/add-gm-screen-standard-layout-2026-07-20.sql
-- Then mirror into sql/_baseline/schema.sql + lib/database.types.ts. Verify:
-- table + both policies in pg_policies, seed row present.

CREATE TABLE IF NOT EXISTS public.gm_screen_standard_layout (
  id integer PRIMARY KEY DEFAULT 1,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gm_screen_standard_single_row CHECK (id = 1)
);

ALTER TABLE public.gm_screen_standard_layout ENABLE ROW LEVEL SECURITY;

-- Everyone signed in reads the standard (the screen is shared reference content).
DROP POLICY IF EXISTS "read standard layout" ON public.gm_screen_standard_layout;
CREATE POLICY "read standard layout" ON public.gm_screen_standard_layout
  AS PERMISSIVE FOR SELECT TO public USING (true);

-- Only Thrivers curate it.
DROP POLICY IF EXISTS "thriver writes standard layout" ON public.gm_screen_standard_layout;
CREATE POLICY "thriver writes standard layout" ON public.gm_screen_standard_layout
  AS PERMISSIVE FOR ALL TO public USING (is_thriver()) WITH CHECK (is_thriver());

-- Seed with the arrangement Xero laid out (captured from gm_screen_layouts).
INSERT INTO public.gm_screen_standard_layout (id, state) VALUES (
  1,
  '{"positions":{"outcomes":{"x":0,"y":0,"w":424,"h":265},"cmods":{"x":0,"y":280,"w":424,"h":334},"range-bands":{"x":0,"y":624,"w":424,"h":212},"combat-actions":{"x":440,"y":0,"w":413,"h":822},"skills-attrs":{"x":864,"y":0,"w":424,"h":472},"weapon-condition":{"x":864,"y":480,"w":424,"h":212},"healing":{"x":864,"y":704,"w":424,"h":273},"gm-notes":{"x":1296,"y":0,"w":589,"h":605}},"collapsed":[],"filter":"all"}'::jsonb
) ON CONFLICT (id) DO NOTHING;
