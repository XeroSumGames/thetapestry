-- ============================================================
-- Weapons SRD-rename migration
-- ============================================================
--
-- Rationale: lib/weapons.ts had five weapon entries whose stats
-- match a CRB weapon exactly but whose names were transcribed wrong
-- (probably copied from the SRD's mangled-text PDF extraction).
-- Audit doc: tasks/srd-weapons-audit.md.
--
-- Renames applied in code (lib/weapons.ts + lib/range-profiles.ts):
--   "Bayonet / Bowie Knife" → "Baseball Bat"
--   "Bat / Stick"           → "Bullwhip"
--   "Cleaver"               → "Club"
--   "Makeshift Cleaver"     → "Makeshift Club"
--   "Compact Bow"           → "Compound Bow"
--
-- Without this migration, characters / NPCs whose primary or
-- secondary weapon is one of the old names will have an orphan
-- pick — getWeaponByName() returns undefined and the weapon
-- vanishes from sheets / popouts / combat actions.
--
-- Mirrors the pattern in sql/weapon-taser-rename.sql (which
-- renamed Taser → Cattle Prod the same way).
--
-- Idempotent — safe to re-run.

-- ── Characters: weaponPrimary / weaponSecondary slots ────────
DO $$
DECLARE
  rename_pairs text[][] := ARRAY[
    ARRAY['Bayonet / Bowie Knife', 'Baseball Bat'],
    ARRAY['Bat / Stick',           'Bullwhip'],
    ARRAY['Cleaver',               'Club'],
    ARRAY['Makeshift Cleaver',     'Makeshift Club'],
    ARRAY['Compact Bow',           'Compound Bow']
  ];
  pair text[];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY rename_pairs LOOP
    UPDATE public.characters
       SET data = jsonb_set(data, '{weaponPrimary,weaponName}', to_jsonb(pair[2]))
     WHERE data->'weaponPrimary'->>'weaponName' = pair[1];

    UPDATE public.characters
       SET data = jsonb_set(data, '{weaponSecondary,weaponName}', to_jsonb(pair[2]))
     WHERE data->'weaponSecondary'->>'weaponName' = pair[1];

    UPDATE public.campaign_npcs
       SET skills = jsonb_set(skills, '{weapon,weaponName}', to_jsonb(pair[2]))
     WHERE skills->'weapon'->>'weaponName' = pair[1];

    UPDATE public.world_npcs
       SET skills = jsonb_set(skills, '{weapon,weaponName}', to_jsonb(pair[2]))
     WHERE skills->'weapon'->>'weaponName' = pair[1];
  END LOOP;
END $$;

-- ── Inventory arrays — characters.data.inventory[] and
--    campaign_npcs.inventory[] / world_npcs.inventory[] (each item
--    has a .name field). These are item drops / stashed weapons,
--    not the active primary/secondary slots, but we still want to
--    rename so the existing entries continue to resolve. We build
--    the new array by mapping each element through a CASE.
DO $$
DECLARE
  rename_pairs text[][] := ARRAY[
    ARRAY['Bayonet / Bowie Knife', 'Baseball Bat'],
    ARRAY['Bat / Stick',           'Bullwhip'],
    ARRAY['Cleaver',               'Club'],
    ARRAY['Makeshift Cleaver',     'Makeshift Club'],
    ARRAY['Compact Bow',           'Compound Bow']
  ];
  pair text[];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY rename_pairs LOOP
    -- characters.data.inventory[]
    UPDATE public.characters c
       SET data = jsonb_set(
             c.data,
             '{inventory}',
             COALESCE(
               (SELECT jsonb_agg(
                  CASE WHEN item->>'name' = pair[1]
                       THEN jsonb_set(item, '{name}', to_jsonb(pair[2]))
                       ELSE item
                  END
                )
                FROM jsonb_array_elements(c.data->'inventory') item),
               '[]'::jsonb
             )
           )
     WHERE c.data ? 'inventory'
       AND jsonb_typeof(c.data->'inventory') = 'array'
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(c.data->'inventory') x
          WHERE x->>'name' = pair[1]
       );

    -- campaign_npcs.inventory[]
    UPDATE public.campaign_npcs n
       SET inventory = COALESCE(
             (SELECT jsonb_agg(
                CASE WHEN item->>'name' = pair[1]
                     THEN jsonb_set(item, '{name}', to_jsonb(pair[2]))
                     ELSE item
                END
              )
              FROM jsonb_array_elements(n.inventory) item),
             '[]'::jsonb
           )
     WHERE n.inventory IS NOT NULL
       AND jsonb_typeof(n.inventory) = 'array'
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(n.inventory) x
          WHERE x->>'name' = pair[1]
       );

    -- world_npcs.inventory[] — only present when the column exists,
    -- so guard with a regclass check.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = 'world_npcs'
         AND column_name  = 'inventory'
    ) THEN
      UPDATE public.world_npcs n
         SET inventory = COALESCE(
               (SELECT jsonb_agg(
                  CASE WHEN item->>'name' = pair[1]
                       THEN jsonb_set(item, '{name}', to_jsonb(pair[2]))
                       ELSE item
                  END
                )
                FROM jsonb_array_elements(n.inventory) item),
               '[]'::jsonb
             )
       WHERE n.inventory IS NOT NULL
         AND jsonb_typeof(n.inventory) = 'array'
         AND EXISTS (
           SELECT 1 FROM jsonb_array_elements(n.inventory) x
            WHERE x->>'name' = pair[1]
         );
    END IF;
  END LOOP;
END $$;

-- ── Campaign NPCs equipment arrays (some setups carry their loadout
--    in `equipment` not `skills.weapon`). Same map-and-replace.
DO $$
DECLARE
  rename_pairs text[][] := ARRAY[
    ARRAY['Bayonet / Bowie Knife', 'Baseball Bat'],
    ARRAY['Bat / Stick',           'Bullwhip'],
    ARRAY['Cleaver',               'Club'],
    ARRAY['Makeshift Cleaver',     'Makeshift Club'],
    ARRAY['Compact Bow',           'Compound Bow']
  ];
  pair text[];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY rename_pairs LOOP
    UPDATE public.campaign_npcs n
       SET equipment = COALESCE(
             (SELECT jsonb_agg(
                CASE WHEN item->>'name' = pair[1]
                     THEN jsonb_set(item, '{name}', to_jsonb(pair[2]))
                     ELSE item
                END
              )
              FROM jsonb_array_elements(n.equipment) item),
             '[]'::jsonb
           )
     WHERE n.equipment IS NOT NULL
       AND jsonb_typeof(n.equipment) = 'array'
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(n.equipment) x
          WHERE x->>'name' = pair[1]
       );
  END LOOP;
END $$;

-- ── Diagnostic ──
-- After running, this should return zero rows:
--   SELECT name, data->'weaponPrimary'->>'weaponName'   AS primary,
--          data->'weaponSecondary'->>'weaponName' AS secondary
--     FROM characters
--    WHERE data->'weaponPrimary'->>'weaponName'  IN
--          ('Bayonet / Bowie Knife','Bat / Stick','Cleaver','Makeshift Cleaver','Compact Bow')
--       OR data->'weaponSecondary'->>'weaponName' IN
--          ('Bayonet / Bowie Knife','Bat / Stick','Cleaver','Makeshift Cleaver','Compact Bow');
