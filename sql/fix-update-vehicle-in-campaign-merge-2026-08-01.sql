-- Fix: update_vehicle_in_campaign fully REPLACED the matching vehicle
-- array element with whatever the client sent, instead of merging. Every
-- client call site builds its payload as `{ ...vehicle, someField: x }` -
-- a snapshot of local (possibly stale) state plus one changed field. Two
-- clients editing different fields of the same vehicle concurrently (seats,
-- fuel, cargo, notes - anything) could have one client's write silently
-- revert the other's, because each write carried its own stale copy of
-- every OTHER field along with it.
--
-- Fix is two halves: this migration changes the RPC to MERGE a patch
-- instead of replacing the whole element (shallow jsonb `||`), and the
-- companion app/vehicle/page.tsx change makes updateVehicle() diff against
-- last-known state and send ONLY the fields that actually changed, so the
-- merge is a real narrow patch rather than "every field, including ones
-- that didn't change" (which would degrade back to a full replace).
--
-- The old id-matching smuggling check is dropped - it doesn't apply to a
-- patch (which may not carry an id at all), and p_vehicle_id already fully
-- determines the target row. The "not found" branch now raises instead of
-- silently inserting a patch-only (incomplete) vehicle row - this endpoint
-- has only ever edited an already-existing vehicle in practice.

-- CREATE OR REPLACE cannot rename a parameter (p_new_vehicle -> p_patch);
-- Postgres requires an explicit drop first.
DROP FUNCTION IF EXISTS update_vehicle_in_campaign(uuid, text, jsonb);

CREATE FUNCTION update_vehicle_in_campaign(
  p_campaign_id uuid,
  p_vehicle_id text,
  p_patch jsonb
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

  SELECT vehicles INTO v_existing FROM campaigns WHERE id = p_campaign_id;
  IF v_existing IS NULL THEN
    v_existing := '[]'::jsonb;
  END IF;

  v_next := '[]'::jsonb;
  FOR v_elem IN
    SELECT value FROM jsonb_array_elements(v_existing) AS t(value)
  LOOP
    IF (v_elem->>'id') = p_vehicle_id THEN
      -- Shallow merge: patch fields override, everything else on the
      -- existing element (as currently in the DB, not the caller's
      -- stale copy) is preserved.
      v_next := v_next || jsonb_build_array(v_elem || p_patch);
      v_found := true;
    ELSE
      v_next := v_next || jsonb_build_array(v_elem);
    END IF;
  END LOOP;

  IF NOT v_found THEN
    RAISE EXCEPTION 'update_vehicle_in_campaign: vehicle % not found in campaign %', p_vehicle_id, p_campaign_id;
  END IF;

  UPDATE campaigns SET vehicles = v_next WHERE id = p_campaign_id;
END;
$$;

REVOKE ALL ON FUNCTION update_vehicle_in_campaign(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_vehicle_in_campaign(uuid, text, jsonb) TO authenticated;

-- Supabase auto-grants EXECUTE to anon on newly created public-schema
-- functions independent of the REVOKE ALL FROM PUBLIC above (that revokes
-- PUBLIC's own default grant, not an explicit named-role one). Not
-- exploitable - v_authorized would reject a null auth.uid() regardless -
-- but closing it explicitly for defense-in-depth, matching the pattern
-- used for get_visitor_map_data in this same audit pass.
REVOKE EXECUTE ON FUNCTION update_vehicle_in_campaign(uuid, text, jsonb) FROM anon;
