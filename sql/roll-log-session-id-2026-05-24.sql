-- Y11-e RLA1: tag roll_log rows with their session, so session start stops
-- WIPING the feed (decisions.md 2026-05-20: never lose roll data). Additive +
-- backward-compatible - existing rows keep session_id = NULL ("pre-session-
-- tracking"), the live feed will filter by the current session (RLA3), and
-- prior sessions become browsable read-only (RLA4).
--
-- ON DELETE SET NULL: deleting a session orphans its rolls (session_id -> NULL)
-- rather than cascading them away - aligns with "never lose roll data".
--
-- Apply: npx supabase db query --linked -f sql/roll-log-session-id-2026-05-24.sql

ALTER TABLE public.roll_log
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL;

-- Live feed query is "this session, newest first."
CREATE INDEX IF NOT EXISTS idx_roll_log_session_created
  ON public.roll_log (session_id, created_at DESC);

-- (idx_roll_log_campaign_created already exists for the cross-session browse.)
