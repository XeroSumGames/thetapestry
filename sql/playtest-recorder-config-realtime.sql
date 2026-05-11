-- ============================================================
-- Add playtest_recorder_config to the supabase_realtime publication
-- so PlaytestRecorder can subscribe to UPDATEs and propagate /record
-- toggles to every open tab without a page reload.
--
-- Why: the original config table (sql/playtest-recorder-config.sql)
-- was only readable on mount. For a 3-hour playtest the workflow is:
-- GM toggles ON at session start → every open tab needs to pick that
-- up immediately, not "next page load." Realtime is the cheap path.
--
-- Idempotent. Safe to run multiple times. Mirrors the pattern in
-- sql/campaign-npcs-realtime-publication.sql and
-- sql/messages-realtime-publication.sql.
--
-- Run via:
--   npx supabase db query --linked -f sql/playtest-recorder-config-realtime.sql
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'playtest_recorder_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.playtest_recorder_config;
  END IF;
END $$;

-- Sanity check — this should now return one row.
-- SELECT * FROM pg_publication_tables WHERE tablename = 'playtest_recorder_config';
