-- account-avatars.sql
-- Account-level avatar (the person, not their characters). Distinct
-- from character portraits — a single user has one account avatar
-- that follows them across every campaign + every character. Shown
-- in sidebar, on /account, and (future) on Campfire posts and any
-- multi-user surface.
--
-- Storage path: account-avatars/<user_id>/avatar.jpg (or .png/.webp).
-- Public bucket — same reasoning as character-portraits: avatars are
-- not sensitive and the app displays them universally.
--
-- Idempotent — safe to re-run.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('account-avatars', 'account-avatars', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Account avatars read" ON storage.objects;
CREATE POLICY "Account avatars read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'account-avatars');

DROP POLICY IF EXISTS "Account avatars insert own" ON storage.objects;
CREATE POLICY "Account avatars insert own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'account-avatars'
    AND (
      (storage.foldername(storage.objects.name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
    )
  );

DROP POLICY IF EXISTS "Account avatars update own" ON storage.objects;
CREATE POLICY "Account avatars update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'account-avatars'
    AND (
      (storage.foldername(storage.objects.name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
    )
  );

DROP POLICY IF EXISTS "Account avatars delete own" ON storage.objects;
CREATE POLICY "Account avatars delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'account-avatars'
    AND (
      (storage.foldername(storage.objects.name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
    )
  );

NOTIFY pgrst, 'reload schema';
