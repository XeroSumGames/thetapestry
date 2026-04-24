-- Phase D follow-up — "Assigned" role mission/task linkage. Mirrors
-- the Apprentice pattern: Assigned NPCs now record which PC is
-- directing them and (reusing current_task from the Apprentice
-- migration) what they're doing. On-delete-set-null so a PC leaving
-- the characters table doesn't orphan the NPC — the assignment
-- silently clears and the GM can reassign.
-- Idempotent: IF NOT EXISTS guards the column add.

ALTER TABLE public.community_members
  ADD COLUMN IF NOT EXISTS assignment_pc_id uuid REFERENCES public.characters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_community_members_assignment_pc
  ON public.community_members(assignment_pc_id)
  WHERE assignment_pc_id IS NOT NULL;
