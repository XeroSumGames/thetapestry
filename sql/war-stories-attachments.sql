-- war-stories-attachments.sql
-- Adds file-upload support to War Stories posts. Authors can attach
-- images, PDFs, etc.; anyone viewing the post sees the attachments.
-- Idempotent — safe to re-run.

-- ── 1. attachments column on war_stories ─────────────────────────
-- jsonb array of { name, path, url, size, type } objects. We store the
-- URL denormalized so the feed can render without an extra storage.list
-- round-trip per story.
ALTER TABLE public.war_stories
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ── 2. Storage bucket ────────────────────────────────────────────
-- Public bucket — War Stories are a public-read feed anyway, and making
-- the bucket public keeps URL handling simple (getPublicUrl returns a
-- permanent URL that works without a signed token).
INSERT INTO storage.buckets (id, name, public)
  VALUES ('war-stories', 'war-stories', true)
  ON CONFLICT (id) DO NOTHING;

-- ── 3. Storage RLS ───────────────────────────────────────────────
-- Path shape: <author_user_id>/<story_id>/<filename>. First folder
-- segment gates writes to the owner; everyone can read.
-- NOTE: the IMPORTANT qualification comment from gm-notes-attachments
-- applies here too — always use storage.objects.name inside subqueries
-- so the column isn't shadowed by some table's `name` column.

DROP POLICY IF EXISTS "War stories read attachments" ON storage.objects;
CREATE POLICY "War stories read attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'war-stories');

DROP POLICY IF EXISTS "War stories insert own attachments" ON storage.objects;
CREATE POLICY "War stories insert own attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'war-stories'
    AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "War stories delete own attachments" ON storage.objects;
CREATE POLICY "War stories delete own attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'war-stories'
    AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text
  );
