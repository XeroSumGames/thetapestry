-- ============================================================
-- GM Notes attachments
-- Run in Supabase SQL Editor.
-- Idempotent: safe to re-run.
-- ============================================================

-- ── 1. Add attachments column ────────────────────────────────
-- jsonb array of { name, url, size, type } objects.

ALTER TABLE public.campaign_notes
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ── 2. Storage bucket ────────────────────────────────────────
-- The "note-attachments" bucket needs to exist. The Supabase JS client
-- can't create buckets, so this must be done in the dashboard:
--   Storage → Create bucket → Name: note-attachments → Public: ON
--
-- Then run these RLS policies on storage.objects:

INSERT INTO storage.buckets (id, name, public)
  VALUES ('note-attachments', 'note-attachments', true)
  ON CONFLICT (id) DO NOTHING;

-- Allow campaign members to read note attachments.
DROP POLICY IF EXISTS "Campaign members read note attachments" ON storage.objects;
CREATE POLICY "Campaign members read note attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'note-attachments'
    AND EXISTS (
      SELECT 1 FROM public.campaign_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.campaign_id::text = (storage.foldername(name))[1]
    )
  );

-- Allow GMs to upload to their campaign folder.
-- IMPORTANT: `name` MUST be qualified as `storage.objects.name`. An unqualified
-- `name` inside the `FROM campaigns c` subquery resolves to `c.name` (the
-- campaign's display name), not the upload path — that silently breaks the
-- folder check and every INSERT gets rejected. Same applies to DELETE below.
DROP POLICY IF EXISTS "GM uploads note attachments" ON storage.objects;
CREATE POLICY "GM uploads note attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'note-attachments'
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
        AND c.gm_user_id = auth.uid()
    )
  );

-- Allow GMs to delete from their campaign folder.
DROP POLICY IF EXISTS "GM deletes note attachments" ON storage.objects;
CREATE POLICY "GM deletes note attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'note-attachments'
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
        AND c.gm_user_id = auth.uid()
    )
  );
