-- ============================================================
-- Weapons rename round 2 — RPG Launcher → Rocket Launcher,
-- Flamethrower → Flame-Thrower
-- ============================================================
--
-- Follow-up to sql/weapons-srd-rename.sql. The audit doc flagged two
-- additional CRB-disagreements that Xero confirmed on 2026-04-29:
--
--   "RPG Launcher"   → "Rocket Launcher"   (CRB canonical name)
--   "Flamethrower"   → "Flame-Thrower"     (CRB hyphenated form)
--
-- Code-side stat changes that landed alongside the rename:
--
-- Rocket Launcher:
--   - range:    Long      → Distant       (per CRB)
--   - enc:      2         → 3             (per CRB)
--   - ammo:     (none)    → 'Uncommon'    (per CRB — now requires ammo to fire)
--
-- Flame-Thrower:
--   - rpPercent: 50      (unchanged — Xero kept code value over CRB's 100)
--   - clip:      30      (unchanged — Xero kept code value over CRB's 1)
--   - ammo:      (none)   → 'Rare'        (NEW — now requires Rare-grade ammo)
--
-- Player-facing impact: characters or NPCs who had either weapon
-- equipped will see a "weapon not found" gap on their sheet until
-- this migration runs (getWeaponByName returns undefined for the
-- old labels). The Rocket Launcher gameplay also tightens: it now
-- consumes Uncommon ammo per shot, takes more encumbrance, and
-- shoots at one range band further out. The Flame-Thrower
-- gameplay tightens too — Rare ammo per refill.
--
-- Idempotent — safe to re-run.

DO $$
DECLARE
  rename_pairs text[][] := ARRAY[
    ARRAY['RPG Launcher',  'Rocket Launcher'],
    ARRAY['Flamethrower',  'Flame-Thrower']
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

    UPDATE public.campaign_npcs
       SET skills = jsonb_set(skills, '{weapon2,weaponName}', to_jsonb(pair[2]))
     WHERE skills->'weapon2'->>'weaponName' = pair[1];

    UPDATE public.world_npcs
       SET skills = jsonb_set(skills, '{weapon,weaponName}', to_jsonb(pair[2]))
     WHERE skills->'weapon'->>'weaponName' = pair[1];

    UPDATE public.world_npcs
       SET skills = jsonb_set(skills, '{weapon2,weaponName}', to_jsonb(pair[2]))
     WHERE skills->'weapon2'->>'weaponName' = pair[1];
  END LOOP;
END $$;

-- ── Inventory arrays (characters.data.inventory[],
--    campaign_npcs.inventory[], world_npcs.inventory[],
--    campaign_npcs.equipment[]) — same map-and-replace pattern as
--    sql/weapons-srd-rename.sql.
DO $$
DECLARE
  rename_pairs text[][] := ARRAY[
    ARRAY['RPG Launcher',  'Rocket Launcher'],
    ARRAY['Flamethrower',  'Flame-Thrower']
  ];
  pair text[];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY rename_pairs LOOP
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
