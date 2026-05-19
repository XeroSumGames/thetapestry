-- npc-relationship-cmod-rpc-security-definer-2026-05-19.sql
-- Post-playtest P0 hotfix: First Impression / Barter relationship damage
-- failed for non-GM players with PG 42501 (RLS on npc_relationships
-- INSERT is GM-only). The RPC ran as the caller and hit the same RLS.
--
-- Fix: switch bump_npc_relationship_cmod to SECURITY DEFINER so it can
-- write to npc_relationships, with EXPLICIT caller authorization
-- inside the function so a player can only bump rows for their OWN
-- character. GM bypass via the campaign's gm_user_id; thriver bypass
-- via public.is_thriver(). Same SET search_path = public, pg_temp
-- hardening pattern as today's moderation-enforce trigger.
--
-- The two callers are both safe under this policy:
--   1. First Impression roll handler (page.tsx:6469) — passes the
--      roller's own character_id. Player-as-owner check passes.
--   2. Barter onRelationshipDamage handler (page.tsx:12094) — passes
--      myEntry.character.id, also the roller's own character. Passes.
--
-- Idempotent: CREATE OR REPLACE FUNCTION + the body is identical to the
-- non-SECURITY-DEFINER version except for the wrapper authorization +
-- the SECURITY DEFINER + SET search_path declarations + LANGUAGE plpgsql
-- (was sql; needs plpgsql so we can RAISE EXCEPTION).
--
-- Apply via:
--   npx supabase db query --linked -f sql/npc-relationship-cmod-rpc-security-definer-2026-05-19.sql

CREATE OR REPLACE FUNCTION public.bump_npc_relationship_cmod(
  p_npc_id        uuid,
  p_character_id  uuid,
  p_delta         int,
  p_clamp_min     int     DEFAULT -3,
  p_clamp_max     int     DEFAULT 3,
  p_set_revealed  boolean DEFAULT false,
  p_reveal_level  text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_authorized boolean;
BEGIN
  -- Caller must be one of:
  --   (a) the character's owner (player rolling their own First
  --       Impression / Barter), or
  --   (b) the GM of the NPC's campaign, or
  --   (c) a thriver (godmode).
  SELECT
    EXISTS (
      SELECT 1 FROM public.characters ch
      WHERE ch.id = p_character_id AND ch.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.campaign_npcs n
      JOIN public.campaigns c ON c.id = n.campaign_id
      WHERE n.id = p_npc_id AND c.gm_user_id = auth.uid()
    )
    OR public.is_thriver()
  INTO v_authorized;

  IF NOT COALESCE(v_authorized, false) THEN
    RAISE EXCEPTION 'Unauthorized: caller % cannot bump relationship for character %', auth.uid(), p_character_id
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.npc_relationships AS r
    (npc_id, character_id, relationship_cmod, revealed, reveal_level)
  VALUES (
    p_npc_id,
    p_character_id,
    GREATEST(p_clamp_min, LEAST(p_clamp_max, p_delta)),
    p_set_revealed,
    CASE WHEN p_set_revealed THEN p_reveal_level ELSE NULL END
  )
  ON CONFLICT (npc_id, character_id) DO UPDATE SET
    relationship_cmod =
      GREATEST(p_clamp_min, LEAST(p_clamp_max, r.relationship_cmod + p_delta)),
    revealed     = r.revealed OR p_set_revealed,
    reveal_level = COALESCE(r.reveal_level,
                            CASE WHEN p_set_revealed THEN p_reveal_level ELSE NULL END),
    updated_at   = now();
END;
$$;

-- Re-grant — the CREATE OR REPLACE preserves grants but be explicit so
-- a fresh DB picks up the right access too.
REVOKE ALL     ON FUNCTION public.bump_npc_relationship_cmod(uuid, uuid, int, int, int, boolean, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.bump_npc_relationship_cmod(uuid, uuid, int, int, int, boolean, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
