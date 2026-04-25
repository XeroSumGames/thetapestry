-- scene-tokens-backfill-disposition-color.sql
-- One-shot fix-up: existing scene_tokens for NPCs were inserted with a
-- hardcoded color ('#c0392b' red) regardless of NPC. The placement code
-- now uses getNpcTokenBorderColor() at insert time:
--
--   1. disposition wins when set (friendly → green, hostile → red,
--      neutral → gray)
--   2. falls back to npc_type when disposition is unset (foe/goon/
--      antagonist → red, bystander/friendly → green) so legacy or
--      setting-imported NPCs that never had a disposition keep their
--      threat signal instead of regressing to neutral gray
--   3. final fallback is red (#c0392b) so anything previously rendered
--      red doesn't go silent
--
-- This UPDATE applies the same chain in SQL so already-placed tokens
-- recolor to match. Idempotent — re-running with no changes is a no-op.

UPDATE public.scene_tokens t
   SET color = CASE
                 WHEN n.disposition = 'friendly' THEN '#2d5a1b'
                 WHEN n.disposition = 'hostile'  THEN '#c0392b'
                 WHEN n.disposition = 'neutral'  THEN '#3a3a3a'
                 WHEN LOWER(COALESCE(n.npc_type, '')) IN ('bystander', 'friendly')              THEN '#2d5a1b'
                 WHEN LOWER(COALESCE(n.npc_type, '')) IN ('foe', 'goon', 'antagonist')          THEN '#c0392b'
                 ELSE                                                                                 '#c0392b'
               END
  FROM public.campaign_npcs n
 WHERE t.npc_id = n.id
   AND t.token_type = 'npc'
   AND COALESCE(t.color, '') <> CASE
                                  WHEN n.disposition = 'friendly' THEN '#2d5a1b'
                                  WHEN n.disposition = 'hostile'  THEN '#c0392b'
                                  WHEN n.disposition = 'neutral'  THEN '#3a3a3a'
                                  WHEN LOWER(COALESCE(n.npc_type, '')) IN ('bystander', 'friendly')     THEN '#2d5a1b'
                                  WHEN LOWER(COALESCE(n.npc_type, '')) IN ('foe', 'goon', 'antagonist') THEN '#c0392b'
                                  ELSE                                                                        '#c0392b'
                                END;
