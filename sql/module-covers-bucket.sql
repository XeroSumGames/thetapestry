-- ============================================================
-- Module Covers — storage bucket for /modules marketplace cards
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================
-- Used by ModulePublishModal's cover-image upload (Phase C polish).
-- The cover_image_url column on `modules` already exists from
-- modules-phase-a.sql; this just adds the storage bucket + RLS.
--
-- Public read so unauthenticated marketplace browsing eventually
-- works without exposing storage credentials. Auth-only insert/
-- update/delete because uploads come from the publish wizard.

INSERT INTO storage.buckets (id, name, public)
  VALUES ('module-covers', 'module-covers', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone reads module covers" ON storage.objects;
CREATE POLICY "Anyone reads module covers"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'module-covers');

DROP POLICY IF EXISTS "Authors upload module covers" ON storage.objects;
CREATE POLICY "Authors upload module covers"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'module-covers');

DROP POLICY IF EXISTS "Authors update module covers" ON storage.objects;
CREATE POLICY "Authors update module covers"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'module-covers')
  WITH CHECK (bucket_id = 'module-covers');

DROP POLICY IF EXISTS "Authors delete module covers" ON storage.objects;
CREATE POLICY "Authors delete module covers"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'module-covers');
