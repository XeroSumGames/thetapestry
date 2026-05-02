-- npc-relationship-cmod-rpc.sql
-- Atomic delta-with-clamp on npc_relationships.relationship_cmod.
--
-- Replaces two select-then-insert/update patterns in
-- app/stories/[id]/table/page.tsx (First Impression roll handler and
-- the Barter onRelationshipDamage handler) that had:
--   • A constraint-violation race: if no row existed and two callers
--     fired close together, both saw "no row" and both inserted →
--     unique constraint blow-up on (npc_id, character_id).
--   • A value-accuracy race: read existing → compute new → write.
--     Concurrent invocations could each compute against the pre-other-
--     write value, dropping one of the increments.
--   • A behavior bug: First Impression ALSO overwrote relationship_cmod
--     instead of accumulating, so meeting the same NPC twice replaced
--     the first roll's mark instead of stacking.
--
-- This function does the lot in one INSERT … ON CONFLICT DO UPDATE,
-- which Postgres runs atomically per row — the value-accuracy race
-- collapses, and the unique-constraint race collapses with it.
--
-- Clamps to [p_clamp_min, p_clamp_max] (defaults [-3, +3], matching the
-- FIRST_IMPRESSIONS picker range in components/NpcRoster.tsx).
--
-- Reveal handling: when p_set_revealed = true (First Impression),
-- mark the row revealed and seed reveal_level if it isn't already set.
-- When p_set_revealed = false (Barter relationship damage), leave
-- revealed/reveal_level untouched on existing rows; new rows still get
-- revealed=false (the schema default).

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
LANGUAGE sql
AS $$
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
$$;

REVOKE ALL    ON FUNCTION public.bump_npc_relationship_cmod(uuid, uuid, int, int, int, boolean, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.bump_npc_relationship_cmod(uuid, uuid, int, int, int, boolean, text) TO authenticated;
