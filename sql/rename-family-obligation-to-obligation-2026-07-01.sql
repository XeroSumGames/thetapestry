-- Rename the "Family Obligation" complication to "Obligation" (Xero canon call 2026-07-01).
-- Code/canon already renamed (lib/xse-schema.ts, rules page, npc-generator, NpcRoster,
-- setting-npcs, seed-official-pregens.sql + canon snapshot). This migrates the stored
-- string so existing rows match the new dropdown label.
-- Footprint (verified live + dry-run, rolled back): characters 12, pregen_library 1,
-- campaign_npcs 7. world_npcs has no complication field. Reversible (swap the strings back).

UPDATE public.characters
  SET data = jsonb_set(data, '{complication}', '"Obligation"'::jsonb)
  WHERE data->>'complication' = 'Family Obligation';

UPDATE public.pregen_library
  SET data = jsonb_set(data, '{complication}', '"Obligation"'::jsonb)
  WHERE data->>'complication' = 'Family Obligation';

UPDATE public.campaign_npcs
  SET complication = 'Obligation'
  WHERE complication = 'Family Obligation';
