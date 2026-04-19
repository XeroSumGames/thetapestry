-- Force the note-attachments bucket to be public so any campaign member
-- can fetch GM-shared image handouts via getPublicUrl().
--
-- Why: gm-notes-attachments.sql attempted to create the bucket as public,
-- but `INSERT ... ON CONFLICT DO NOTHING` is a no-op if the bucket already
-- existed as private. Players see the shared note row (read RLS works) but
-- the image URL returns 403 because the file is in a private bucket.
--
-- Run in Supabase SQL Editor. Idempotent.
UPDATE storage.buckets SET public = true WHERE id = 'note-attachments';
