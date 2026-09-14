-- Atomic barter-trade RPC (Gate 3.3 / M11). The old code (page.tsx onApply)
-- wrote the PC's inventory first, then the target's (NPC jsonb or community
-- stockpile rows) second, with no rollback - a mid-flow failure (NPC
-- deleted on another client, RLS denial, a stockpile row vanishing)
-- half-applied the deal: the PC's side committed regardless of whether the
-- target's side succeeded, so items could be duplicated or lost depending
-- on which half failed. This RPC locks the PC (and, for an NPC target, the
-- NPC) row FOR UPDATE, verifies BOTH sides have enough of what they're
-- giving up, and writes everything in one transaction - any failure raises
-- and nothing commits.
--
-- p_pc_gives / p_pc_gets are jsonb arrays of {name, custom, selectedQty,
-- enc, rarity, notes} - the exact shape TradeNegotiationModal already
-- builds client-side, just passed straight through instead of being
-- applied via separate un-coordinated writes.

CREATE OR REPLACE FUNCTION public.apply_barter_trade(
  p_pc_character_id uuid,
  p_target_kind text,        -- 'npc' | 'community'
  p_target_id uuid,
  p_pc_gives jsonb,
  p_pc_gets jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_campaign_id uuid;
  v_is_owner boolean;
  v_pc_data jsonb;
  v_pc_inv jsonb;
  v_npc_inv jsonb;
  v_item jsonb;
  v_have integer;
  v_qty integer;
  v_name text;
  v_custom boolean;
  v_idx integer;
  v_row record;
BEGIN
  IF p_target_kind NOT IN ('npc', 'community') THEN RAISE EXCEPTION 'invalid target kind'; END IF;

  IF p_target_kind = 'npc' THEN
    SELECT campaign_id INTO v_campaign_id FROM campaign_npcs WHERE id = p_target_id;
  ELSE
    SELECT campaign_id INTO v_campaign_id FROM communities WHERE id = p_target_id;
  END IF;
  IF v_campaign_id IS NULL THEN RAISE EXCEPTION 'trade target not found'; END IF;

  SELECT EXISTS (SELECT 1 FROM characters WHERE id = p_pc_character_id AND user_id = v_uid) INTO v_is_owner;
  IF NOT EXISTS (
    SELECT 1 FROM character_states cs WHERE cs.character_id = p_pc_character_id AND cs.campaign_id = v_campaign_id
  ) THEN RAISE EXCEPTION 'pc is not in this campaign'; END IF;
  IF NOT (COALESCE(v_is_owner, false) OR EXISTS (SELECT 1 FROM campaigns WHERE id = v_campaign_id AND gm_user_id = v_uid)) THEN
    RAISE EXCEPTION 'not authorized to trade from this character';
  END IF;

  -- Lock the PC row for the duration of the whole trade.
  SELECT data INTO v_pc_data FROM characters WHERE id = p_pc_character_id FOR UPDATE;
  IF v_pc_data IS NULL THEN RAISE EXCEPTION 'character not found'; END IF;
  v_pc_inv := COALESCE(v_pc_data->'inventory', '[]'::jsonb);

  IF p_target_kind = 'npc' THEN
    SELECT inventory INTO v_npc_inv FROM campaign_npcs WHERE id = p_target_id FOR UPDATE;
    v_npc_inv := COALESCE(v_npc_inv, '[]'::jsonb);
  END IF;

  -- Verify PC has enough of everything in pc_gives.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_pc_gives) AS t(value) LOOP
    v_name := v_item->>'name'; v_custom := COALESCE((v_item->>'custom')::boolean, false); v_qty := (v_item->>'selectedQty')::integer;
    SELECT COALESCE(SUM((e->>'qty')::int), 0) INTO v_have FROM jsonb_array_elements(v_pc_inv) e
      WHERE e->>'name' = v_name AND COALESCE((e->>'custom')::boolean, false) = v_custom;
    IF v_have < v_qty THEN RAISE EXCEPTION 'pc has only % of %, cannot give %', v_have, v_name, v_qty; END IF;
  END LOOP;

  -- Verify target has enough of everything in pc_gets.
  IF p_target_kind = 'npc' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_pc_gets) AS t(value) LOOP
      v_name := v_item->>'name'; v_custom := COALESCE((v_item->>'custom')::boolean, false); v_qty := (v_item->>'selectedQty')::integer;
      SELECT COALESCE(SUM((e->>'qty')::int), 0) INTO v_have FROM jsonb_array_elements(v_npc_inv) e
        WHERE e->>'name' = v_name AND COALESCE((e->>'custom')::boolean, false) = v_custom;
      IF v_have < v_qty THEN RAISE EXCEPTION 'npc has only % of %, cannot take %', v_have, v_name, v_qty; END IF;
    END LOOP;
  ELSE
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_pc_gets) AS t(value) LOOP
      v_name := v_item->>'name'; v_custom := COALESCE((v_item->>'custom')::boolean, false); v_qty := (v_item->>'selectedQty')::integer;
      SELECT qty INTO v_have FROM community_stockpile_items
        WHERE community_id = p_target_id AND name = v_name AND COALESCE(custom, false) = v_custom FOR UPDATE;
      IF v_have IS NULL OR v_have < v_qty THEN RAISE EXCEPTION 'stockpile has only % of %, cannot take %', COALESCE(v_have, 0), v_name, v_qty; END IF;
    END LOOP;
  END IF;

  -- All checks passed - apply both sides.
  -- PC loses pc_gives.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_pc_gives) AS t(value) LOOP
    v_name := v_item->>'name'; v_custom := COALESCE((v_item->>'custom')::boolean, false); v_qty := (v_item->>'selectedQty')::integer;
    SELECT (idx - 1) INTO v_idx FROM (
      SELECT row_number() OVER () AS idx, e FROM jsonb_array_elements(v_pc_inv) e
    ) t WHERE t.e->>'name' = v_name AND COALESCE((t.e->>'custom')::boolean, false) = v_custom LIMIT 1;
    IF v_idx IS NOT NULL THEN
      v_have := (v_pc_inv->v_idx->>'qty')::integer - v_qty;
      IF v_have > 0 THEN
        v_pc_inv := jsonb_set(v_pc_inv, ARRAY[v_idx::text, 'qty'], to_jsonb(v_have));
      ELSE
        v_pc_inv := v_pc_inv - v_idx;
      END IF;
    END IF;
  END LOOP;
  -- PC gains pc_gets.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_pc_gets) AS t(value) LOOP
    v_name := v_item->>'name'; v_custom := COALESCE((v_item->>'custom')::boolean, false); v_qty := (v_item->>'selectedQty')::integer;
    SELECT (idx - 1) INTO v_idx FROM (
      SELECT row_number() OVER () AS idx, e FROM jsonb_array_elements(v_pc_inv) e
    ) t WHERE t.e->>'name' = v_name AND COALESCE((t.e->>'custom')::boolean, false) = v_custom LIMIT 1;
    IF v_idx IS NOT NULL THEN
      v_pc_inv := jsonb_set(v_pc_inv, ARRAY[v_idx::text, 'qty'], to_jsonb((v_pc_inv->v_idx->>'qty')::integer + v_qty));
    ELSE
      v_pc_inv := v_pc_inv || jsonb_build_array(jsonb_build_object(
        'name', v_name, 'qty', v_qty, 'custom', v_custom,
        'enc', v_item->'enc', 'rarity', v_item->'rarity', 'notes', v_item->'notes'
      ));
    END IF;
  END LOOP;
  UPDATE characters SET data = jsonb_set(v_pc_data, '{inventory}', v_pc_inv) WHERE id = p_pc_character_id;

  IF p_target_kind = 'npc' THEN
    -- NPC loses pc_gets, gains pc_gives.
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_pc_gets) AS t(value) LOOP
      v_name := v_item->>'name'; v_custom := COALESCE((v_item->>'custom')::boolean, false); v_qty := (v_item->>'selectedQty')::integer;
      SELECT (idx - 1) INTO v_idx FROM (
        SELECT row_number() OVER () AS idx, e FROM jsonb_array_elements(v_npc_inv) e
      ) t WHERE t.e->>'name' = v_name AND COALESCE((t.e->>'custom')::boolean, false) = v_custom LIMIT 1;
      IF v_idx IS NOT NULL THEN
        v_have := (v_npc_inv->v_idx->>'qty')::integer - v_qty;
        IF v_have > 0 THEN
          v_npc_inv := jsonb_set(v_npc_inv, ARRAY[v_idx::text, 'qty'], to_jsonb(v_have));
        ELSE
          v_npc_inv := v_npc_inv - v_idx;
        END IF;
      END IF;
    END LOOP;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_pc_gives) AS t(value) LOOP
      v_name := v_item->>'name'; v_custom := COALESCE((v_item->>'custom')::boolean, false); v_qty := (v_item->>'selectedQty')::integer;
      SELECT (idx - 1) INTO v_idx FROM (
        SELECT row_number() OVER () AS idx, e FROM jsonb_array_elements(v_npc_inv) e
      ) t WHERE t.e->>'name' = v_name AND COALESCE((t.e->>'custom')::boolean, false) = v_custom LIMIT 1;
      IF v_idx IS NOT NULL THEN
        v_npc_inv := jsonb_set(v_npc_inv, ARRAY[v_idx::text, 'qty'], to_jsonb((v_npc_inv->v_idx->>'qty')::integer + v_qty));
      ELSE
        v_npc_inv := v_npc_inv || jsonb_build_array(jsonb_build_object(
          'name', v_name, 'qty', v_qty, 'custom', v_custom,
          'enc', v_item->'enc', 'rarity', v_item->'rarity', 'notes', v_item->'notes'
        ));
      END IF;
    END LOOP;
    UPDATE campaign_npcs SET inventory = v_npc_inv WHERE id = p_target_id;
  ELSE
    -- Community stockpile loses pc_gets, gains pc_gives.
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_pc_gets) AS t(value) LOOP
      v_name := v_item->>'name'; v_custom := COALESCE((v_item->>'custom')::boolean, false); v_qty := (v_item->>'selectedQty')::integer;
      SELECT * INTO v_row FROM community_stockpile_items
        WHERE community_id = p_target_id AND name = v_name AND COALESCE(custom, false) = v_custom;
      IF (v_row.qty - v_qty) > 0 THEN
        UPDATE community_stockpile_items SET qty = qty - v_qty WHERE id = v_row.id;
      ELSE
        DELETE FROM community_stockpile_items WHERE id = v_row.id;
      END IF;
    END LOOP;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_pc_gives) AS t(value) LOOP
      v_name := v_item->>'name'; v_custom := COALESCE((v_item->>'custom')::boolean, false); v_qty := (v_item->>'selectedQty')::integer;
      UPDATE community_stockpile_items SET qty = qty + v_qty
        WHERE community_id = p_target_id AND name = v_name AND COALESCE(custom, false) = v_custom;
      IF NOT FOUND THEN
        INSERT INTO community_stockpile_items (community_id, name, qty, enc, rarity, notes, custom)
        VALUES (p_target_id, v_name, v_qty,
          COALESCE((v_item->>'enc')::integer, 0), COALESCE(v_item->>'rarity', 'Common'), COALESCE(v_item->>'notes', ''), v_custom);
      END IF;
    END LOOP;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_barter_trade(uuid, text, uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_barter_trade(uuid, text, uuid, jsonb, jsonb) TO authenticated;
