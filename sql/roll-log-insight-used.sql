-- ============================================================
-- roll_log.insight_used — track Insight Die spend per roll
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================
-- Closes the detection gap from the partial 2026-04-27 callout in
-- the extended log card. Previously we inferred "an Insight Die
-- was spent on this roll" from `die2 > 6` (the 3d6 path packs d2+d3
-- into die2). That heuristic catches ~83% of 3d6 spends but misses
-- the 17% where d2+d3 ≤ 6, AND can't distinguish a +3 CMod spend
-- from organic CMod stacks at all.
--
-- Schema:
--   NULL      — no Insight Die spent on this roll
--   '3d6'     — pre-rolled 3d6 keep-all path
--   '+3cmod'  — +3 flat CMod path
--
-- Read by the extended-log card to render the green "🎲 Insight Die
-- spent" badge with the correct flavor text. Older rows stay NULL
-- — the existing die2 > 6 fallback in the card catches them when
-- the column is absent or NULL on a 3d6 roll.

ALTER TABLE public.roll_log
  ADD COLUMN IF NOT EXISTS insight_used text
  CHECK (insight_used IS NULL OR insight_used IN ('3d6', '+3cmod'));
