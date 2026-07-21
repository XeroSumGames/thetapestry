-- GM Screen scratch pad (Xero 2026-07-20): on-the-fly GM notes under GM Notes,
-- folded into the session summary at End Session, then cleared.
--
-- PRIVACY: it must NOT live on campaigns - that table's SELECT policy is
-- "Anyone can view campaigns" USING (true), so a gm_scratch column there would
-- let any player read the GM's private notes. Instead it gets its own table,
-- RLS-restricted to the campaign's GM (read + write). One row per campaign.
--
-- Additive, no function body. Any GM of the campaign edits it; endSession folds
-- it into sessions.gm_summary then clears it.
--
-- Apply with:
--   npx supabase db query --linked -f sql/add-campaigns-gm-scratch-2026-07-20.sql
-- Then mirror into sql/_baseline/schema.sql + lib/database.types.ts.

-- Undo the first (world-readable) attempt: the column was added empty earlier
-- today; nothing has been written to it.
ALTER TABLE public.campaigns DROP COLUMN IF EXISTS gm_scratch;

CREATE TABLE IF NOT EXISTS public.gm_scratch (
  campaign_id uuid PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
  text text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gm_scratch ENABLE ROW LEVEL SECURITY;

-- Only the campaign's GM may read or write its scratch.
DROP POLICY IF EXISTS "gm scratch own campaign" ON public.gm_scratch;
CREATE POLICY "gm scratch own campaign" ON public.gm_scratch
  AS PERMISSIVE FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = gm_scratch.campaign_id AND c.gm_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = gm_scratch.campaign_id AND c.gm_user_id = auth.uid()));
