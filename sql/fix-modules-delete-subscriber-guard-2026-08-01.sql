-- Fix: archiveModule()'s "≥1 active subscriber -> archive only, never
-- hard-delete" rule is enforced ONLY client-side (lib/modules.ts checks
-- subscriberCount === 0 before calling .delete()). The modules_delete RLS
-- policy only checks author_user_id = auth.uid() OR is_thriver(), with no
-- subscriber-count condition, and no DB trigger backstops it. An author
-- could bypass the app UI entirely (raw client call, or a future code
-- path that forgets the check) and hard-delete a module with active
-- subscribers - cascades DELETE to module_versions + module_subscriptions
-- via FK, permanently losing every subscribing campaign's version/
-- changelog history, with the module_archived notification path (which
-- only exists in archiveModule()) never firing.
--
-- Fix: BEFORE DELETE trigger, mirroring archiveModule()'s own live-count
-- check (COUNT module_subscriptions WHERE status='active', not the
-- cached modules.subscriber_count column) - blocks the delete for
-- non-Thrivers when any active subscription exists. Thrivers keep the
-- unrestricted delete (existing moderation-cleanup precedent elsewhere
-- in this schema).

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_module_delete_no_active_subscribers()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF public.is_thriver() THEN
    RETURN OLD;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.module_subscriptions
    WHERE module_id = OLD.id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Cannot delete a module with active subscribers - archive it instead';
  END IF;

  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_module_delete_no_active_subscribers ON public.modules;
CREATE TRIGGER trg_enforce_module_delete_no_active_subscribers
  BEFORE DELETE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.enforce_module_delete_no_active_subscribers();

COMMIT;
