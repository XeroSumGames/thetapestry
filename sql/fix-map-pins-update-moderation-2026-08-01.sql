-- Fix: map_pins moderation clamp (enforce_map_pin_moderation_on_insert) only
-- fired on INSERT. The "Update pins" RLS policy has USING but no separate
-- WITH CHECK (auth.uid() = user_id OR thriver), so Postgres reuses USING as
-- WITH CHECK - it gates only row ownership, never which columns change.
--
-- Any non-Thriver owner of their own pin could therefore UPDATE it directly
-- to: category='world_event', cmod_active=true, cmod_impact=<any int>,
-- cmod_radius_km=<any int>, status='approved'. lib/world-events.ts queries
-- map_pins filtered only by category/cmod_active/cmod_impact (no status
-- filter) to compute the Weekly Morale CMod for every community within
-- range - once status='approved' makes the row pass the "View pins" SELECT
-- policy for other users too, this is a fabricated global gameplay effect
-- reachable by any authenticated user, not just a self-buff.
--
-- Also closing a narrower variant of the same gap on INSERT: the insert
-- trigger only ever clamped pin_type/status, never category/cmod_*, so a
-- non-Thriver could already create a private/active pin with
-- category='world_event' + cmod_active=true - not visible to other users
-- (RLS SELECT gates on status='approved' OR own row), but a working
-- self-buff regardless, and one UPDATE (now fixed below) away from going
-- public even without this fix. Both insert and update now clamp the same
-- fields for non-Thrivers.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_map_pin_moderation_on_insert()
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

  -- Thrivers are the moderation layer: respect their pin_type/status/category/cmod.
  IF COALESCE(v_is_thriver, false) THEN
    RETURN NEW;
  END IF;

  -- Non-Thrivers can never author Timeline/World-Event pins or their CMod effects.
  IF NEW.category = 'world_event' THEN
    NEW.category := 'location';
  END IF;
  NEW.cmod_active := false;
  NEW.cmod_impact := NULL;
  NEW.cmod_radius_km := NULL;
  NEW.cmod_label := NULL;

  -- Non-Thrivers can never publish (gm) or self-approve.
  IF NEW.pin_type = 'private' THEN
    -- Genuine private pin: owner-only via SELECT. Block the private+approved
    -- leak by clamping status to 'active'; leave the rest as-is.
    NEW.status := 'active';
  ELSE
    -- Any shared/world pin attempt -> the moderation queue.
    NEW.pin_type := 'rumor';
    NEW.status := 'pending';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_map_pin_moderation_on_update()
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

  -- Non-Thrivers cannot self-approve, escape moderation, or author/modify
  -- Timeline World-Event CMod effects after creation - pin ownership alone
  -- (the only thing RLS checks on UPDATE) is not enough authority for any
  -- of this.
  NEW.status := OLD.status;
  NEW.pin_type := OLD.pin_type;
  IF NEW.category = 'world_event' THEN
    NEW.category := OLD.category;
  END IF;
  NEW.cmod_active := OLD.cmod_active;
  NEW.cmod_impact := OLD.cmod_impact;
  NEW.cmod_radius_km := OLD.cmod_radius_km;
  NEW.cmod_label := OLD.cmod_label;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_map_pin_moderation_update ON public.map_pins;
CREATE TRIGGER trg_enforce_map_pin_moderation_update
  BEFORE UPDATE ON public.map_pins
  FOR EACH ROW EXECUTE FUNCTION public.enforce_map_pin_moderation_on_update();

COMMIT;
