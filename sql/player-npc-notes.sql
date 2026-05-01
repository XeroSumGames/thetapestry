-- player-npc-notes.sql
-- Player-authored personal notes about an NPC, scoped to a specific
-- character (so a player with multiple PCs in a campaign can keep
-- separate notes per PC). Surfaces in PlayerNpcCard so players can
-- finally remember which NPC was which between sessions.
--
-- Notes are private to the character's owner. The GM does NOT see
-- them — the GM has their own NPC notes via campaign_npcs.notes.
--
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS public.player_npc_notes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id    uuid        NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  npc_id          uuid        NOT NULL REFERENCES public.campaign_npcs(id) ON DELETE CASCADE,
  note            text        NOT NULL DEFAULT '',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (character_id, npc_id)
);

CREATE INDEX IF NOT EXISTS idx_player_npc_notes_char ON public.player_npc_notes (character_id);
CREATE INDEX IF NOT EXISTS idx_player_npc_notes_npc  ON public.player_npc_notes (npc_id);

-- Touch updated_at on update so the card can show "last edited" if
-- we ever want it.
CREATE OR REPLACE FUNCTION public.player_npc_notes_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS player_npc_notes_touch ON public.player_npc_notes;
CREATE TRIGGER player_npc_notes_touch
  BEFORE UPDATE ON public.player_npc_notes
  FOR EACH ROW EXECUTE FUNCTION public.player_npc_notes_touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────
-- Notes are private to the character's owner. The four policies are
-- all the same shape: the acting user must own the character row
-- the note is attached to. The GM is intentionally NOT included —
-- player notes are personal-POV; the GM has campaign_npcs.notes for
-- their own bookkeeping.
ALTER TABLE public.player_npc_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pnn_select" ON public.player_npc_notes;
CREATE POLICY "pnn_select" ON public.player_npc_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = player_npc_notes.character_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "pnn_insert" ON public.player_npc_notes;
CREATE POLICY "pnn_insert" ON public.player_npc_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = player_npc_notes.character_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "pnn_update" ON public.player_npc_notes;
CREATE POLICY "pnn_update" ON public.player_npc_notes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = player_npc_notes.character_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = player_npc_notes.character_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "pnn_delete" ON public.player_npc_notes;
CREATE POLICY "pnn_delete" ON public.player_npc_notes
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = player_npc_notes.character_id
        AND c.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
