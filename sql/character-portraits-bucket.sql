-- character-portraits-bucket.sql
-- Public storage bucket for character portrait JPEGs. Replaces the
-- inline base64 in characters.data.photoDataUrl which bloats every
-- characters SELECT. Path shape: <character_user_id>/<character_id>.jpg
-- so RLS scopes writes to the owner (or Thriver bypass for the
-- one-shot migration tool).
--
-- Idempotent — safe to re-run.

INSERT INTO storage.buckets (id, name, public)
  VALUES ('character-portraits', 'character-portraits', true)
  ON CONFLICT (id) DO NOTHING;

-- Read: anyone (public bucket — portraits are not sensitive data and
-- the in-app character cards display them universally).
DROP POLICY IF EXISTS "Character portraits read" ON storage.objects;
CREATE POLICY "Character portraits read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'character-portraits');

-- Insert / Update / Delete: owner of the folder OR a Thriver. The
-- folder is the character's user_id so a player can upload their
-- own portraits inline; Thrivers can upload via the migration tool
-- on behalf of any user.
DROP POLICY IF EXISTS "Character portraits insert own" ON storage.objects;
CREATE POLICY "Character portraits insert own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'character-portraits'
    AND (
      (storage.foldername(storage.objects.name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
    )
  );

DROP POLICY IF EXISTS "Character portraits update own" ON storage.objects;
CREATE POLICY "Character portraits update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'character-portraits'
    AND (
      (storage.foldername(storage.objects.name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
    )
  );

DROP POLICY IF EXISTS "Character portraits delete own" ON storage.objects;
CREATE POLICY "Character portraits delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'character-portraits'
    AND (
      (storage.foldername(storage.objects.name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
    )
  );
