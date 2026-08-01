-- Atomic item-transfer RPCs for the 4 non-PC-to-PC give directions.
-- give_item_to_character (PC->PC) already exists as the working precedent
-- this mirrors: SELECT ... FOR UPDATE to lock both sides, consolidate
-- matching (name, custom) stacks, write both sides in the same function
-- call (one implicit transaction). Fixes Gate 3.1 (H12): InventoryPanel's
-- give-to-NPC/community/vehicle fired the receiver write un-awaited and
-- decremented the giver unconditionally (item loss/dup), and NpcCard's
-- loot-to-PC path never decremented the NPC's inventory at all
-- (deterministic, unlimited duplication - found during the 2026-08-01
-- security/economy audit, not in the original Gate 3.1 scope).
--
-- Authorization mirrors current app UX (not a permission redesign): the
-- PC side requires ownership-or-GM (same as give_item_to_character); NPCs/
-- communities/vehicles require the caller to be a member (GM or player) of
-- the same campaign - matches the existing client-side filtering (e.g.
-- non-hidden NPCs are already give/loot-able by any player).

-- ============================================================
-- 1. PC gives an item to an NPC.
-- ============================================================
CREATE OR REPLACE FUNCTION public.give_item_character_to_npc(
  p_giver_character_id uuid, p_target_npc_id uuid,
  p_item_name text, p_item_custom boolean, p_qty integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_campaign_id uuid;
  v_is_owner boolean;
  v_is_member boolean;
  v_giver_data jsonb;
  v_giver_inv jsonb;
  v_target_inv jsonb;
  v_have integer;
  v_target_have integer;
  v_template jsonb;
BEGIN
  IF p_qty IS NULL OR p_qty < 1 THEN RAISE EXCEPTION 'qty must be >= 1'; END IF;

  SELECT campaign_id INTO v_campaign_id FROM campaign_npcs WHERE id = p_target_npc_id;
  IF v_campaign_id IS NULL THEN RAISE EXCEPTION 'npc not found'; END IF;

  SELECT EXISTS (SELECT 1 FROM characters WHERE id = p_giver_character_id AND user_id = v_uid) INTO v_is_owner;
  SELECT EXISTS (
    SELECT 1 FROM character_states cs WHERE cs.character_id = p_giver_character_id AND cs.campaign_id = v_campaign_id
  ) INTO v_is_member;
  IF NOT v_is_member THEN RAISE EXCEPTION 'giver is not in this campaign'; END IF;
  IF NOT (COALESCE(v_is_owner, false) OR EXISTS (SELECT 1 FROM campaigns WHERE id = v_campaign_id AND gm_user_id = v_uid)) THEN
    RAISE EXCEPTION 'not authorized to give from this character';
  END IF;

  SELECT data INTO v_giver_data FROM characters WHERE id = p_giver_character_id FOR UPDATE;
  IF v_giver_data IS NULL THEN RAISE EXCEPTION 'character not found'; END IF;
  v_giver_inv := COALESCE(v_giver_data->'inventory', '[]'::jsonb);

  SELECT inventory INTO v_target_inv FROM campaign_npcs WHERE id = p_target_npc_id FOR UPDATE;
  v_target_inv := COALESCE(v_target_inv, '[]'::jsonb);

  SELECT COALESCE(SUM((e->>'qty')::int), 0) INTO v_have FROM jsonb_array_elements(v_giver_inv) e
    WHERE e->>'name' = p_item_name AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false);
  IF v_have < p_qty THEN RAISE EXCEPTION 'giver has only % of %, cannot give %', v_have, p_item_name, p_qty; END IF;

  SELECT e INTO v_template FROM jsonb_array_elements(v_giver_inv) e
    WHERE e->>'name' = p_item_name AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false) LIMIT 1;

  v_giver_inv := (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(v_giver_inv) e
    WHERE NOT (e->>'name' = p_item_name AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false)));
  IF (v_have - p_qty) > 0 THEN
    v_giver_inv := v_giver_inv || jsonb_build_array(jsonb_set(v_template, '{qty}', to_jsonb(v_have - p_qty)));
  END IF;

  SELECT COALESCE(SUM((e->>'qty')::int), 0) INTO v_target_have FROM jsonb_array_elements(v_target_inv) e
    WHERE e->>'name' = p_item_name AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false);
  v_target_inv := (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(v_target_inv) e
    WHERE NOT (e->>'name' = p_item_name AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false)));
  v_target_inv := v_target_inv || jsonb_build_array(jsonb_set(v_template, '{qty}', to_jsonb(v_target_have + p_qty)));

  UPDATE characters SET data = jsonb_set(v_giver_data, '{inventory}', v_giver_inv) WHERE id = p_giver_character_id;
  UPDATE campaign_npcs SET inventory = v_target_inv WHERE id = p_target_npc_id;
END;
$function$;

-- ============================================================
-- 2. NPC loots (gives) an item to a PC. Reverse of #1 - fixes the
-- deterministic duplication bug (NpcCard's onGiveTo never decremented
-- the NPC side).
-- ============================================================
CREATE OR REPLACE FUNCTION public.give_item_npc_to_character(
  p_giver_npc_id uuid, p_target_character_id uuid,
  p_item_name text, p_item_custom boolean, p_qty integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_campaign_id uuid;
  v_is_member boolean;
  v_giver_inv jsonb;
  v_target_data jsonb;
  v_target_inv jsonb;
  v_have integer;
  v_target_have integer;
  v_template jsonb;
BEGIN
  IF p_qty IS NULL OR p_qty < 1 THEN RAISE EXCEPTION 'qty must be >= 1'; END IF;

  SELECT campaign_id INTO v_campaign_id FROM campaign_npcs WHERE id = p_giver_npc_id;
  IF v_campaign_id IS NULL THEN RAISE EXCEPTION 'npc not found'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM character_states cs WHERE cs.character_id = p_target_character_id AND cs.campaign_id = v_campaign_id
  ) INTO v_is_member;
  IF NOT v_is_member THEN RAISE EXCEPTION 'target character is not in this campaign'; END IF;
  IF NOT (v_is_member AND EXISTS (
    SELECT 1 FROM character_states cs WHERE cs.campaign_id = v_campaign_id AND cs.user_id = v_uid
  ) OR EXISTS (SELECT 1 FROM campaigns WHERE id = v_campaign_id AND gm_user_id = v_uid)) THEN
    RAISE EXCEPTION 'not authorized to loot this npc';
  END IF;

  SELECT inventory INTO v_giver_inv FROM campaign_npcs WHERE id = p_giver_npc_id FOR UPDATE;
  v_giver_inv := COALESCE(v_giver_inv, '[]'::jsonb);

  SELECT data INTO v_target_data FROM characters WHERE id = p_target_character_id FOR UPDATE;
  IF v_target_data IS NULL THEN RAISE EXCEPTION 'character not found'; END IF;
  v_target_inv := COALESCE(v_target_data->'inventory', '[]'::jsonb);

  SELECT COALESCE(SUM((e->>'qty')::int), 0) INTO v_have FROM jsonb_array_elements(v_giver_inv) e
    WHERE e->>'name' = p_item_name AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false);
  IF v_have < p_qty THEN RAISE EXCEPTION 'npc has only % of %, cannot give %', v_have, p_item_name, p_qty; END IF;

  SELECT e INTO v_template FROM jsonb_array_elements(v_giver_inv) e
    WHERE e->>'name' = p_item_name AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false) LIMIT 1;

  v_giver_inv := (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(v_giver_inv) e
    WHERE NOT (e->>'name' = p_item_name AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false)));
  IF (v_have - p_qty) > 0 THEN
    v_giver_inv := v_giver_inv || jsonb_build_array(jsonb_set(v_template, '{qty}', to_jsonb(v_have - p_qty)));
  END IF;

  SELECT COALESCE(SUM((e->>'qty')::int), 0) INTO v_target_have FROM jsonb_array_elements(v_target_inv) e
    WHERE e->>'name' = p_item_name AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false);
  v_target_inv := (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(v_target_inv) e
    WHERE NOT (e->>'name' = p_item_name AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false)));
  v_target_inv := v_target_inv || jsonb_build_array(jsonb_set(jsonb_set(v_template, '{qty}', to_jsonb(v_target_have + p_qty)), '{worn}', 'false'::jsonb));

  UPDATE campaign_npcs SET inventory = v_giver_inv WHERE id = p_giver_npc_id;
  UPDATE characters SET data = jsonb_set(v_target_data, '{inventory}', v_target_inv) WHERE id = p_target_character_id;
END;
$function$;

-- ============================================================
-- 3. PC deposits an item into a community stockpile.
-- ============================================================
CREATE OR REPLACE FUNCTION public.give_item_character_to_community(
  p_giver_character_id uuid, p_target_community_id uuid,
  p_item_name text, p_item_custom boolean, p_qty integer,
  p_item_enc numeric DEFAULT NULL, p_item_rarity text DEFAULT NULL, p_item_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_campaign_id uuid;
  v_is_owner boolean;
  v_giver_data jsonb;
  v_giver_inv jsonb;
  v_have integer;
  v_template jsonb;
BEGIN
  IF p_qty IS NULL OR p_qty < 1 THEN RAISE EXCEPTION 'qty must be >= 1'; END IF;

  SELECT campaign_id INTO v_campaign_id FROM communities WHERE id = p_target_community_id;
  IF v_campaign_id IS NULL THEN RAISE EXCEPTION 'community not found'; END IF;

  SELECT EXISTS (SELECT 1 FROM characters WHERE id = p_giver_character_id AND user_id = v_uid) INTO v_is_owner;
  IF NOT EXISTS (
    SELECT 1 FROM character_states cs WHERE cs.character_id = p_giver_character_id AND cs.campaign_id = v_campaign_id
  ) THEN RAISE EXCEPTION 'giver is not in this campaign'; END IF;
  IF NOT (COALESCE(v_is_owner, false) OR EXISTS (SELECT 1 FROM campaigns WHERE id = v_campaign_id AND gm_user_id = v_uid)) THEN
    RAISE EXCEPTION 'not authorized to give from this character';
  END IF;

  SELECT data INTO v_giver_data FROM characters WHERE id = p_giver_character_id FOR UPDATE;
  IF v_giver_data IS NULL THEN RAISE EXCEPTION 'character not found'; END IF;
  v_giver_inv := COALESCE(v_giver_data->'inventory', '[]'::jsonb);

  SELECT COALESCE(SUM((e->>'qty')::int), 0) INTO v_have FROM jsonb_array_elements(v_giver_inv) e
    WHERE e->>'name' = p_item_name AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false);
  IF v_have < p_qty THEN RAISE EXCEPTION 'giver has only % of %, cannot give %', v_have, p_item_name, p_qty; END IF;

  SELECT e INTO v_template FROM jsonb_array_elements(v_giver_inv) e
    WHERE e->>'name' = p_item_name AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false) LIMIT 1;

  v_giver_inv := (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(v_giver_inv) e
    WHERE NOT (e->>'name' = p_item_name AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false)));
  IF (v_have - p_qty) > 0 THEN
    v_giver_inv := v_giver_inv || jsonb_build_array(jsonb_set(v_template, '{qty}', to_jsonb(v_have - p_qty)));
  END IF;
  UPDATE characters SET data = jsonb_set(v_giver_data, '{inventory}', v_giver_inv) WHERE id = p_giver_character_id;

  -- Stockpile row: lock any existing matching row for the duration, then
  -- update-or-insert. The FOR UPDATE (when a row exists) serializes
  -- concurrent deposits/withdrawals on the SAME item row against each
  -- other; the unique index on (community_id, name, custom) still backs
  -- the insert-vs-insert race.
  PERFORM 1 FROM community_stockpile_items
    WHERE community_id = p_target_community_id AND name = p_item_name AND COALESCE(custom, false) = COALESCE(p_item_custom, false)
    FOR UPDATE;
  UPDATE community_stockpile_items
    SET qty = qty + p_qty
    WHERE community_id = p_target_community_id AND name = p_item_name AND COALESCE(custom, false) = COALESCE(p_item_custom, false);
  IF NOT FOUND THEN
    INSERT INTO community_stockpile_items (community_id, name, qty, enc, rarity, notes, custom)
    VALUES (p_target_community_id, p_item_name, p_qty, COALESCE(p_item_enc, (v_template->>'enc')::numeric), COALESCE(p_item_rarity, v_template->>'rarity'), COALESCE(p_item_notes, v_template->>'notes'), COALESCE(p_item_custom, false));
  END IF;
END;
$function$;

-- ============================================================
-- 4. PC withdraws an item from a community stockpile to their own inventory.
-- Reverse of #3 - same race class the audit flagged for withdrawStockpileItemToPc.
-- ============================================================
CREATE OR REPLACE FUNCTION public.withdraw_item_community_to_character(
  p_community_id uuid, p_target_character_id uuid,
  p_item_name text, p_item_custom boolean, p_qty integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_campaign_id uuid;
  v_is_owner boolean;
  v_row_qty integer;
  v_row record;
  v_target_data jsonb;
  v_target_inv jsonb;
  v_target_have integer;
BEGIN
  IF p_qty IS NULL OR p_qty < 1 THEN RAISE EXCEPTION 'qty must be >= 1'; END IF;

  SELECT campaign_id INTO v_campaign_id FROM communities WHERE id = p_community_id;
  IF v_campaign_id IS NULL THEN RAISE EXCEPTION 'community not found'; END IF;

  SELECT EXISTS (SELECT 1 FROM characters WHERE id = p_target_character_id AND user_id = v_uid) INTO v_is_owner;
  IF NOT EXISTS (
    SELECT 1 FROM character_states cs WHERE cs.character_id = p_target_character_id AND cs.campaign_id = v_campaign_id
  ) THEN RAISE EXCEPTION 'character is not in this campaign'; END IF;
  IF NOT (COALESCE(v_is_owner, false) OR EXISTS (SELECT 1 FROM campaigns WHERE id = v_campaign_id AND gm_user_id = v_uid)) THEN
    RAISE EXCEPTION 'not authorized to withdraw to this character';
  END IF;

  SELECT * INTO v_row FROM community_stockpile_items
    WHERE community_id = p_community_id AND name = p_item_name AND COALESCE(custom, false) = COALESCE(p_item_custom, false)
    FOR UPDATE;
  IF v_row IS NULL THEN RAISE EXCEPTION 'stockpile has none of %', p_item_name; END IF;
  IF v_row.qty < p_qty THEN RAISE EXCEPTION 'stockpile has only % of %, cannot withdraw %', v_row.qty, p_item_name, p_qty; END IF;

  IF (v_row.qty - p_qty) > 0 THEN
    UPDATE community_stockpile_items SET qty = qty - p_qty WHERE id = v_row.id;
  ELSE
    DELETE FROM community_stockpile_items WHERE id = v_row.id;
  END IF;

  SELECT data INTO v_target_data FROM characters WHERE id = p_target_character_id FOR UPDATE;
  IF v_target_data IS NULL THEN RAISE EXCEPTION 'character not found'; END IF;
  v_target_inv := COALESCE(v_target_data->'inventory', '[]'::jsonb);

  SELECT COALESCE(SUM((e->>'qty')::int), 0) INTO v_target_have FROM jsonb_array_elements(v_target_inv) e
    WHERE e->>'name' = p_item_name AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false);
  v_target_inv := (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(v_target_inv) e
    WHERE NOT (e->>'name' = p_item_name AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false)));
  v_target_inv := v_target_inv || jsonb_build_array(jsonb_build_object(
    'name', p_item_name, 'qty', v_target_have + p_qty, 'custom', COALESCE(p_item_custom, false),
    'enc', v_row.enc, 'rarity', v_row.rarity, 'notes', v_row.notes
  ));
  UPDATE characters SET data = jsonb_set(v_target_data, '{inventory}', v_target_inv) WHERE id = p_target_character_id;
END;
$function$;

-- ============================================================
-- 5. PC stashes an item in a vehicle's cargo.
-- ============================================================
CREATE OR REPLACE FUNCTION public.give_item_character_to_vehicle(
  p_giver_character_id uuid, p_campaign_id uuid, p_vehicle_id text,
  p_item_name text, p_item_custom boolean, p_qty integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_owner boolean;
  v_giver_data jsonb;
  v_giver_inv jsonb;
  v_have integer;
  v_template jsonb;
  v_vehicles jsonb;
  v_elem jsonb;
  v_next jsonb;
  v_found boolean := false;
  v_cargo jsonb;
  v_cargo_have integer;
BEGIN
  IF p_qty IS NULL OR p_qty < 1 THEN RAISE EXCEPTION 'qty must be >= 1'; END IF;

  SELECT EXISTS (SELECT 1 FROM characters WHERE id = p_giver_character_id AND user_id = v_uid) INTO v_is_owner;
  IF NOT EXISTS (
    SELECT 1 FROM character_states cs WHERE cs.character_id = p_giver_character_id AND cs.campaign_id = p_campaign_id
  ) THEN RAISE EXCEPTION 'giver is not in this campaign'; END IF;
  IF NOT (COALESCE(v_is_owner, false) OR EXISTS (SELECT 1 FROM campaigns WHERE id = p_campaign_id AND gm_user_id = v_uid)) THEN
    RAISE EXCEPTION 'not authorized to give from this character';
  END IF;

  SELECT data INTO v_giver_data FROM characters WHERE id = p_giver_character_id FOR UPDATE;
  IF v_giver_data IS NULL THEN RAISE EXCEPTION 'character not found'; END IF;
  v_giver_inv := COALESCE(v_giver_data->'inventory', '[]'::jsonb);

  SELECT COALESCE(SUM((e->>'qty')::int), 0) INTO v_have FROM jsonb_array_elements(v_giver_inv) e
    WHERE e->>'name' = p_item_name AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false);
  IF v_have < p_qty THEN RAISE EXCEPTION 'giver has only % of %, cannot give %', v_have, p_item_name, p_qty; END IF;

  SELECT e INTO v_template FROM jsonb_array_elements(v_giver_inv) e
    WHERE e->>'name' = p_item_name AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false) LIMIT 1;

  v_giver_inv := (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(v_giver_inv) e
    WHERE NOT (e->>'name' = p_item_name AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false)));
  IF (v_have - p_qty) > 0 THEN
    v_giver_inv := v_giver_inv || jsonb_build_array(jsonb_set(v_template, '{qty}', to_jsonb(v_have - p_qty)));
  END IF;

  -- Lock the campaign row (guards the vehicles jsonb array the same way
  -- update_vehicle_in_campaign's caller expects) and merge into cargo.
  SELECT vehicles INTO v_vehicles FROM campaigns WHERE id = p_campaign_id FOR UPDATE;
  v_vehicles := COALESCE(v_vehicles, '[]'::jsonb);
  v_next := '[]'::jsonb;
  FOR v_elem IN SELECT value FROM jsonb_array_elements(v_vehicles) AS t(value) LOOP
    IF (v_elem->>'id') = p_vehicle_id THEN
      v_found := true;
      v_cargo := COALESCE(v_elem->'cargo', '[]'::jsonb);
      SELECT COALESCE(SUM((e->>'qty')::int), 0) INTO v_cargo_have FROM jsonb_array_elements(v_cargo) e
        WHERE e->>'name' = p_item_name AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false);
      v_cargo := (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(v_cargo) e
        WHERE NOT (e->>'name' = p_item_name AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false)));
      v_cargo := v_cargo || jsonb_build_array(jsonb_set(v_template, '{qty}', to_jsonb(v_cargo_have + p_qty)));
      v_next := v_next || jsonb_build_array(jsonb_set(v_elem, '{cargo}', v_cargo));
    ELSE
      v_next := v_next || jsonb_build_array(v_elem);
    END IF;
  END LOOP;
  IF NOT v_found THEN RAISE EXCEPTION 'vehicle % not found in campaign %', p_vehicle_id, p_campaign_id; END IF;

  UPDATE characters SET data = jsonb_set(v_giver_data, '{inventory}', v_giver_inv) WHERE id = p_giver_character_id;
  UPDATE campaigns SET vehicles = v_next WHERE id = p_campaign_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.give_item_character_to_npc(uuid, uuid, text, boolean, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.give_item_npc_to_character(uuid, uuid, text, boolean, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.give_item_character_to_community(uuid, uuid, text, boolean, integer, numeric, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.withdraw_item_community_to_character(uuid, uuid, text, boolean, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.give_item_character_to_vehicle(uuid, uuid, text, text, boolean, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.give_item_character_to_npc(uuid, uuid, text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.give_item_npc_to_character(uuid, uuid, text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.give_item_character_to_community(uuid, uuid, text, boolean, integer, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_item_community_to_character(uuid, uuid, text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.give_item_character_to_vehicle(uuid, uuid, text, text, boolean, integer) TO authenticated;
