-- minnie-m60-arc-backfill.sql
-- Existing Mongrels campaigns were seeded with Minnie before the
-- mount_angle / arc_degrees fields existed on mounted_weapons. The
-- tactical map's firing-arc visualizer reads those fields, so any
-- pre-existing Minnie M60 won't show the arc toggle. This patches
-- live data in place.
--
-- Strategy: walk every campaigns.vehicles entry; for any entry whose
-- name = 'Minnie' (case-sensitive) and whose mounted_weapons array
-- contains an 'M60 (Mounted)' that's missing arc_degrees, rewrite
-- that mounted_weapon with mount_angle=0 + arc_degrees=90.
--
-- Idempotent — re-running on already-patched rows leaves the values
-- untouched (they're 0 / 90, which equal what we'd write).

UPDATE public.campaigns AS c
   SET vehicles = (
     SELECT jsonb_agg(
       CASE
         WHEN veh->>'name' = 'Minnie'
              AND veh ? 'mounted_weapons'
              AND jsonb_typeof(veh->'mounted_weapons') = 'array'
         THEN jsonb_set(
           veh,
           '{mounted_weapons}',
           (
             SELECT jsonb_agg(
               CASE
                 WHEN w->>'name' = 'M60 (Mounted)'
                 THEN w
                      || jsonb_build_object('mount_angle', COALESCE((w->>'mount_angle')::int, 0))
                      || jsonb_build_object('arc_degrees', COALESCE((w->>'arc_degrees')::int, 90))
                 ELSE w
               END
             )
             FROM jsonb_array_elements(veh->'mounted_weapons') AS w
           )
         )
         ELSE veh
       END
     )
     FROM jsonb_array_elements(c.vehicles) AS veh
   )
 WHERE c.vehicles IS NOT NULL
   AND jsonb_typeof(c.vehicles) = 'array'
   AND EXISTS (
     SELECT 1
       FROM jsonb_array_elements(c.vehicles) AS v
      WHERE v->>'name' = 'Minnie'
   );

NOTIFY pgrst, 'reload schema';
