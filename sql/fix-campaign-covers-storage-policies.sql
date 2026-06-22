-- Fix campaign-covers storage RLS policies.
--
-- Two bugs existed:
-- 1. INSERT and UPDATE policies were scoped to the 'public' role with an
--    auth.role() check in the WITH CHECK clause. Every other bucket uses
--    TO authenticated directly. The {public} role scoping may cause the
--    Supabase storage server to reject uploads even for logged-in users.
-- 2. No SELECT policy. The storage upsert path (upsert: true) needs to
--    SELECT the existing object row to decide INSERT vs UPDATE. Without a
--    SELECT policy, that check returns empty, which causes the subsequent
--    INSERT to fail when the file already exists.
--
-- The fix mirrors the campaign-npcs pattern: explicit TO authenticated on
-- all four operations. App code continues to enforce the GM-only guard.

DROP POLICY IF EXISTS "campaign-covers insert" ON storage.objects;
DROP POLICY IF EXISTS "campaign-covers update" ON storage.objects;
DROP POLICY IF EXISTS "campaign-covers select" ON storage.objects;
DROP POLICY IF EXISTS "campaign-covers delete" ON storage.objects;

CREATE POLICY "campaign-covers select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'campaign-covers');

CREATE POLICY "campaign-covers insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campaign-covers');

CREATE POLICY "campaign-covers update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'campaign-covers')
  WITH CHECK (bucket_id = 'campaign-covers');

CREATE POLICY "campaign-covers delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'campaign-covers');
