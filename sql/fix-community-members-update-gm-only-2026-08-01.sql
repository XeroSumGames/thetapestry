-- Fix: community_members_update had USING = (GM OR any campaign member)
-- and NO WITH CHECK (so USING is reused as WITH CHECK per Postgres RLS
-- semantics) - any campaign member, not just the GM, could UPDATE any
-- OTHER member's community_members row to arbitrary values: role
-- (the SRD Section 8 labor-quota role - gatherer/maintainer/safety/
-- assigned/unassigned, which feeds the Weekly Morale Check math),
-- status, left_at/left_reason (force-remove any member), current_task,
-- assignment_pc_id, escape_pending, etc.
--
-- This wasn't just an API-bypass risk - components/CampaignCommunity.tsx
-- renders the role <select> for every viewer with no isGM check at all
-- (companion fix in the same commit), so ANY player could reassign ANY
-- other member's (PC or NPC) labor role directly from the visible UI,
-- no devtools needed. The file's own comments elsewhere document
-- adjacent features (apprentice task delegation) as explicitly
-- "GM-only for MVP" - this control was very likely meant to be the same
-- and simply never got the isGM gate.
--
-- The separate "Player leaves own community row" policy (own character's
-- row only, scoped via campaign_members join) is untouched - that one is
-- correctly narrow and stays as the legitimate self-service leave path.
--
-- Fix: restrict community_members_update to GM-only, with a real
-- WITH CHECK this time (not reused USING).

BEGIN;

DROP POLICY IF EXISTS community_members_update ON public.community_members;
CREATE POLICY community_members_update ON public.community_members
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM communities com
      JOIN campaigns c ON c.id = com.campaign_id
      WHERE com.id = community_members.community_id AND c.gm_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM communities com
      JOIN campaigns c ON c.id = com.campaign_id
      WHERE com.id = community_members.community_id AND c.gm_user_id = auth.uid()
    )
  );

COMMIT;
