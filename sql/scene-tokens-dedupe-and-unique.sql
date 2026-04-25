-- scene-tokens-dedupe-and-unique.sql
-- Earlier rounds of the MAP / UNMAP / SHOW / HIDE iteration left
-- duplicate scene_tokens rows for the same NPC in the same scene —
-- some at the dragged position, some at (0,0) from re-placement.
-- The current SHOW logic walks the rows and un-archives any archived
-- one, but doesn't deduplicate against stale live rows. Result: the
-- (0,0) duplicate keeps reappearing at top-left after every SHOW.
--
-- This migration:
--   1. Deduplicates: keeps ONE row per (scene_id, npc_id) — preferring
--      a non-(0,0) position over (0,0), then the most-recently-touched
--      row (latest archived_at, falling back to highest id).
--   2. Adds a partial UNIQUE index on (scene_id, npc_id) WHERE npc_id
--      IS NOT NULL so future inserts can never recreate the duplicate
--      problem. Object tokens (npc_id IS NULL) are unaffected.
--
-- Idempotent. Re-running with no duplicates is a no-op; the unique
-- index uses IF NOT EXISTS.

-- 1. Dedupe.
DELETE FROM public.scene_tokens t
 WHERE t.id IN (
   SELECT id FROM (
     SELECT
       id,
       ROW_NUMBER() OVER (
         PARTITION BY scene_id, npc_id
         ORDER BY
           -- Prefer rows NOT parked at the top-left default cluster.
           CASE WHEN grid_x = 0 AND grid_y = 0 THEN 1 ELSE 0 END,
           -- Then most-recently-archived (or current if never archived).
           COALESCE(archived_at, NOW()) DESC,
           -- Final tiebreak: most recently-created (uuid is monotonic
           -- for v1, but `id DESC` works for v4 too as a stable ordering).
           id DESC
       ) AS rn
     FROM public.scene_tokens
     WHERE npc_id IS NOT NULL
   ) ranked
   WHERE rn > 1
 );

-- 2. UNIQUE constraint going forward.
CREATE UNIQUE INDEX IF NOT EXISTS scene_tokens_unique_npc_per_scene
  ON public.scene_tokens (scene_id, npc_id)
  WHERE npc_id IS NOT NULL;
