-- auto-end-stale-sessions.sql
-- Housekeeping RPC — close out sessions that were started but never
-- explicitly ended. The "Live Now" banner on /stories surfaces every
-- session with started_at IS NOT NULL AND ended_at IS NULL; without
-- this, a GM who closes the tab without clicking End Session leaves
-- a row that shows as "in progress" forever.
--
-- Conservative semantics — sets ONLY ended_at on sessions and flips
-- campaigns.session_status to 'idle'. Does NOT wipe roll_log /
-- chat_messages / initiative_order the way manual endSession does,
-- so a GM resuming a previously-stale campaign still sees their
-- residual state. They can run a proper End Session afterward to
-- get the full wipe + GM summary.
--
-- Default threshold is 48 hours. Caller can pass an override.
-- Returns the count of sessions that were ended.
--
-- Idempotent: re-running just no-ops once everything stale is closed.
--
-- Apply: npx supabase db query --linked -f sql/auto-end-stale-sessions.sql

CREATE OR REPLACE FUNCTION public.auto_end_stale_sessions(stale_hours int DEFAULT 48)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count int;
  stale_campaign_ids uuid[];
BEGIN
  -- 1. Snapshot the campaign_ids whose stale sessions we're about to
  --    end so we can mirror the cleanup into campaigns.session_status.
  SELECT ARRAY_AGG(DISTINCT campaign_id) INTO stale_campaign_ids
  FROM public.sessions
  WHERE ended_at IS NULL
    AND started_at IS NOT NULL
    AND started_at < now() - make_interval(hours => stale_hours);

  IF stale_campaign_ids IS NULL THEN
    RETURN 0;
  END IF;

  -- 2. End the stale sessions. Same WHERE clause as the snapshot
  --    above so we don't race with sessions that just transitioned.
  UPDATE public.sessions
  SET ended_at = now()
  WHERE ended_at IS NULL
    AND started_at IS NOT NULL
    AND started_at < now() - make_interval(hours => stale_hours);
  GET DIAGNOSTICS affected_count = ROW_COUNT;

  -- 3. Mirror the close into campaigns.session_status so the GM-side
  --    table-page UI doesn't think a session is still active.
  --    Conservative: only touch rows currently flagged 'active'; if
  --    something already flipped to 'idle' independently, leave it.
  UPDATE public.campaigns
  SET session_status = 'idle',
      session_started_at = NULL
  WHERE id = ANY(stale_campaign_ids)
    AND session_status = 'active';

  RETURN affected_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_end_stale_sessions(int) TO authenticated;

NOTIFY pgrst, 'reload schema';
