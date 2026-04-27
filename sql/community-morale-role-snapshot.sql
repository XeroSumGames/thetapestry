-- ============================================================
-- community_morale_checks: add role_snapshot jsonb column
-- ============================================================
--
-- Phase D GM dashboard wants role-coverage-over-time. Each Morale
-- Check now snapshots the role distribution at roll-time so the
-- chart can plot gatherer / maintainer / safety / unassigned counts
-- per week without retroactive guesswork.
--
-- Shape: { gatherer: int, maintainer: int, safety: int, unassigned: int }
--
-- Idempotent: ADD COLUMN IF NOT EXISTS. Existing rows get NULL until
-- a future check writes; the dashboard treats NULL as "no data" and
-- skips the data point.

ALTER TABLE public.community_morale_checks
  ADD COLUMN IF NOT EXISTS role_snapshot jsonb;
