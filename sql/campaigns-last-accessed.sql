-- campaigns-last-accessed.sql
-- Tracks the most recent time anyone opened a campaign's table page,
-- so the My Stories list can sort by "what I last touched" instead of
-- the GM-only "session.started_at" fallback (which never fires for a
-- campaign you've prepped but haven't formally Started yet).
--
-- The table page bumps this field on mount; nothing else writes to it.
-- Display column on the My Stories list shows "Last Run: <date>" when
-- this is set; falls back to created_at otherwise.
--
-- Idempotent.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz;
