-- Add an optional site filter to the visitor-map RPC (2026-07-24), so the
-- unified /logging dashboard's Tapestry / Tableau / Table buttons filter the map
-- too. p_site NULL = all sites (unchanged default). 'tapestry' includes legacy
-- rows with site NULL. Drop the zero-arg version first so the no-arg call
-- resolves to this one (a default-param overload alongside it would be ambiguous).
DROP FUNCTION IF EXISTS public.get_visitor_map_data();

CREATE OR REPLACE FUNCTION public.get_visitor_map_data(p_site text DEFAULT NULL)
RETURNS TABLE (
  ip_hash text,
  lat numeric,
  lng numeric,
  city text,
  country_code text,
  visit_count bigint,
  first_visit timestamptz,
  last_visit timestamptz,
  is_ghost boolean
) AS $$
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
  FROM visitor_logs vl
  WHERE vl.ip_hash IS NOT NULL
    AND vl.latitude IS NOT NULL
    AND vl.longitude IS NOT NULL
    AND (
      p_site IS NULL
      OR (p_site = 'tapestry' AND (vl.site = 'tapestry' OR vl.site IS NULL))
      OR (p_site <> 'tapestry' AND vl.site = p_site)
    )
  GROUP BY vl.ip_hash
  ORDER BY visit_count DESC
$$ LANGUAGE sql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
