-- mongrels-npcs-disposition-backfill.sql
-- Stamps disposition + npc_type onto every seeded Mongrels NPC by name.
-- The seed-mongrels-npcs.sql / lib/setting-npcs.ts seeds never set
-- these fields, so existing Mongrels campaigns have NULL on both —
-- which makes the roster ring fall back to neutral gray (a friendly
-- ally rendering as gray, a hostile soldier rendering as gray, etc.).
--
-- Setting these explicitly resolves the ambiguity:
--   - disposition drives ring/token color (friendly/neutral/hostile)
--   - npc_type drives the threat-level badge (bystander/goon/foe/antagonist)
--
-- Idempotent — only updates rows where the field is currently null.

-- Friendlies / bystanders ── allied to the players.
UPDATE campaign_npcs SET disposition = COALESCE(disposition, 'friendly'),
                          npc_type    = COALESCE(npc_type, 'bystander')
 WHERE name IN (
   'Frank "Frankie" Wallace',
   'Nana Ruth',
   'Marcus Webb'
 );

-- Hostile leaders / antagonists.
UPDATE campaign_npcs SET disposition = COALESCE(disposition, 'hostile'),
                          npc_type    = COALESCE(npc_type, 'antagonist')
 WHERE name IN (
   'Kincaid',
   'Brother Elias'
 );

-- Hostile foot-soldiers / lieutenants.
UPDATE campaign_npcs SET disposition = COALESCE(disposition, 'hostile'),
                          npc_type    = COALESCE(npc_type, 'foe')
 WHERE name IN (
   'Justice Morse'
 );

UPDATE campaign_npcs SET disposition = COALESCE(disposition, 'hostile'),
                          npc_type    = COALESCE(npc_type, 'goon')
 WHERE name = 'Kincaid''s Soldier';

-- Neutral encounters — could go either way depending on player choices.
UPDATE campaign_npcs SET disposition = COALESCE(disposition, 'neutral'),
                          npc_type    = COALESCE(npc_type, 'bystander')
 WHERE name IN (
   'The Watcher of Page',
   'Cole Vickers',
   'The Dying Traveller',
   'Dillon Rancher'
 );

-- Re-color any already-placed scene_tokens for these NPCs so the
-- tactical map matches the new disposition. (Same fallback chain as
-- sql/scene-tokens-backfill-disposition-color.sql.)
UPDATE public.scene_tokens t
   SET color = CASE
                 WHEN n.disposition = 'friendly' THEN '#2d5a1b'
                 WHEN n.disposition = 'hostile'  THEN '#c0392b'
                 WHEN n.disposition = 'neutral'  THEN '#3a3a3a'
                 ELSE                                  '#3a3a3a'
               END
  FROM public.campaign_npcs n
 WHERE t.npc_id = n.id
   AND t.token_type = 'npc';
