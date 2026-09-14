-- Fix: found via the same schema-wide duplicate-PERMISSIVE-policy sweep.
-- npc_relationships had two SELECT policies:
--   "Players can read own revealed relationships" - despite the name,
--     the USING clause only checked character ownership
--     (character_id IN (own characters)) - it never actually checked
--     the `revealed` column the name promises.
--   npc_relationships_select - campaign member OR GM, unconditional -
--     wider than the first policy in every way, so it alone determined
--     access via the PERMISSIVE OR.
-- Net effect: any campaign member could read ANY character's relationship
-- row with ANY NPC in that campaign - including relationship_cmod and
-- notes for rows with revealed=false, which the GM-facing reveal/hide-all
-- controls (lib/data/npc-roster.ts revealRelationshipsByIds /
-- hideRelationshipsByNpcs) exist specifically to gate. Same narrative-
-- spoiler class as tonight's campaign_npcs.hidden_from_players fix.
--
-- Fix: one policy - GM sees everything for NPCs in their own campaign;
-- everyone else sees only their OWN character's relationship rows, and
-- only once revealed=true.

BEGIN;

DROP POLICY IF EXISTS "Players can read own revealed relationships" ON public.npc_relationships;
DROP POLICY IF EXISTS npc_relationships_select ON public.npc_relationships;

CREATE POLICY npc_relationships_select ON public.npc_relationships
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaign_npcs n
      JOIN campaigns c ON c.id = n.campaign_id
      WHERE n.id = npc_relationships.npc_id AND c.gm_user_id = auth.uid()
    )
    OR (
      revealed = true
      AND EXISTS (
        SELECT 1 FROM characters ch
        WHERE ch.id = npc_relationships.character_id AND ch.user_id = auth.uid()
      )
    )
  );

COMMIT;
