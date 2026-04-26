-- patch-minnie-m60.sql
-- Swap Minnie's roof weapon from a Sniper Rifle to a mounted M60 on
-- existing Mongrels campaigns that already had the seed applied (the
-- seed-minnie-vehicle.sql update only touches empty vehicles arrays,
-- so already-seeded campaigns wouldn't pick up the rename).
--
-- - Replaces vehicles[*].mounted_weapons entries pointing at "Sniper's
--   Rifle" with the new M60 (Mounted) entry.
-- - If a Minnie row has NO mounted_weapons array yet (older seeds),
--   adds one with the M60.
-- - Renames the cargo line "Sniper Rifle (fitted)" → "M60 (Mounted)"
--   with belt-fed ammo notes.
-- - Rewrites the closing bullet of vehicles[*].notes from "snipernest
--   ... fitted sniper rifle" wording to "weapon nest ... fitted M60".
--
-- Idempotent — re-running on already-patched data is a no-op.

UPDATE campaigns
SET vehicles = (
  SELECT jsonb_agg(
    CASE
      WHEN v->>'name' = 'Minnie' THEN
        jsonb_set(
          jsonb_set(
            jsonb_set(
              v,
              '{mounted_weapons}',
              '[{"name":"M60 (Mounted)","notes":"Mounted in the roof weapon nest between the AC units. Fires forward in a 90° arc only."}]'::jsonb,
              true
            ),
            '{cargo}',
            (
              SELECT jsonb_agg(
                CASE
                  WHEN c->>'name' = 'Sniper Rifle (fitted)'
                    THEN jsonb_build_object('name', 'M60 (Mounted)', 'qty', 1, 'notes', '300 rounds belt-fed')
                  ELSE c
                END
              )
              FROM jsonb_array_elements(v->'cargo') c
            ),
            true
          ),
          '{notes}',
          to_jsonb(
            replace(
              v->>'notes',
              'Has a snipernest built on the top, between the AC units, with a fitted sniper rifle that only fires forward in a 90 degree arc.',
              'Has a weapon nest built on the top, between the AC units, with a fitted M60 that only fires forward in a 90 degree arc.'
            )
          ),
          true
        )
      ELSE v
    END
  )
  FROM jsonb_array_elements(vehicles) v
)
WHERE setting = 'mongrels'
  AND vehicles IS NOT NULL
  AND jsonb_array_length(vehicles) > 0
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(vehicles) v
    WHERE v->>'name' = 'Minnie'
  );
