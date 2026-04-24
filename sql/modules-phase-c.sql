-- Phase 5 Sprint 3b — edit-tracking triggers on cloned content.
--
-- The Review modal's key decision is "did the user edit this row
-- locally?" If yes, the default should be SKIP on update (don't
-- stomp their customization). If no, default is ACCEPT. This
-- trigger flips the `edited_since_clone` flag to true on any user
-- edit of a cloned row.
--
-- The Apply path (Review modal → accept selected changes) writes
-- a NEW source_module_version_id onto the cloned rows as it goes.
-- The trigger detects that (NEW.source_module_version_id IS
-- DISTINCT FROM OLD.source_module_version_id) and skips the flip
-- so re-homing to a newer version doesn't itself mark the row as
-- edited.
--
-- Rows that aren't from a module clone (source_module_version_id
-- IS NULL) are ignored — no tracking needed on custom content.
--
-- Fires BEFORE UPDATE on each of the five cloned content tables.
-- Idempotent — safe to re-run.

CREATE OR REPLACE FUNCTION public.flip_edited_since_clone()
RETURNS trigger AS $$
BEGIN
  -- Not a clone? Nothing to track.
  IF NEW.source_module_version_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Re-homing to a new module version (Apply path)? Let it pass
  -- without flipping. The Apply path writes the new
  -- source_module_version_id explicitly; any other update keeps
  -- the field stable.
  IF NEW.source_module_version_id IS DISTINCT FROM OLD.source_module_version_id THEN
    RETURN NEW;
  END IF;
  -- User edit — flip the flag. Preserves any explicit value the
  -- caller passed (so if the client sends edited_since_clone =
  -- false on purpose to mark a row as fresh, it still wins; we
  -- only flip from false → true on a real edit).
  IF NEW.edited_since_clone = false THEN
    NEW.edited_since_clone := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_campaign_npcs_flip_edited ON public.campaign_npcs;
CREATE TRIGGER trg_campaign_npcs_flip_edited
  BEFORE UPDATE ON public.campaign_npcs
  FOR EACH ROW EXECUTE FUNCTION public.flip_edited_since_clone();

DROP TRIGGER IF EXISTS trg_campaign_pins_flip_edited ON public.campaign_pins;
CREATE TRIGGER trg_campaign_pins_flip_edited
  BEFORE UPDATE ON public.campaign_pins
  FOR EACH ROW EXECUTE FUNCTION public.flip_edited_since_clone();

DROP TRIGGER IF EXISTS trg_tactical_scenes_flip_edited ON public.tactical_scenes;
CREATE TRIGGER trg_tactical_scenes_flip_edited
  BEFORE UPDATE ON public.tactical_scenes
  FOR EACH ROW EXECUTE FUNCTION public.flip_edited_since_clone();

DROP TRIGGER IF EXISTS trg_scene_tokens_flip_edited ON public.scene_tokens;
CREATE TRIGGER trg_scene_tokens_flip_edited
  BEFORE UPDATE ON public.scene_tokens
  FOR EACH ROW EXECUTE FUNCTION public.flip_edited_since_clone();

DROP TRIGGER IF EXISTS trg_campaign_notes_flip_edited ON public.campaign_notes;
CREATE TRIGGER trg_campaign_notes_flip_edited
  BEFORE UPDATE ON public.campaign_notes
  FOR EACH ROW EXECUTE FUNCTION public.flip_edited_since_clone();
