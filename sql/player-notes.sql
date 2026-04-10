-- ============================================================
-- Player notes — per-campaign personal notes that players can
-- optionally submit to the GM's session summary.
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.player_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  content text NOT NULL DEFAULT '',
  submitted_to_summary boolean NOT NULL DEFAULT false,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS player_notes_campaign_user_idx
  ON public.player_notes(campaign_id, user_id);

CREATE INDEX IF NOT EXISTS player_notes_submitted_idx
  ON public.player_notes(campaign_id)
  WHERE submitted_to_summary = true;

ALTER TABLE public.player_notes ENABLE ROW LEVEL SECURITY;

-- Players read their own notes.
DROP POLICY IF EXISTS "Players read their own notes" ON public.player_notes;
CREATE POLICY "Players read their own notes"
  ON public.player_notes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- GMs read submitted notes in their own campaigns.
DROP POLICY IF EXISTS "GMs read submitted notes" ON public.player_notes;
CREATE POLICY "GMs read submitted notes"
  ON public.player_notes FOR SELECT TO authenticated
  USING (
    submitted_to_summary = true
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND c.gm_user_id = auth.uid()
    )
  );

-- Players insert their own notes.
DROP POLICY IF EXISTS "Players insert their own notes" ON public.player_notes;
CREATE POLICY "Players insert their own notes"
  ON public.player_notes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Players update their own notes.
DROP POLICY IF EXISTS "Players update their own notes" ON public.player_notes;
CREATE POLICY "Players update their own notes"
  ON public.player_notes FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Players delete their own notes.
DROP POLICY IF EXISTS "Players delete their own notes" ON public.player_notes;
CREATE POLICY "Players delete their own notes"
  ON public.player_notes FOR DELETE TO authenticated
  USING (user_id = auth.uid());
