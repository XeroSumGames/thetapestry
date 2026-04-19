-- Diagnostic — run in Supabase SQL Editor as the GM user.
-- Returns four rows telling us why note attachment uploads are blocked.

-- 1. Does the bucket exist and is it public?
SELECT id, name, public FROM storage.buckets WHERE id = 'note-attachments';

-- 2. What policies exist on storage.objects for this bucket?
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS with_check_expr,
       polpermissive
FROM pg_policy
WHERE polrelid = 'storage.objects'::regclass
ORDER BY polname;

-- 3. Your auth.uid() right now (paste this value so we can compare):
SELECT auth.uid() AS my_auth_uid;

-- 4. Are you actually the GM of the campaign you're uploading to?
-- Replace the UUID with the campaign id you're trying to upload under.
-- (Find it in the URL of your /stories/<CAMPAIGN_ID>/table page.)
SELECT id, gm_user_id, (gm_user_id = auth.uid()) AS i_am_gm
FROM public.campaigns
WHERE id = '00000000-0000-0000-0000-000000000000'; -- ← paste real campaign id
