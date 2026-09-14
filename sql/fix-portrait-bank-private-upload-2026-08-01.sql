-- Fix (write side only - see handoff notes for the read-side follow-up
-- this does NOT fix): "Users upload to portrait bank" is a bucket-wide,
-- completely unscoped INSERT policy (WITH CHECK (bucket_id =
-- 'portrait-bank')) that predates the private/{uid}/ convention added
-- later by sql/token-library-phase2-schema-2026-06-12.sql. Since
-- PERMISSIVE policies OR together, this wide policy alone is sufficient
-- to upload anywhere in the bucket - including into ANOTHER user's
-- private/<their-uid>/... folder, completely defeating the scoped
-- authenticated_upload_private_portraits policy that already exists
-- alongside it. uploadPrivatePortrait() uses upsert:false so this can't
-- silently overwrite an existing file, but a victim's private folder is
-- otherwise unrestricted (planting/griefing/quota abuse).
--
-- Fix: narrow the wide policy to explicitly exclude private/ paths, so
-- it still covers its real purpose (anyone can contribute to the shared
-- NPC portrait bank via uploadPublicPortrait(), non-private/ paths) but
-- can no longer touch anyone's private folder - only the existing
-- own-uid-scoped policy can do that now.
--
-- NOT fixed here, deliberately: the bucket itself is public=true, which
-- means Supabase Storage serves every object via an unauthenticated CDN
-- URL with NO RLS evaluation at all for reads - "private" portraits are
-- still fully readable by anyone with/guessing the URL regardless of any
-- SELECT policy. Fixing that requires either flipping the bucket private
-- (breaking every getPublicUrl()-based read across the whole feature,
-- public AND private, until every consumer is reworked to signed URLs)
-- or moving private uploads to a genuinely separate private bucket
-- (a real data migration for already-uploaded files). Both need browser
-- verification before shipping, not a same-night SQL patch - flagged
-- separately as a scoped follow-up.

BEGIN;

DROP POLICY IF EXISTS "Users upload to portrait bank" ON storage.objects;
CREATE POLICY "Users upload to portrait bank"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'portrait-bank'
  AND name NOT LIKE 'private/%'
);

COMMIT;
