-- Y11-e RLA-S: capture the session's roll log onto the session record. At end-
-- session we build a readable text digest of that session's rolls and store it
-- here, alongside gm_summary, so a past session's summary contains its log (and
-- survives the roll_log wipe). Additive + nullable; written only by endSession.
--
-- Apply: npx supabase db query --linked -f sql/sessions-session-log-2026-05-24.sql

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS session_log text;
