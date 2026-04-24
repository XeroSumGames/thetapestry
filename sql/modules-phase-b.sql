-- Phase 5 Sprint 3 — Module versioning + subscriber update notifications.
--
-- Two pieces:
--
--   1. edited_since_clone tracking. Cloned content rows get a
--      boolean flag that's false at clone time, flipped to true on
--      any user edit. Phase 5 update-review UI uses this to skip
--      overwriting customized assets when a module version ships.
--
--   2. notify_module_version_published trigger. Fires AFTER INSERT
--      on module_versions and pings every active subscriber of
--      that module's parent row. Body carries version + changelog
--      so the bell can render "📦 Module updated" with a Review
--      button.
--
-- Idempotent — safe to re-run.

-- ── notifications.metadata (defensive) ─────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- ── edited_since_clone columns on cloned content ───────────────
-- Default false so freshly-cloned rows start clean. The client
-- flips the flag to true on any user edit (see lib/modules-edit-
-- tracking hook in a follow-up commit — for MVP we can also add
-- update triggers to auto-flip, but explicit client writes are
-- simpler + let the client skip the flag-flip on programmatic
-- updates like rebalance-roles that aren't "the user customized
-- this").

ALTER TABLE public.campaign_npcs
  ADD COLUMN IF NOT EXISTS edited_since_clone boolean NOT NULL DEFAULT false;
ALTER TABLE public.campaign_pins
  ADD COLUMN IF NOT EXISTS edited_since_clone boolean NOT NULL DEFAULT false;
ALTER TABLE public.tactical_scenes
  ADD COLUMN IF NOT EXISTS edited_since_clone boolean NOT NULL DEFAULT false;
ALTER TABLE public.scene_tokens
  ADD COLUMN IF NOT EXISTS edited_since_clone boolean NOT NULL DEFAULT false;
ALTER TABLE public.campaign_notes
  ADD COLUMN IF NOT EXISTS edited_since_clone boolean NOT NULL DEFAULT false;

-- Indexes — Phase 5 review UI will query "give me all edited vs.
-- all pristine clones for this source module_version" a lot.
CREATE INDEX IF NOT EXISTS idx_campaign_npcs_edited_clone
  ON public.campaign_npcs(source_module_version_id, edited_since_clone)
  WHERE source_module_version_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_pins_edited_clone
  ON public.campaign_pins(source_module_version_id, edited_since_clone)
  WHERE source_module_version_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tactical_scenes_edited_clone
  ON public.tactical_scenes(source_module_version_id, edited_since_clone)
  WHERE source_module_version_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scene_tokens_edited_clone
  ON public.scene_tokens(source_module_version_id, edited_since_clone)
  WHERE source_module_version_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_notes_edited_clone
  ON public.campaign_notes(source_module_version_id, edited_since_clone)
  WHERE source_module_version_id IS NOT NULL;

-- ── notify_module_version_published ────────────────────────────
-- After an author inserts a new module_versions row, fan out a
-- notification to every active subscriber of that module's parent
-- (module_subscriptions where status='active'). Forked /
-- unsubscribed campaigns are skipped by design — they've opted
-- out of upstream updates.
CREATE OR REPLACE FUNCTION public.notify_module_version_published()
RETURNS trigger AS $$
DECLARE
  v_module_name text;
  v_module_author_id uuid;
BEGIN
  SELECT name, author_user_id
    INTO v_module_name, v_module_author_id
  FROM public.modules WHERE id = NEW.module_id;

  -- One notification per subscribing campaign's GM. Skip
  -- subscriptions that are already on this version (shouldn't
  -- happen on INSERT, but defensive) and skip the author's own
  -- campaigns (they obviously know what they just published).
  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  SELECT
    c.gm_user_id,
    'module_version_published',
    '📦 Module updated',
    'A new version of "' || COALESCE(v_module_name, 'Unknown module')
      || '" (v' || NEW.version || ') is available'
      || CASE WHEN NEW.changelog IS NOT NULL AND length(NEW.changelog) > 0
              THEN ': ' || NEW.changelog ELSE '' END,
    '/stories/' || c.id::text || '/modules/' || NEW.module_id::text || '/versions',
    jsonb_build_object(
      'module_id', NEW.module_id,
      'module_name', v_module_name,
      'version_id', NEW.id,
      'version', NEW.version,
      'version_major', NEW.version_major,
      'version_minor', NEW.version_minor,
      'version_patch', NEW.version_patch,
      'changelog', NEW.changelog,
      'subscribing_campaign_id', c.id,
      'subscribing_campaign_name', c.name
    )
  FROM public.module_subscriptions ms
  JOIN public.campaigns c ON c.id = ms.campaign_id
  WHERE ms.module_id = NEW.module_id
    AND ms.status = 'active'
    AND ms.current_version_id IS DISTINCT FROM NEW.id
    AND c.gm_user_id IS DISTINCT FROM v_module_author_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_module_version_published_notify
  ON public.module_versions;
CREATE TRIGGER trg_module_version_published_notify
  AFTER INSERT ON public.module_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_module_version_published();
