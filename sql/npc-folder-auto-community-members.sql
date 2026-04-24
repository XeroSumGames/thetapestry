-- Auto-file recruited NPCs under the "Community Members" folder on the
-- NPC roster. Trigger fires on INSERT into community_members; if the new
-- row has an npc_id and the NPC's folder is currently empty (Unfiled),
-- set folder='Community Members' so the GM's roster panel groups them
-- together without manual filing.
--
-- We *don't* overwrite an existing custom folder — if the GM has already
-- organized this NPC under e.g. "The Connors", joining a community
-- shouldn't yank them out of that grouping.
--
-- Idempotent. Safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_file_recruited_npc()
RETURNS trigger AS $$
BEGIN
  IF NEW.npc_id IS NOT NULL THEN
    UPDATE public.campaign_npcs
    SET folder = 'Community Members'
    WHERE id = NEW.npc_id
      AND (folder IS NULL OR folder = '' OR folder = 'Uncategorized');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_file_recruited_npc ON public.community_members;
CREATE TRIGGER trg_auto_file_recruited_npc
  AFTER INSERT ON public.community_members
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_file_recruited_npc();

-- One-shot backfill: any NPC currently in a community but unfiled gets
-- moved to "Community Members" right now. Same conservative rule —
-- existing custom folders are preserved.
UPDATE public.campaign_npcs c
SET folder = 'Community Members'
WHERE (folder IS NULL OR folder = '' OR folder = 'Uncategorized')
  AND EXISTS (
    SELECT 1 FROM public.community_members cm
    WHERE cm.npc_id = c.id AND cm.left_at IS NULL
  );
