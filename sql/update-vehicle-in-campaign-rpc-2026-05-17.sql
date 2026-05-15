-- ============================================================
-- RPC: update_vehicle_in_campaign
--
-- Problem: campaigns RLS only allows the GM (gm_user_id = auth.uid())
-- to UPDATE the row. So when a non-GM campaign member used the vehicle
-- popout (Board / Disembark / Edit Cargo / Edit Notes / Move Item),
-- the supabase.from('campaigns').update({ vehicles }) call was
-- silently rejected. The popout's optimistic setVehicle made it LOOK
-- like the write succeeded; no realtime UPDATE event fired (because
-- no UPDATE happened), so the table page's TacticalMap kept reading
-- the stale vehicles list - no aboard-filter hit, no passenger badge.
--
-- Fix: a SECURITY DEFINER function that bypasses the gm-only UPDATE
-- policy for the narrow task of swapping ONE vehicle inside the
-- campaigns.vehicles jsonb array. Caller must be a member of the
-- campaign (GM or campaign_members row). The function replaces the
-- vehicle whose id matches p_vehicle_id; if none matches, it inserts
-- it (idempotent on retries). Nothing else on the row is touched.
--
-- Idempotent. Run via Supabase SQL Editor or
-- `npx supabase db query --linked -f sql/update-vehicle-in-campaign-rpc-2026-05-17.sql`.
-- ============================================================

-- Drop the previous uuid-typed overload (an earlier draft assumed
-- vehicle.id was a uuid - it's actually an arbitrary string like
-- "minnie-001", so the cast inside the body would have thrown). The
-- type signature is part of the function's identity, so a fresh
-- CREATE on the text-typed version coexists rather than replacing.
DROP FUNCTION IF EXISTS update_vehicle_in_campaign(uuid, uuid, jsonb);

CREATE OR REPLACE FUNCTION update_vehicle_in_campaign(
  p_campaign_id uuid,
  p_vehicle_id text,
  p_new_vehicle jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_authorized boolean;
  v_existing jsonb;
  v_elem jsonb;
  v_next jsonb;
  v_found boolean := false;
BEGIN
  -- Authorize: GM of the campaign OR any campaign_members row for
  -- the calling user. Matches the popout's own canEdit gate.
  SELECT
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE id = p_campaign_id AND gm_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = p_campaign_id AND user_id = auth.uid()
    )
  INTO v_authorized;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'update_vehicle_in_campaign: caller % is not a member of campaign %', auth.uid(), p_campaign_id;
  END IF;

  -- Sanity: the supplied vehicle blob must carry its own id and it
  -- must match p_vehicle_id, so a caller can't smuggle in a write
  -- targeted at a different vehicle. String comparison - vehicle.id
  -- is an arbitrary slug, not a uuid.
  IF (p_new_vehicle->>'id') IS NULL OR (p_new_vehicle->>'id') <> p_vehicle_id THEN
    RAISE EXCEPTION 'update_vehicle_in_campaign: p_new_vehicle.id must equal p_vehicle_id';
  END IF;

  -- Pull current vehicles array, map over it replacing the matching
  -- entry. Builds a new array element-by-element rather than using
  -- jsonb_set with a discovered index, so the implementation stays
  -- readable and a missing entry naturally falls through to the
  -- append branch.
  SELECT vehicles INTO v_existing FROM campaigns WHERE id = p_campaign_id;
  IF v_existing IS NULL THEN
    v_existing := '[]'::jsonb;
  END IF;

  v_next := '[]'::jsonb;
  FOR v_elem IN
    SELECT value FROM jsonb_array_elements(v_existing) AS t(value)
  LOOP
    IF (v_elem->>'id') = p_vehicle_id THEN
      v_next := v_next || jsonb_build_array(p_new_vehicle);
      v_found := true;
    ELSE
      v_next := v_next || jsonb_build_array(v_elem);
    END IF;
  END LOOP;

  IF NOT v_found THEN
    v_next := v_next || jsonb_build_array(p_new_vehicle);
  END IF;

  UPDATE campaigns SET vehicles = v_next WHERE id = p_campaign_id;
END;
$$;

REVOKE ALL ON FUNCTION update_vehicle_in_campaign(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_vehicle_in_campaign(uuid, text, jsonb) TO authenticated;
