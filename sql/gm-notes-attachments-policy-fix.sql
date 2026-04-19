-- Fix for GM Notes attachment upload/delete policies.
-- Previous gm-notes-attachments.sql used unqualified `name` inside a subquery
-- on `campaigns`. Postgres resolved it as `campaigns.name` (the campaign's
-- display name) instead of `storage.objects.name` (the upload path), so the
-- folder check never matched and GMs got "row violates RLS" on INSERT.
--
-- Also fixes the DELETE policy (same bug). The SELECT policy queries
-- campaign_members which has no `name` column, so it worked.
--
-- Idempotent.

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
