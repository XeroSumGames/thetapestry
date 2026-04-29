-- ============================================================
-- Re-sync scene_tokens.color to match each NPC's current
-- disposition. One-shot backfill.
-- ============================================================
--
-- Symptom: an NPC is shown as Neutral (yellow) on the roster + popout
-- but the ring on the tactical-map token is still Red (or Green) —
-- because the token's color was baked in at placement time and the
-- subsequent disposition change in the roster only updated
-- campaign_npcs.disposition, not the existing scene_tokens.color.
--
-- Code-side fix lands in components/NpcRoster.tsx (quickSetDisposition
-- + the full Edit modal save) — both now mirror the new disposition /
-- npc_type onto every existing scene_tokens row for that NPC.
--
-- This script is the one-shot backfill for tokens placed BEFORE that
-- code fix shipped. It rewrites scene_tokens.color from the canonical
-- DISPOSITION_COLORS palette in lib (mirrored here as plain hex
-- literals), with the same npc_type fallback the TS code uses when
-- disposition is null.
--
-- Hex palette (must match components/NpcRoster.tsx — DISPOSITION_COLORS
-- and TOKEN_BORDER_OVERRIDES). If those constants change in TS, this
-- file needs to follow. The TS render layer also calls
-- vividTokenBorder() to brighten older muted hex values at draw time,
-- so this UPDATE writes the post-vivid values directly:
--
--   friendly  → #4ade80 (vivid green)
--   neutral   → #facc15 (vivid yellow)
--   hostile   → #ef4444 (vivid red)
--
-- Idempotent — safe to re-run.

UPDATE public.scene_tokens t
   SET color = CASE
     WHEN n.disposition = 'friendly' THEN '#4ade80'
     WHEN n.disposition = 'neutral'  THEN '#facc15'
     WHEN n.disposition = 'hostile'  THEN '#ef4444'
     -- disposition unset → infer from npc_type (matches getNpcRingColor)
     WHEN lower(n.npc_type) IN ('bystander', 'friendly')             THEN '#4ade80'
     WHEN lower(n.npc_type) IN ('foe', 'goon', 'antagonist')          THEN '#ef4444'
     ELSE '#facc15' -- default to neutral
   END
  FROM public.campaign_npcs n
 WHERE t.npc_id = n.id;

-- ── Diagnostic — see how many rows changed for each disposition.
-- SELECT n.disposition, COUNT(*) AS tokens
--   FROM public.scene_tokens t
--   JOIN public.campaign_npcs n ON n.id = t.npc_id
--  GROUP BY n.disposition
--  ORDER BY n.disposition NULLS FIRST;
