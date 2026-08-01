-- Fix: world_communities_update RLS (USING, no separate WITH CHECK - so
-- USING is reused as WITH CHECK) only checks that the caller is a Thriver,
-- the row's publisher, the source campaign's GM, or the source community's
-- leader. It never restricts which columns an UPDATE can change. No trigger
-- re-asserts moderation state on UPDATE either - the only moderation
-- triggers that exist (trg_world_community_moderation_notify etc.) are
-- AFTER UPDATE notifiers, not BEFORE UPDATE gates.
--
-- Any GM/leader who published a world_communities row already passes the
-- UPDATE policy's ownership check on their own row - they could call the
-- same code path app/moderate/page.tsx uses (or the raw Supabase client)
-- to set moderation_status='approved', approved_by=<own uid>,
-- approved_at=now() on their own pending/rejected submission, publishing
-- their community to the public/shared world map without ever passing
-- real Thriver review.
--
-- Fix: a BEFORE UPDATE trigger, mirroring the map_pins moderation-clamp
-- pattern applied earlier tonight - non-Thrivers can only touch narrative/
-- cosmetic fields; moderation_status/approved_by/approved_at are pinned to
-- their prior values unless the caller is a Thriver.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_world_community_moderation_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF public.is_thriver() THEN
    RETURN NEW;
  END IF;

  -- Non-Thrivers (including the publisher, source-campaign GM, and
  -- source-community leader - all pass the ownership-only RLS check) can
  -- never move a submission through moderation themselves.
  NEW.moderation_status := OLD.moderation_status;
  NEW.approved_by := OLD.approved_by;
  NEW.approved_at := OLD.approved_at;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_world_community_moderation_clamp ON public.world_communities;
CREATE TRIGGER trg_world_community_moderation_clamp
  BEFORE UPDATE ON public.world_communities
  FOR EACH ROW EXECUTE FUNCTION public.enforce_world_community_moderation_on_update();

COMMIT;
