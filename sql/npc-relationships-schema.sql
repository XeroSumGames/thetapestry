-- ============================================================
-- npc_relationships — First Impression CMod, reveal level, per-(PC,NPC)
-- ============================================================
--
-- This table has been used in production for some time but was never
-- formalized in version control. The definition here is idempotent
-- (CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS) so running
-- against a Supabase that already has the table is a no-op for data
-- and only re-asserts the RLS policies.
--
-- Scope: one row per (PC character, campaign NPC) pair. Tracks:
--   - relationship_cmod (int): the First Impression modifier, reused
--     by Recruitment checks (Communities Phase B) as a CMod input.
--   - revealed (bool): whether this PC has met / learned of this NPC.
--   - reveal_level (text): 'name_portrait' | 'name_portrait_role' | null
--     controls how much of the NPC card is visible to the player.
--
-- No campaign_id column: NPCs and characters are both scoped to a
-- single campaign, so (npc_id, character_id) uniquely identifies a
-- relationship. A unique constraint enforces that below.

CREATE TABLE IF NOT EXISTS public.npc_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_id uuid NOT NULL REFERENCES public.campaign_npcs(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  relationship_cmod int NOT NULL DEFAULT 0,
  revealed boolean NOT NULL DEFAULT false,
  reveal_level text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Uniqueness: one relationship row per (NPC, character) pair. Required
-- so upsert-shape code ("update existing or insert new") is race-safe.
-- Wrap in DO block so re-runs don't error if the constraint already
-- exists from an earlier migration under a different name.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.npc_relationships'::regclass
      AND contype = 'u'
      AND conname = 'npc_relationships_npc_char_uniq'
  ) THEN
    ALTER TABLE public.npc_relationships
      ADD CONSTRAINT npc_relationships_npc_char_uniq UNIQUE (npc_id, character_id);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_npc_relationships_npc ON public.npc_relationships(npc_id);
CREATE INDEX IF NOT EXISTS idx_npc_relationships_character ON public.npc_relationships(character_id);
CREATE INDEX IF NOT EXISTS idx_npc_relationships_revealed ON public.npc_relationships(revealed) WHERE revealed = true;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.npc_relationships ENABLE ROW LEVEL SECURITY;

-- SELECT — any campaign member (including GM) on the NPC's campaign
-- can read relationships. Players need this to see which NPCs are
-- revealed to them and to surface the First Impression CMod in the
-- Recruitment modal.
DROP POLICY IF EXISTS npc_relationships_select ON public.npc_relationships;
CREATE POLICY npc_relationships_select ON public.npc_relationships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_npcs n
      JOIN public.campaigns c ON c.id = n.campaign_id
      WHERE n.id = npc_relationships.npc_id
        AND (
          c.gm_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid())
        )
    )
  );

-- INSERT / UPDATE / DELETE — GM-only. First Impression, reveal
-- toggles, Recruitment relationship updates all flow through the GM's
-- authority. Player-driven First Impression rolls currently write via
-- the GM's channel in the roll handlers; that stays unchanged.
DROP POLICY IF EXISTS npc_relationships_insert ON public.npc_relationships;
CREATE POLICY npc_relationships_insert ON public.npc_relationships FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaign_npcs n
      JOIN public.campaigns c ON c.id = n.campaign_id
      WHERE n.id = npc_relationships.npc_id AND c.gm_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS npc_relationships_update ON public.npc_relationships;
CREATE POLICY npc_relationships_update ON public.npc_relationships FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_npcs n
      JOIN public.campaigns c ON c.id = n.campaign_id
      WHERE n.id = npc_relationships.npc_id AND c.gm_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS npc_relationships_delete ON public.npc_relationships;
CREATE POLICY npc_relationships_delete ON public.npc_relationships FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_npcs n
      JOIN public.campaigns c ON c.id = n.campaign_id
      WHERE n.id = npc_relationships.npc_id AND c.gm_user_id = auth.uid()
    )
  );

-- ============================================================
-- Diagnostic — run by hand to confirm policies are live.
-- ============================================================
-- SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr
-- FROM pg_policy WHERE polrelid = 'public.npc_relationships'::regclass
-- ORDER BY polcmd, polname;
