-- Fix: get_visitor_map_data() had no caller-role check and was never
-- REVOKEd from PUBLIC/anon, unlike its sibling admin RPCs
-- (admin_user_with_login, admin_users_with_login - see
-- sql/security-hardening-2026-05-08.sql). Any caller could get aggregated
-- ip_hash/lat/lng/city/country/visit_count for every visitor ever logged.
-- The /logging page's "Thriver-only" gate is client-side only.
--
-- Mirrors the exact pattern already established for the sibling admin
-- RPCs: an is_thriver() check inside the function (requires converting
-- from LANGUAGE sql to plpgsql to support the check) plus an explicit
-- REVOKE as a second, independent layer.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_visitor_map_data()
 RETURNS TABLE(ip_hash text, lat numeric, lng numeric, city text, country_code text, visit_count bigint, first_visit timestamp with time zone, last_visit timestamp with time zone, is_ghost boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NOT public.is_thriver() THEN
    RAISE EXCEPTION 'forbidden: thriver role required';
  END IF;

  RETURN QUERY
    SELECT vl.ip_hash, MAX(vl.latitude) as lat, MAX(vl.longitude) as lng,
      MAX(vl.city) as city, MAX(vl.country_code) as country_code,
      COUNT(*) as visit_count, MIN(vl.created_at) as first_visit,
      MAX(vl.created_at) as last_visit, BOOL_AND(vl.is_ghost) as is_ghost
    FROM public.visitor_logs vl
    WHERE vl.ip_hash IS NOT NULL AND vl.latitude IS NOT NULL AND vl.longitude IS NOT NULL
    GROUP BY vl.ip_hash ORDER BY visit_count DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_visitor_map_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_visitor_map_data() TO authenticated;

COMMIT;
