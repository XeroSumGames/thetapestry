-- ============================================================================
-- PII column revoke - campaigns.invite_code (the deferred half). Applied live
-- 2026-06-29 AFTER HP converted all campaigns.select('*') to the explicit
-- CAMPAIGN_COLUMNS list (89ff1b84) - 5 sites, incl. 2 in app/stories/page.tsx
-- that a single-line grep missed. The profiles.email half already shipped
-- (sql/sec-pii-revoke-profiles-email-2026-06-29.sql).
--
-- First attempt at this half (2026-06-29) broke the play surface: this Supabase
-- PostgREST does NOT omit an ungranted column from select=* - it errors 42501.
-- With every campaigns.select('*') now an explicit column list (== this regrant
-- set, mirrored in lib/data/campaigns.ts CAMPAIGN_COLUMNS), no select=* is ever
-- issued against campaigns, so the revoke is safe.
--
-- Verified 2026-06-29 the regrant set == all campaigns columns minus invite_code
-- (lossless). Legit invite_code reads go through the definer RPCs:
--   public.get_campaign_invite_code(uuid)        (GM/member display)
--   public.find_campaign_by_invite_code(text)    (join-by-code, no enumeration)
--
-- REVERSIBLE: GRANT SELECT ON public.campaigns TO anon, authenticated; restores
-- the prior state instantly.

REVOKE SELECT ON public.campaigns FROM anon, authenticated;
GRANT SELECT (id, name, description, setting, gm_user_id, status, created_at,
              session_status, session_count, session_started_at, map_style,
              map_center_lat, map_center_lng, vehicles, last_accessed_at, clock,
              start_canon_day, cover_image_url)
  ON public.campaigns TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
