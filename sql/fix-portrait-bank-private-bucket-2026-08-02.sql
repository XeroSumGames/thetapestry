-- Portrait-bank confidentiality fix, option (b) (Xero's decision via
-- Comms, tasks/COMMS.md, 2026-08-02): separate private bucket for
-- private character portraits, leaving the shared/public bank on plain
-- getPublicUrl() forever (majority use case, zero expiry-risk redesign).
--
-- Root cause (see sql/fix-portrait-bank-private-upload-2026-08-01.sql for
-- the write-side half of this bug, already fixed): the 'portrait-bank'
-- bucket is public=true, so Supabase Storage serves every object via an
-- unauthenticated CDN URL with NO RLS evaluation at all for reads -
-- "private" portraits under private/<uid>/... are fully readable by
-- anyone with/guessing the URL, regardless of any SELECT policy.
--
-- Fix: a genuinely separate bucket, public=false, scoped by RLS to the
-- uploader's own uid. Path convention drops the now-redundant 'private/'
-- prefix since the bucket itself provides the separation:
--   <uid>/256/<id>.jpg, <uid>/56/<id>.jpg, <uid>/32/<id>.jpg
--
-- Existing rows/objects are migrated separately (see
-- sql/migrate-private-portraits-to-private-bucket-2026-08-02.sql) - this
-- file only creates the bucket + policies, additive and safe to apply
-- ahead of the data migration.

BEGIN;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('portrait-bank-private', 'portrait-bank-private', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "own_uid_upload_private_portraits" ON storage.objects;
CREATE POLICY "own_uid_upload_private_portraits"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'portrait-bank-private'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

DROP POLICY IF EXISTS "own_uid_read_private_portraits" ON storage.objects;
CREATE POLICY "own_uid_read_private_portraits"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'portrait-bank-private'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

DROP POLICY IF EXISTS "own_uid_delete_private_portraits" ON storage.objects;
CREATE POLICY "own_uid_delete_private_portraits"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'portrait-bank-private'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

COMMIT;
