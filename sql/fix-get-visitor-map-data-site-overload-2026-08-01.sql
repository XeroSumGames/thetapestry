-- Fix: get_visitor_map_data has a SECOND overload (p_site text DEFAULT NULL)
-- that has the identical vulnerability as the zero-arg version fixed in
-- fix-get-visitor-map-data-rls-2026-08-01.sql - no caller-role check, never
-- REVOKEd from PUBLIC/anon. app/logging/page.tsx:155 calls this overload
-- whenever a specific site filter is selected (calls the zero-arg one only
-- when site === 'all'), so both are genuinely reachable and both needed
-- the fix, not just the one the original audit happened to name.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_visitor_map_data(p_site text DEFAULT NULL::text)
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
    SELECT
      vl.ip_hash,
      MAX(vl.latitude) as lat,
      MAX(vl.longitude) as lng,
      MAX(vl.city) as city,
      MAX(vl.country_code) as country_code,
      COUNT(*) as visit_count,
      MIN(vl.created_at) as first_visit,
      MAX(vl.created_at) as last_visit,
      BOOL_AND(vl.is_ghost) as is_ghost
    FROM public.visitor_logs vl
    WHERE vl.ip_hash IS NOT NULL
      AND vl.latitude IS NOT NULL
      AND vl.longitude IS NOT NULL
      AND (
        p_site IS NULL
        OR (p_site = 'tapestry' AND (vl.site = 'tapestry' OR vl.site IS NULL))
        OR (p_site <> 'tapestry' AND vl.site = p_site)
      )
    GROUP BY vl.ip_hash
    ORDER BY visit_count DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_visitor_map_data(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_visitor_map_data(text) TO authenticated;

COMMIT;
