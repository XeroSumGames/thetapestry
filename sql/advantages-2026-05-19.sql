-- advantages-2026-05-19.sql
-- New table: tracked contextual CMod bonuses (a.k.a. "advantages").
-- Post-playtest task #11 (Mark 02:28:30). Use case from Xero:
--   "Enya searched a warehouse for explosives-related stuff, rolled
--    Scavenging success, so I said she gets +1 CMod on her next
--    Demolitions attempt."
-- This table is the persistent home for those credits until the
-- player redeems them.
--
-- Design choices (Xero 2026-05-19):
--   A3 = both free-form GM-dialog grant + per-roll-feed Award button
--   B2 = manual claim by player (they bump CMod themselves; system
--        flips consumed_at when they click Use)
--   C3 = pending = holder + GM only; consumed = whole campaign
--
-- Idempotent. Apply via:
--   npx supabase db query --linked -f sql/advantages-2026-05-19.sql

CREATE TABLE IF NOT EXISTS public.advantages (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id            uuid NOT NULL REFERENCES public.campaigns(id)  ON DELETE CASCADE,
  character_id           uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  granted_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  skill_name             text NOT NULL,
  cmod_delta             integer NOT NULL DEFAULT 1,
  description            text NOT NULL,
  source_roll_log_id     uuid REFERENCES public.roll_log(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  consumed_at            timestamptz,
  consumed_roll_log_id   uuid REFERENCES public.roll_log(id) ON DELETE SET NULL
);

-- Partial index: the dominant query is "show me pending advantages for
-- character X." Indexing the consumed=null subset keeps it tight.
CREATE INDEX IF NOT EXISTS idx_advantages_character_pending
  ON public.advantages (character_id, created_at DESC)
  WHERE consumed_at IS NULL;

-- Full-campaign index for the consumed-in-feed query (Phase 5 follow-up).
CREATE INDEX IF NOT EXISTS idx_advantages_campaign_created
  ON public.advantages (campaign_id, created_at DESC);

ALTER TABLE public.advantages ENABLE ROW LEVEL SECURITY;

-- ── SELECT (C3 visibility) ───────────────────────────────────────
-- Three OR'd predicates:
--   (a) Consumed -> any campaign member can see (shared narrative)
--   (b) Pending  -> holder (character owner) can see
--   (c) Pending  -> GM of the campaign can see
DROP POLICY IF EXISTS advantages_select ON public.advantages;
CREATE POLICY advantages_select ON public.advantages
  FOR SELECT
  USING (
    (consumed_at IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.campaign_members cm
      WHERE cm.campaign_id = advantages.campaign_id AND cm.user_id = auth.uid()
    ))
    OR EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = advantages.character_id AND c.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = advantages.campaign_id AND c.gm_user_id = auth.uid()
    )
  );

-- ── INSERT: GM only ──────────────────────────────────────────────
DROP POLICY IF EXISTS advantages_insert ON public.advantages;
CREATE POLICY advantages_insert ON public.advantages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = advantages.campaign_id AND c.gm_user_id = auth.uid()
    )
  );

-- ── UPDATE: holder (to consume their own) OR GM (to edit/correct) ─
DROP POLICY IF EXISTS advantages_update ON public.advantages;
CREATE POLICY advantages_update ON public.advantages
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.characters c
            WHERE c.id = advantages.character_id AND c.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.campaigns c
               WHERE c.id = advantages.campaign_id AND c.gm_user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.characters c
            WHERE c.id = advantages.character_id AND c.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.campaigns c
               WHERE c.id = advantages.campaign_id AND c.gm_user_id = auth.uid())
  );

-- ── DELETE: GM only (rare; mistakes) ─────────────────────────────
DROP POLICY IF EXISTS advantages_delete ON public.advantages;
CREATE POLICY advantages_delete ON public.advantages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = advantages.campaign_id AND c.gm_user_id = auth.uid()
    )
  );

-- ── Thriver godmode (matches the pattern in sql/thriver-godmode-policies.sql) ─
DROP POLICY IF EXISTS advantages_thriver_bypass ON public.advantages;
CREATE POLICY advantages_thriver_bypass ON public.advantages
  FOR ALL
  USING (public.is_thriver())
  WITH CHECK (public.is_thriver());

NOTIFY pgrst, 'reload schema';
