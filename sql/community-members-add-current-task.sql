-- Phase D — Apprentice task delegation. Adds `current_task` as a
-- freeform text column on community_members so the GM (or eventually
-- the master PC) can direct an Apprentice to an off-screen task:
-- "Scout the warehouse", "Deliver the message to Maren", etc.
-- Also available on Assigned NPCs later (same shape — the column
-- exists independent of recruitment_type / role so future work
-- can reuse it without another migration).
-- Idempotent: IF NOT EXISTS guards the column add.

ALTER TABLE public.community_members
  ADD COLUMN IF NOT EXISTS current_task text;
