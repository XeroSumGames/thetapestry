-- ============================================================
-- loot_npc_item — player-side "Search Remains" loot transfer
-- ============================================================
--
-- Players currently have NO surface to take loot from a downed NPC —
-- it's all GM-mediated through NpcCard's "Give to" flow. This RPC
-- closes that gap. Players can click 🎒 Search Remains on a
-- PlayerNpcCard for any NPC who is dead / mortally wounded /
-- unconscious; each Take click fires this RPC, which atomically:
--
--   1. Validates the looter's session + character ownership.
--   2. Validates the looter's character is in the NPC's campaign.
--   3. Validates the NPC is "lootable" — status='dead', or
--      wp_current=0 (mortally wounded), or rp_current=0 with
--      wp_current>0 (unconscious).
--   4. Decrements (or removes) the named item from the NPC's
--      inventory JSONB array.
--   5. Increments (or appends) the same item into the PC's
--      characters.data.inventory JSONB array, stacking when
--      a matching name+custom-flag entry exists.
--   6. Logs an audit row to roll_log so the table feed shows
--      "🎒 <Player> looted <Item> from <NPC>".
--
-- All in one transaction with SECURITY DEFINER privileges so the
-- RLS policies on campaign_npcs / characters / roll_log don't
-- need a write-policy carve-out for cross-user loot.
--
-- Returns jsonb { ok: bool, error?: text, taken: int }.

create or replace function public.loot_npc_item(
  p_npc_id uuid,
  p_character_id uuid,
  p_item_name text,
  p_item_custom boolean default false,
  p_qty int default 1
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_npc record;
  v_pc record;
  v_npc_inv jsonb;
  v_pc_data jsonb;
  v_pc_inv jsonb;
  v_npc_item_idx int := -1;
  v_npc_item jsonb;
  v_npc_qty int;
  v_take int;
  v_new_npc_inv jsonb;
  v_pc_match_idx int := -1;
  v_pc_existing jsonb;
  v_new_pc_inv jsonb;
  v_new_item jsonb;
  v_wp int;
  v_rp int;
  v_lootable boolean;
  i int;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;
  if p_qty is null or p_qty <= 0 then
    return jsonb_build_object('ok', false, 'error', 'qty must be > 0');
  end if;

  -- 1. Fetch NPC (RLS already restricts to the user's campaigns
  --    via "Campaign members can read campaign npcs", but we're in
  --    SECURITY DEFINER so we bypass it — the campaign-membership
  --    check at step 3 is the real gate).
  select * into v_npc from public.campaign_npcs where id = p_npc_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NPC not found');
  end if;

  -- 2. Fetch + verify character ownership.
  select * into v_pc from public.characters where id = p_character_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'character not found');
  end if;
  if v_pc.user_id is null or v_pc.user_id <> v_user_id then
    return jsonb_build_object('ok', false, 'error', 'not your character');
  end if;

  -- 3. Verify the looter's character is a member of the NPC's campaign.
  if not exists (
    select 1 from public.campaign_members
    where campaign_id = v_npc.campaign_id
      and user_id = v_user_id
      and character_id = p_character_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'character not in NPC''s campaign');
  end if;

  -- 4. Verify the NPC is lootable.
  v_wp := coalesce(v_npc.wp_current, v_npc.wp_max, 10);
  v_rp := coalesce(v_npc.rp_current, v_npc.rp_max, 6);
  v_lootable := (v_npc.status = 'dead')
              or (v_wp = 0)             -- dead OR mortally wounded
              or (v_rp = 0 and v_wp > 0); -- unconscious
  if not v_lootable then
    return jsonb_build_object('ok', false, 'error', 'NPC must be dead, mortally wounded, or unconscious to loot');
  end if;

  -- 5. Find the item in the NPC's inventory by name+custom-flag.
  v_npc_inv := coalesce(v_npc.inventory, '[]'::jsonb);
  if jsonb_typeof(v_npc_inv) <> 'array' then
    v_npc_inv := '[]'::jsonb;
  end if;
  for i in 0 .. jsonb_array_length(v_npc_inv) - 1 loop
    if (v_npc_inv->i->>'name') = p_item_name
       and coalesce((v_npc_inv->i->>'custom')::boolean, false) = p_item_custom then
      v_npc_item_idx := i;
      v_npc_item := v_npc_inv->i;
      exit;
    end if;
  end loop;
  if v_npc_item_idx < 0 then
    return jsonb_build_object('ok', false, 'error', 'item not in NPC inventory');
  end if;
  v_npc_qty := coalesce((v_npc_item->>'qty')::int, 1);
  v_take := least(p_qty, v_npc_qty);
  if v_take <= 0 then
    return jsonb_build_object('ok', false, 'error', 'qty unavailable');
  end if;

  -- 6. Build new NPC inventory (decrement or remove item).
  if v_npc_qty - v_take <= 0 then
    -- Remove the item entirely.
    v_new_npc_inv := (
      select coalesce(jsonb_agg(elem), '[]'::jsonb)
      from jsonb_array_elements(v_npc_inv) with ordinality as t(elem, ord)
      where ord - 1 <> v_npc_item_idx
    );
  else
    v_new_npc_inv := jsonb_set(
      v_npc_inv,
      array[v_npc_item_idx::text, 'qty'],
      to_jsonb(v_npc_qty - v_take)
    );
  end if;

  -- 7. Find or build the PC's matching inventory entry.
  v_pc_data := coalesce(v_pc.data, '{}'::jsonb);
  v_pc_inv := coalesce(v_pc_data->'inventory', '[]'::jsonb);
  if jsonb_typeof(v_pc_inv) <> 'array' then
    v_pc_inv := '[]'::jsonb;
  end if;
  for i in 0 .. jsonb_array_length(v_pc_inv) - 1 loop
    if (v_pc_inv->i->>'name') = p_item_name
       and coalesce((v_pc_inv->i->>'custom')::boolean, false) = p_item_custom then
      v_pc_match_idx := i;
      v_pc_existing := v_pc_inv->i;
      exit;
    end if;
  end loop;
  if v_pc_match_idx >= 0 then
    -- Stack into the existing entry.
    v_new_pc_inv := jsonb_set(
      v_pc_inv,
      array[v_pc_match_idx::text, 'qty'],
      to_jsonb(coalesce((v_pc_existing->>'qty')::int, 1) + v_take)
    );
  else
    -- Append a fresh entry — keep the source item's metadata
    -- (enc / rarity / notes) but force qty to v_take.
    v_new_item := jsonb_strip_nulls(
      jsonb_build_object(
        'name', p_item_name,
        'qty', v_take,
        'custom', p_item_custom,
        'enc', v_npc_item->>'enc',
        'rarity', v_npc_item->>'rarity',
        'notes', v_npc_item->>'notes'
      )
    );
    v_new_pc_inv := v_pc_inv || jsonb_build_array(v_new_item);
  end if;

  -- 8. Apply both updates atomically + audit log.
  update public.campaign_npcs
     set inventory = v_new_npc_inv
   where id = p_npc_id;

  update public.characters
     set data = jsonb_set(v_pc_data, '{inventory}', v_new_pc_inv)
   where id = p_character_id;

  insert into public.roll_log (
    campaign_id, user_id, character_name, label,
    die1, die2, amod, smod, cmod, total, outcome
  ) values (
    v_npc.campaign_id,
    v_user_id,
    v_pc.name,
    '🎒 ' || v_pc.name || ' looted ' || p_item_name ||
      case when v_take > 1 then ' ×' || v_take else '' end ||
      ' from ' || v_npc.name,
    0, 0, 0, 0, 0, 0, 'loot'
  );

  return jsonb_build_object('ok', true, 'taken', v_take);
end;
$$;

revoke all on function public.loot_npc_item(uuid, uuid, text, boolean, int) from public;
grant execute on function public.loot_npc_item(uuid, uuid, text, boolean, int) to authenticated;

-- ── Sanity test (run as a logged-in player; expects ok=false because
--    the placeholder UUIDs don't match anything):
--
--   select public.loot_npc_item(
--     '00000000-0000-0000-0000-000000000000'::uuid,
--     '00000000-0000-0000-0000-000000000000'::uuid,
--     'Apple', false, 1
--   );
