-- Token Library Phase 2: private portrait bank uploads
-- Apply: npx supabase db query --linked -f sql/token-library-phase2-schema-2026-06-12.sql
--
-- Changes:
--   1. portrait_bank.number  -> nullable (was NOT NULL)
--   2. portrait_bank.gender  -> nullable, drop 'man'|'woman' check (was NOT NULL + CHECK)
--   3. ADD portrait_bank.name text NULL
--   4. ADD CHECK: name IS NOT NULL OR (number IS NOT NULL AND gender IS NOT NULL)
--   5. portrait-bank bucket: INSERT policy for authenticated users writing to
--      private/{uid}/... paths
--
-- Backwards compat: all existing rows have non-null number+gender and pass
-- the new check. The gender_number unique index still works (NULLs are
-- distinct in postgres unique constraints, so name-only rows don't collide).

-- 1-3. Schema changes
ALTER TABLE public.portrait_bank
  ALTER COLUMN number DROP NOT NULL,
  ALTER COLUMN gender DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS name text;

-- Drop the 'man'|'woman' check (private portraits have no gender)
ALTER TABLE public.portrait_bank
  DROP CONSTRAINT IF EXISTS portrait_bank_gender_check;

-- 4. New check: must have either (number + gender) OR a name
ALTER TABLE public.portrait_bank
  ADD CONSTRAINT portrait_bank_id_or_name
  CHECK (name IS NOT NULL OR (number IS NOT NULL AND gender IS NOT NULL));

-- 5. Storage: allow authenticated users to INSERT to their own private/ prefix
--    Existing Thriver INSERT policy (if any) remains untouched.
--    Non-Thriver authenticated users can only write to private/{uid}/...
CREATE POLICY IF NOT EXISTS "authenticated_upload_private_portraits"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'portrait-bank'
  AND name LIKE ('private/' || (auth.uid())::text || '/%')
);

-- Also allow SELECT on own private portraits (needed if bucket is not fully public)
CREATE POLICY IF NOT EXISTS "authenticated_read_own_private_portraits"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'portrait-bank'
  AND name LIKE ('private/' || (auth.uid())::text || '/%')
);
