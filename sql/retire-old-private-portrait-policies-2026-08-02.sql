-- Follow-up to sql/fix-portrait-bank-private-bucket-2026-08-02.sql: all
-- private-portrait objects + rows have been migrated to the new
-- portrait-bank-private bucket (verified live), and the old
-- portrait-bank/private/<uid>/... objects have been deleted (verified
-- empty). These two policies from
-- sql/token-library-phase2-schema-2026-06-12.sql granted own-uid
-- upload/read access to that now-retired private/ convention on the
-- OLD (public) bucket - dead permission surface now that
-- lib/data/portrait-bank.ts's uploadPrivatePortrait() targets the new
-- bucket exclusively. Dropping them is a strict tightening: the wide
-- "Users upload to portrait bank" policy
-- (sql/fix-portrait-bank-private-upload-2026-08-01.sql) already excludes
-- private/% from its own grant via NOT LIKE, independent of these two -
-- so removing them doesn't touch that policy's behavior, it just closes
-- the now-unused own-uid grant.

BEGIN;

DROP POLICY IF EXISTS "authenticated_upload_private_portraits" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_read_own_private_portraits" ON storage.objects;

COMMIT;
