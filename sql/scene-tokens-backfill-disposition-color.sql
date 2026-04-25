-- scene-tokens-backfill-disposition-color.sql
-- One-shot fix-up: existing scene_tokens for NPCs were inserted with a
-- hardcoded color ('#c0392b' red) regardless of disposition, so the
-- token ring on the tactical map didn't match the NPC card's disposition
-- ring (friendly green / neutral gray / hostile red). The placement
-- code now uses getNpcRingColor() at insert time; this brings already-
-- placed tokens into line so the GM doesn't have to re-place every
-- token to see the right color.
--
-- Idempotent — running it again with no changes is a no-op.

UPDATE public.scene_tokens t
   SET color = CASE n.disposition
                 WHEN 'friendly' THEN '#2d5a1b'
                 WHEN 'hostile'  THEN '#c0392b'
                 ELSE                 '#3a3a3a'
               END
  FROM public.campaign_npcs n
 WHERE t.npc_id = n.id
   AND t.token_type = 'npc'
   AND COALESCE(t.color, '') <> CASE n.disposition
                                  WHEN 'friendly' THEN '#2d5a1b'
                                  WHEN 'hostile'  THEN '#c0392b'
                                  ELSE                 '#3a3a3a'
                                END;
