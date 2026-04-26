-- minnie-mounted-sniper-backfill.sql
-- Stamps the mounted Sniper's Rifle onto every existing Minnie vehicle
-- so the popout shows the Attack button without having to re-create
-- the campaign. New Mongrels campaigns get this from
-- lib/setting-vehicles.ts at creation time; this is the one-shot for
-- campaigns seeded before the mounted_weapons field existed.
--
-- Idempotent — only fills in vehicles that don't already have a
-- mounted_weapons array, and skips entries that already include a
-- Sniper's Rifle.

UPDATE campaigns
   SET vehicles = (
     SELECT jsonb_agg(
       CASE
         WHEN (v->>'id' = 'minnie-001' OR v->>'name' = 'Minnie')
              AND NOT (v ? 'mounted_weapons' AND jsonb_array_length(v->'mounted_weapons') > 0)
              THEN v || jsonb_build_object('mounted_weapons', jsonb_build_array(
                jsonb_build_object(
                  'name', 'Sniper''s Rifle',
                  'notes', 'Mounted in the roof sniper nest between the AC units. Fires forward in a 90° arc only.'
                )
              ))
         ELSE v
       END
     )
     FROM jsonb_array_elements(vehicles) v
   )
 WHERE vehicles IS NOT NULL
   AND jsonb_typeof(vehicles) = 'array'
   AND EXISTS (
     SELECT 1 FROM jsonb_array_elements(vehicles) v
     WHERE (v->>'id' = 'minnie-001' OR v->>'name' = 'Minnie')
       AND NOT (v ? 'mounted_weapons' AND jsonb_array_length(v->'mounted_weapons') > 0)
   );
