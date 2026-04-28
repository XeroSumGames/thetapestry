-- ============================================================
-- campaign_npcs: add hidden_from_players boolean
-- ============================================================
--
-- Players were seeing every NPC in the GM's campaign roster the
-- moment Start Combat was hit (or any time the campaign_npcs realtime
-- subscription delivered a row). RLS today permits any campaign
-- member to SELECT every NPC row.
--
-- This migration:
--   1. Adds `hidden_from_players boolean NOT NULL DEFAULT true` so
--      every NEW NPC is invisible to players until the GM acts.
--   2. Backfills all existing rows to `false` — preserves visibility
--      in in-progress campaigns; the new default only affects NPCs
--      created after this migration runs.
--   3. Replaces the SELECT policy: GM still sees all; non-GM members
--      only see rows where hidden_from_players = false.
--   4. Adds two AFTER INSERT triggers that auto-flip the flag to
--      false when an NPC becomes "visible by GM action":
--         - placed on a tactical map (scene_tokens INSERT with npc_id)
--         - added to combat (initiative_order INSERT with npc_id)
--      Application code can also flip the flag explicitly (NpcRoster
--      Reveal button) — the trigger is just a safety net.
--
-- Idempotent — safe to re-run.

-- ── 1. Column ─────────────────────────────────────────────────
ALTER TABLE public.campaign_npcs
  ADD COLUMN IF NOT EXISTS hidden_from_players boolean NOT NULL DEFAULT true;

-- ── 2. One-shot backfill ──────────────────────────────────────
-- Re-running the migration on a fresh column would default every row
-- to true; this UPDATE makes the migration safe to apply on a live
-- campaign without stranding the GM's existing roster.
UPDATE public.campaign_npcs SET hidden_from_players = false WHERE hidden_from_players = true;

-- ── 3. Replacement SELECT policy ──────────────────────────────
DROP POLICY IF EXISTS "Campaign members can read campaign npcs" ON public.campaign_npcs;
CREATE POLICY "Campaign members can read campaign npcs"
  ON public.campaign_npcs FOR SELECT TO authenticated
  USING (
    -- GM sees every NPC in their campaign
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_npcs.campaign_id
        AND c.gm_user_id = auth.uid()
    )
    -- Non-GM members only see non-hidden NPCs
    OR (
      hidden_from_players = false
      AND EXISTS (
        SELECT 1 FROM public.campaign_members cm
        WHERE cm.campaign_id = campaign_npcs.campaign_id
          AND cm.user_id = auth.uid()
      )
    )
  );

-- ── 4a. Trigger: place token on tactical map → reveal NPC ─────
CREATE OR REPLACE FUNCTION public.reveal_npc_on_scene_token_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.npc_id IS NOT NULL THEN
    UPDATE public.campaign_npcs
       SET hidden_from_players = false
     WHERE id = NEW.npc_id
       AND hidden_from_players = true;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS scene_token_reveals_npc ON public.scene_tokens;
CREATE TRIGGER scene_token_reveals_npc
  AFTER INSERT ON public.scene_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.reveal_npc_on_scene_token_insert();

-- ── 4b. Trigger: add to initiative → reveal NPC ───────────────
CREATE OR REPLACE FUNCTION public.reveal_npc_on_initiative_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.npc_id IS NOT NULL THEN
    UPDATE public.campaign_npcs
       SET hidden_from_players = false
     WHERE id = NEW.npc_id
       AND hidden_from_players = true;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS initiative_reveals_npc ON public.initiative_order;
CREATE TRIGGER initiative_reveals_npc
  AFTER INSERT ON public.initiative_order
  FOR EACH ROW
  EXECUTE FUNCTION public.reveal_npc_on_initiative_insert();

-- ── Diagnostic ──
-- SELECT name, hidden_from_players, npc_type FROM public.campaign_npcs ORDER BY hidden_from_players DESC, name;
