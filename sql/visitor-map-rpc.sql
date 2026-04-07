-- RPC function to get aggregated visitor map data
-- Groups by ip_hash to get one row per unique visitor
CREATE OR REPLACE FUNCTION get_visitor_map_data()
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
  GROUP BY vl.ip_hash
  ORDER BY visit_count DESC
$$ LANGUAGE sql SECURITY DEFINER;
