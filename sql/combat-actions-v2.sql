-- ============================================================
-- Combat Actions v2 — SRD-compliant action mechanics
-- Adds columns to initiative_order for tracking defensive
-- modifiers, cover state, winded, and last attack target.
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================

-- Defend / Take Cover: +2 defensive modifier
ALTER TABLE public.initiative_order
  ADD COLUMN IF NOT EXISTS defense_bonus integer NOT NULL DEFAULT 0;

-- Take Cover flag (defense_bonus lasts all round, vs Defend which is next attack only)
ALTER TABLE public.initiative_order
  ADD COLUMN IF NOT EXISTS has_cover boolean NOT NULL DEFAULT false;

-- Sprint failure: lose 1 action next round
ALTER TABLE public.initiative_order
  ADD COLUMN IF NOT EXISTS winded boolean NOT NULL DEFAULT false;

-- Track last attack target for same-target +1 CMod on second attack
ALTER TABLE public.initiative_order
  ADD COLUMN IF NOT EXISTS last_attack_target text;

-- Track if this combatant has been Inspired this round (once per round limit)
ALTER TABLE public.initiative_order
  ADD COLUMN IF NOT EXISTS inspired_this_round boolean NOT NULL DEFAULT false;

-- Track if Aim was used (next action must be Attack or aim is lost)
ALTER TABLE public.initiative_order
  ADD COLUMN IF NOT EXISTS aim_active boolean NOT NULL DEFAULT false;
