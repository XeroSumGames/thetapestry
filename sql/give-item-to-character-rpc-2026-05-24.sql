-- give-item-to-character-rpc-2026-05-24.sql
--
-- PC-to-PC item trade, done safely (the flow-1 fix for the characters cross-
-- user write data-loss class). See:
--   tasks/finding-characters-rls-cross-user-writes-2026-05-24.md
--   tasks/finding-pc-trade-rls-dataloss-2026-05-24.md (E2E lane, the original)
--
-- *** NOT YET APPLIED TO LIVE. *** Bright line (new SECURITY DEFINER fn on prod
-- + GRANT) - apply ONLY on Xero's go:
--   npx supabase db query --linked -f sql/give-item-to-character-rpc-2026-05-24.sql
-- Schema verified: characters.data.inventory is a jsonb array of
-- {name,enc,rarity,notes,qty,custom,worn?} merged by (name,custom) - lib/inventory.ts.
-- NOT executed here.
--
-- WHY AN RPC (Option B, Xero 2026-05-24 - "we'll need it eventually, don't cut
-- corners"): players are owner-only on `characters`, so a peer cannot write the
-- receiver's row (data loss today). Rather than a blanket member-write policy
-- (which would let any peer rewrite a teammate's WHOLE sheet - a cheating hole),
-- this SECURITY DEFINER fn does ONE narrow thing - move an inventory item from
-- giver to receiver - and does its OWN authorization. It moves BOTH sides in one
-- transaction (atomic: no lost/duplicated items), unlike the old client split.
--
-- AUTHORIZATION (enforced in-function, since SECURITY DEFINER bypasses RLS):
--   - caller (auth.uid()) must OWN the giver character, OR be the GM of a
--     campaign both characters share;
--   - giver + receiver must share a campaign (no cross-game dumping);
--   - the giver must actually hold >= p_qty of (name, custom).
-- Anything else RAISEs (the client surfaces the error instead of losing data).

CREATE OR REPLACE FUNCTION public.give_item_to_character(
  p_giver_id    uuid,
  p_target_id   uuid,
  p_item_name   text,
  p_item_custom boolean,
  p_qty         integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_is_owner     boolean;
  v_is_gm        boolean;
  v_giver_data   jsonb;
  v_target_data  jsonb;
  v_giver_inv    jsonb;
  v_target_inv   jsonb;
  v_have         integer;
  v_target_have  integer;
  v_template     jsonb;
BEGIN
  IF p_qty IS NULL OR p_qty < 1 THEN RAISE EXCEPTION 'qty must be >= 1'; END IF;
  IF p_giver_id = p_target_id THEN RAISE EXCEPTION 'giver and target must differ'; END IF;

  -- shared-campaign gate (both characters in the same game)
  IF NOT EXISTS (
    SELECT 1 FROM character_states g
    JOIN character_states t ON t.campaign_id = g.campaign_id
    WHERE g.character_id = p_giver_id AND t.character_id = p_target_id
  ) THEN
    RAISE EXCEPTION 'characters are not in the same campaign';
  END IF;

  -- authz: caller owns the giver, OR is GM of a shared campaign
  SELECT EXISTS (SELECT 1 FROM characters WHERE id = p_giver_id AND user_id = v_uid) INTO v_is_owner;
  SELECT EXISTS (
    SELECT 1 FROM character_states g
    JOIN character_states t ON t.campaign_id = g.campaign_id
    JOIN campaigns c ON c.id = g.campaign_id
    WHERE g.character_id = p_giver_id AND t.character_id = p_target_id AND c.gm_user_id = v_uid
  ) INTO v_is_gm;
  IF NOT (COALESCE(v_is_owner,false) OR COALESCE(v_is_gm,false)) THEN
    RAISE EXCEPTION 'not authorized to give from this character';
  END IF;

  -- lock both rows for the duration of the transfer
  SELECT data INTO v_giver_data  FROM characters WHERE id = p_giver_id  FOR UPDATE;
  SELECT data INTO v_target_data FROM characters WHERE id = p_target_id FOR UPDATE;
  IF v_giver_data IS NULL OR v_target_data IS NULL THEN RAISE EXCEPTION 'character not found'; END IF;

  v_giver_inv  := COALESCE(v_giver_data->'inventory',  '[]'::jsonb);
  v_target_inv := COALESCE(v_target_data->'inventory', '[]'::jsonb);

  -- giver must hold enough of (name, custom) - summed across any stacks
  SELECT COALESCE(SUM((e->>'qty')::int), 0) INTO v_have
  FROM jsonb_array_elements(v_giver_inv) e
  WHERE e->>'name' = p_item_name
    AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false);
  IF v_have < p_qty THEN RAISE EXCEPTION 'giver has only % of %, cannot give %', v_have, p_item_name, p_qty; END IF;

  -- template = one matching entry (carries enc/rarity/notes shape)
  SELECT e INTO v_template
  FROM jsonb_array_elements(v_giver_inv) e
  WHERE e->>'name' = p_item_name
    AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false)
  LIMIT 1;

  -- GIVER: drop all matching stacks, re-add one consolidated remainder (if > 0)
  v_giver_inv := (
    SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)
    FROM jsonb_array_elements(v_giver_inv) e
    WHERE NOT (e->>'name' = p_item_name
      AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false))
  );
  IF (v_have - p_qty) > 0 THEN
    v_giver_inv := v_giver_inv || jsonb_build_array(jsonb_set(v_template, '{qty}', to_jsonb(v_have - p_qty)));
  END IF;

  -- TARGET: consolidate existing matching qty + p_qty into one stack (worn reset)
  SELECT COALESCE(SUM((e->>'qty')::int), 0) INTO v_target_have
  FROM jsonb_array_elements(v_target_inv) e
  WHERE e->>'name' = p_item_name
    AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false);
  v_target_inv := (
    SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)
    FROM jsonb_array_elements(v_target_inv) e
    WHERE NOT (e->>'name' = p_item_name
      AND COALESCE((e->>'custom')::boolean, false) = COALESCE(p_item_custom, false))
  );
  v_target_inv := v_target_inv || jsonb_build_array(
    jsonb_set(jsonb_set(v_template, '{qty}', to_jsonb(v_target_have + p_qty)), '{worn}', 'false'::jsonb)
  );

  -- write both sides atomically
  UPDATE characters SET data = jsonb_set(v_giver_data,  '{inventory}', v_giver_inv)  WHERE id = p_giver_id;
  UPDATE characters SET data = jsonb_set(v_target_data, '{inventory}', v_target_inv) WHERE id = p_target_id;
END;
$$;

-- Logged-in users may call it; the in-function authz is the real gate.
GRANT EXECUTE ON FUNCTION public.give_item_to_character(uuid, uuid, text, boolean, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- CLIENT CONTRACT (Hunt & Peck - rewire `onGiveItem` at app/stories/[id]/table/page.tsx ~6925):
--   await supabase.rpc('give_item_to_character', {
--     p_giver_id: syncedSelectedEntry.character.id,
--     p_target_id: targetCharId,
--     p_item_name: item.name,
--     p_item_custom: item.custom,
--     p_qty: qty,
--   })
-- The RPC now does BOTH sides atomically, so the client must STOP doing its own
-- inventory writes: REMOVE the raw `.from('characters').update(... receiver inv)`
-- AND the giver-side decrement (wherever the give UI does it) - else double-spend.
-- Keep the `notify_inventory_received` RPC call + the `inventory_transfer`
-- broadcast. On success, refetch/patch BOTH characters' local inventory state.
-- Surface any RPC error to the user (no more silent loss).
