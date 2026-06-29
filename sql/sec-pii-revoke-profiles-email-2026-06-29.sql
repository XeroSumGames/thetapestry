-- ============================================================================
-- PII column revoke - profiles.email ONLY (the campaigns.invite_code half is
-- DEFERRED, see note). Applied live 2026-06-29 after HP's reader rewire (391f01df)
-- + Xero in-app eyeball.
-- ============================================================================
--
-- Why split from sql/sec-pii-column-revokes-2026-06-23-APPLY-AFTER-REWIRE.sql:
-- applying the combined file's campaigns half broke the core play surface. This
-- Supabase PostgREST does NOT omit an ungranted column from `select=*` expansion
-- (verified live 2026-06-29: post-revoke `campaigns?select=*` returned
-- "permission denied for table campaigns" for ~10s+, not just reload lag) - so the
-- 3 remaining `campaigns.select('*')` reads (app/stories/[id]/page.tsx:141,
-- table/page.tsx:1227, lib/gm-kit.ts:60) error until they become explicit column
-- lists. That conversion is routed to HP; the campaigns half re-applies after.
--
-- profiles.email is independently SAFE: there is NO profiles.select('*') and NO
-- embedded profiles(*) anywhere (verified 2026-06-29), so PostgREST only ever
-- issues explicit-column selects on profiles, which list granted columns. The 3
-- email readers were rewired in 391f01df (account/bug-report -> auth session,
-- moderation -> get_profile_email RPC).
--
-- Pattern: profiles has TABLE-level SELECT to anon+authenticated, so a column
-- REVOKE SELECT(email) is a no-op. Revoke table SELECT, re-grant every column
-- EXCEPT email. RLS still gates rows on top. Legit email reads go through
-- public.get_profile_email(uuid) (own / thriver, SECURITY DEFINER).
--
-- REVERSIBLE: GRANT SELECT ON public.profiles TO anon, authenticated; restores
-- the prior state instantly.

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, username, created_at, role, suspended, onboarded, avatar_url,
              suspended_until, suspended_reason, tableau_role)
  ON public.profiles TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
