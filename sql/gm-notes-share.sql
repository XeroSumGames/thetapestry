-- ============================================================
-- GM Notes: share with players
-- Run in Supabase SQL Editor.
-- Idempotent: safe to re-run.
-- ============================================================

-- ── 1. Add shared column ────────────────────────────────────
ALTER TABLE public.campaign_notes
  ADD COLUMN IF NOT EXISTS shared boolean NOT NULL DEFAULT false;

-- ── 2. RLS: let campaign members read shared notes ──────────
-- GM already has full access via gm_user_id match.
-- This policy lets players read notes marked as shared.

DROP POLICY IF EXISTS "Campaign members read shared notes" ON campaign_notes;
CREATE POLICY "Campaign members read shared notes"
  ON campaign_notes FOR SELECT TO authenticated
  USING (
    shared = true
    AND EXISTS (
      SELECT 1 FROM public.campaign_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.campaign_id = campaign_notes.campaign_id
    )
  );
