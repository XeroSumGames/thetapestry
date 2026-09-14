-- Fix: the same "moderation clamp exists on INSERT but not UPDATE" gap
-- already found and fixed twice tonight on map_pins and world_communities
-- recurs on 5 more tables, found by a wave-3 audit pass on the /moderate
-- admin page and the campfire/forum system independently (converging on
-- the same bug shape from two different angles).
--
-- forum_threads / lfg_posts / war_stories: enforce_moderation_on_insert()
-- correctly gates INSERT, but no equivalent BEFORE UPDATE trigger exists.
-- Their own "_update_own" RLS policies only pin author_user_id in
-- WITH CHECK, never moderation_status/approved_by/approved_at - any
-- author can self-approve their own pending content, undo a Thriver's
-- rejection at will, and (forum_threads specifically) self-set
-- pinned/locked with nothing blocking it.
--
-- world_npcs: has NO moderation clamp at all, INSERT or UPDATE. A
-- non-Thriver can INSERT with status='approved' directly, or flip an
-- existing pending/rejected submission to approved via UPDATE.
--
-- modules: modules_insert's WITH CHECK only pins author_user_id - a
-- non-Thriver can INSERT with visibility='listed', moderation_status=
-- 'approved' directly, skipping the marketplace review queue entirely.
-- modules_update has the same gap on UPDATE. Unlike the other 4 tables,
-- modules has real scope-based auto-approval logic in the app itself
-- (lib/modules.ts: moderation_status = visibility==='listed' ? 'pending'
-- : 'approved') that a blind "clamp everything to OLD" trigger would
-- break (flipping a private/auto-approved module to visibility='listed'
-- needs to ALSO flip moderation_status back to 'pending' - clamping to
-- OLD would let it go live as listed+approved without ever entering
-- review). The modules trigger recomputes from visibility instead of a
-- blanket clamp, mirroring the app's own intended rule server-side.

BEGIN;

-- 1. Shared UPDATE clamp for forum_threads / lfg_posts / war_stories -
-- same table shape (moderation_status/approved_by/approved_at), same fix.
CREATE OR REPLACE FUNCTION public.enforce_moderation_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_is_thriver boolean;
BEGIN
  SELECT lower(role) = 'thriver' INTO v_is_thriver
    FROM public.profiles WHERE id = auth.uid();

  IF COALESCE(v_is_thriver, false) THEN
    RETURN NEW;
  END IF;

  NEW.moderation_status := OLD.moderation_status;
  NEW.approved_by := OLD.approved_by;
  NEW.approved_at := OLD.approved_at;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_mod_forum_threads_update ON public.forum_threads;
CREATE TRIGGER trg_enforce_mod_forum_threads_update
  BEFORE UPDATE ON public.forum_threads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_moderation_on_update();

DROP TRIGGER IF EXISTS trg_enforce_mod_lfg_posts_update ON public.lfg_posts;
CREATE TRIGGER trg_enforce_mod_lfg_posts_update
  BEFORE UPDATE ON public.lfg_posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_moderation_on_update();

DROP TRIGGER IF EXISTS trg_enforce_mod_war_stories_update ON public.war_stories;
CREATE TRIGGER trg_enforce_mod_war_stories_update
  BEFORE UPDATE ON public.war_stories
  FOR EACH ROW EXECUTE FUNCTION public.enforce_moderation_on_update();

-- 2. forum_threads only: pinned/locked are also self-settable today via
-- the same unrestricted _update_own WITH CHECK. No legitimate non-Thriver
-- use case for a thread author to pin or lock their own thread.
CREATE OR REPLACE FUNCTION public.enforce_forum_thread_flags_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_is_thriver boolean;
BEGIN
  SELECT lower(role) = 'thriver' INTO v_is_thriver
    FROM public.profiles WHERE id = auth.uid();

  IF COALESCE(v_is_thriver, false) THEN
    RETURN NEW;
  END IF;

  NEW.pinned := OLD.pinned;
  NEW.locked := OLD.locked;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_forum_thread_flags ON public.forum_threads;
CREATE TRIGGER trg_enforce_forum_thread_flags
  BEFORE UPDATE ON public.forum_threads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_forum_thread_flags_on_update();

-- 3. world_npcs: no existing clamp at all - add both INSERT and UPDATE.
CREATE OR REPLACE FUNCTION public.enforce_world_npc_moderation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_is_thriver boolean;
BEGIN
  SELECT lower(role) = 'thriver' INTO v_is_thriver
    FROM public.profiles WHERE id = auth.uid();

  IF COALESCE(v_is_thriver, false) THEN
    IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
      NEW.approved_by := auth.uid();
      NEW.approved_at := COALESCE(NEW.approved_at, now());
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  ELSE
    NEW.status := OLD.status;
    NEW.approved_by := OLD.approved_by;
    NEW.approved_at := OLD.approved_at;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_world_npc_moderation_insert ON public.world_npcs;
CREATE TRIGGER trg_enforce_world_npc_moderation_insert
  BEFORE INSERT ON public.world_npcs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_world_npc_moderation();

DROP TRIGGER IF EXISTS trg_enforce_world_npc_moderation_update ON public.world_npcs;
CREATE TRIGGER trg_enforce_world_npc_moderation_update
  BEFORE UPDATE ON public.world_npcs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_world_npc_moderation();

-- 4. modules: recompute from visibility (not a blanket clamp) so the
-- app's own "flip to listed re-enters review" rule still works, while a
-- non-Thriver can never land moderation_status='approved' while
-- visibility='listed' without a real Thriver approval.
CREATE OR REPLACE FUNCTION public.enforce_module_moderation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_is_thriver boolean;
BEGIN
  SELECT lower(role) = 'thriver' INTO v_is_thriver
    FROM public.profiles WHERE id = auth.uid();

  IF COALESCE(v_is_thriver, false) THEN
    IF NEW.moderation_status = 'approved' THEN
      NEW.approved_by := auth.uid();
      NEW.approved_at := COALESCE(NEW.approved_at, now());
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.visibility = 'listed' THEN
    NEW.moderation_status := 'pending';
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  ELSE
    NEW.moderation_status := 'approved';
    NEW.approved_by := NULL; -- system-approved by narrow-visibility rule
    NEW.approved_at := now();
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_module_moderation_insert ON public.modules;
CREATE TRIGGER trg_enforce_module_moderation_insert
  BEFORE INSERT ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.enforce_module_moderation();

DROP TRIGGER IF EXISTS trg_enforce_module_moderation_update ON public.modules;
CREATE TRIGGER trg_enforce_module_moderation_update
  BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.enforce_module_moderation();

COMMIT;
