-- Fix: cloneModuleIntoCampaign (lib/modules.ts step 5.5) inserts cloned
-- pregens with author_id: null, moderation_status: 'approved' - this is
-- the correct, intentional shape for a module-sourced "official" pregen
-- (loadOfficialPregens() specifically queries author_id IS NULL AND
-- moderation_status='approved'), but pregen_library_insert's RLS WITH
-- CHECK unconditionally requires author_id = auth.uid(). A null author_id
-- can never satisfy that for any caller, so this insert deterministically
-- fails for every module clone whose snapshot contains pregens - the
-- target campaign ends up with pins/NPCs/scenes/handouts already
-- committed (this whole clone is non-atomic by design) but the clone
-- errors out before step 6 (module_subscriptions upsert) runs, so the
-- campaign never gets tracked as subscribed and never sees future module
-- update notifications, on top of the pregens never actually landing.
--
-- The RLS's author_id=auth.uid() requirement is correct for the normal
-- "a user authors a new pregen and submits it to moderation" flow -
-- widening pregen_library_insert itself would reopen the self-approval
-- hole that policy exists to prevent. The clone flow is a fundamentally
-- different operation (copying already-published module content into a
-- campaign the caller GMs, not authoring new content), so it gets its own
-- narrow SECURITY DEFINER RPC that re-implements the actual authorization
-- check (GM of the target campaign) inline, matching how the surrounding
-- clone steps (campaign_pins/campaign_npcs/tactical_scenes/campaign_notes)
-- are already gated by GM-only RLS.

BEGIN;

CREATE OR REPLACE FUNCTION public.clone_module_pregens_into_campaign(
  p_campaign_id uuid,
  p_module_id uuid,
  p_pregens jsonb
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = p_campaign_id AND c.gm_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the GM of the target campaign may clone pregens into it';
  END IF;

  INSERT INTO public.pregen_library (campaign_id, module_id, name, data, portrait_url, author_id, moderation_status, approved_at)
  SELECT
    p_campaign_id,
    p_module_id,
    (row->>'name'),
    (row->'data'),
    (row->>'portrait_url'),
    NULL,
    'approved',
    now()
  FROM jsonb_array_elements(p_pregens) AS row;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.clone_module_pregens_into_campaign(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clone_module_pregens_into_campaign(uuid, uuid, jsonb) TO authenticated;

COMMIT;
