-- ============================================================
-- Player notes: tag each note with the session_number it was
-- written in, so End Session only pulls notes from the session
-- that is actually ending (not every historical submission).
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================

ALTER TABLE public.player_notes
  ADD COLUMN IF NOT EXISTS session_number int;

CREATE INDEX IF NOT EXISTS player_notes_session_idx
  ON public.player_notes(campaign_id, session_number)
  WHERE submitted_to_summary = true;

-- BEFORE INSERT trigger: stamp session_number from the campaign's
-- current session_count, but only while a session is actually active.
-- Notes written between sessions get NULL and are never auto-appended.
CREATE OR REPLACE FUNCTION public.player_notes_set_session_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.session_number IS NULL THEN
    SELECT CASE WHEN c.session_status = 'active' THEN c.session_count ELSE NULL END
    INTO NEW.session_number
    FROM public.campaigns c
    WHERE c.id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS player_notes_stamp_session ON public.player_notes;
CREATE TRIGGER player_notes_stamp_session
  BEFORE INSERT ON public.player_notes
  FOR EACH ROW EXECUTE FUNCTION public.player_notes_set_session_number();
