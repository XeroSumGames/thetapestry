-- Fix: found via Hunt & Peck's NPC<->pin feature hand-off - "Campaign
-- members update campaign_npcs" (USING/WITH CHECK: member OR GM, no
-- column restriction) lets ANY campaign member write hidden_from_players,
-- not just the GM. That directly undermines the 2026-08-01 fog-of-war fix
-- (fix-fog-of-war-hidden-data-rls-2026-08-01.sql) - a player could set
-- hidden_from_players=false on a GM-hidden ambush/secret NPC to reveal it
-- to themselves, bypassing the SELECT-side gate entirely by just turning
-- the flag off from the write side.
--
-- The only write site in the app is NpcRoster.tsx's quickReveal() - GM
-- tooling, whose own comment states the intent explicitly: "the RLS would
-- still hide the NPC from players... without this" - confirming RLS was
-- always meant to be the real enforcement, not the UI. Verified no other
-- code path writes this column (searched every updateCampaignNpc /
-- campaign_npcs.update call site).
--
-- Scoped narrowly to hidden_from_players only - campaign_npcs also holds
-- legitimate any-member-writable combat-live-state fields (wp_current,
-- rp_current, death_countdown, incap_rounds, inventory, skills, status
-- reset on Restore) that real gameplay code writes from non-GM sessions
-- during combat. A blanket clamp would break that; this trigger touches
-- nothing else.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_campaign_npc_visibility_gm_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NEW.hidden_from_players IS DISTINCT FROM OLD.hidden_from_players THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = NEW.campaign_id AND c.gm_user_id = auth.uid()
    ) AND NOT public.is_thriver() THEN
      NEW.hidden_from_players := OLD.hidden_from_players;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_campaign_npc_visibility ON public.campaign_npcs;
CREATE TRIGGER trg_enforce_campaign_npc_visibility
  BEFORE UPDATE ON public.campaign_npcs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_campaign_npc_visibility_gm_only();

COMMIT;
