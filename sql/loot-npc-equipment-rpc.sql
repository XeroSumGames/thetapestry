-- ============================================================
-- loot_npc_equipment_item - take a weapon from a downed NPC's skills slot
-- ============================================================
--
-- Companion to loot_npc_item (which handles inventory items).
-- This RPC handles weapons stored in campaign_npcs.skills->>'weapon'
-- and campaign_npcs.skills->>'weapon2'. Weapons with ammo data
-- (ammoCurrent / ammoMax / reloads) live there, not in the inventory
-- JSONB array.
--
-- Atomically:
--   1. Validates session, character ownership, campaign membership.
--   2. Validates NPC is lootable (dead / mortally wounded / unconscious).
--   3. Reads the weapon from skills[p_weapon_slot] and confirms it exists.
--   4. Nulls out the weapon slot in campaign_npcs.skills.
--   5. Appends the weapon as a named inventory item to the PC's
--      characters.data.inventory (stacks if the same weapon name is
--      already there, which is unusual but handles it cleanly).
--      Notes field carries: "<condition> - <ammoCurrent>/<ammoMax> ammo,
--      <reloads> reloads" so the player's inventory sheet shows the state
--      of the looted weapon.
--   6. Logs an audit row to roll_log (outcome='loot').
--
-- Returns jsonb { ok: bool, error?: text }.

create or replace function public.loot_npc_equipment_item(
  p_npc_id       uuid,
  p_character_id uuid,
  p_weapon_slot  text  -- 'weapon' or 'weapon2'
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id    uuid := auth.uid();
  v_npc        record;
  v_pc         record;
  v_skills     jsonb;
  v_weapon     jsonb;
  v_weapon_name text;
  v_condition  text;
  v_ammo_cur   int;
  v_ammo_max   int;
  v_reloads    int;
  v_notes      text;
  v_wp         int;
  v_rp         int;
  v_lootable   boolean;
  v_pc_data    jsonb;
  v_pc_inv     jsonb;
  v_match_idx  int := -1;
  v_existing   jsonb;
  v_new_pc_inv jsonb;
  v_new_item   jsonb;
  i            int;
begin
  -- Basic validation
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;
  if p_weapon_slot not in ('weapon', 'weapon2') then
    return jsonb_build_object('ok', false, 'error', 'invalid weapon slot (must be weapon or weapon2)');
  end if;

  -- 1. Fetch NPC (SECURITY DEFINER bypasses RLS; campaign check below is the real gate)
  select * into v_npc from public.campaign_npcs where id = p_npc_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NPC not found');
  end if;

  -- 2. Fetch + verify character ownership
  select * into v_pc from public.characters where id = p_character_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'character not found');
  end if;
  if v_pc.user_id is null or v_pc.user_id <> v_user_id then
    return jsonb_build_object('ok', false, 'error', 'not your character');
  end if;

  -- 3. Verify the looter is a member of the NPC's campaign
  if not exists (
    select 1 from public.campaign_members
    where campaign_id = v_npc.campaign_id
      and user_id     = v_user_id
      and character_id = p_character_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'character not in NPC''s campaign');
  end if;

  -- 4. Verify NPC is lootable
  v_wp := coalesce(v_npc.wp_current, v_npc.wp_max, 10);
  v_rp := coalesce(v_npc.rp_current, v_npc.rp_max, 6);
  v_lootable := (v_npc.status = 'dead')
             or (v_wp = 0)
             or (v_rp = 0 and v_wp > 0);
  if not v_lootable then
    return jsonb_build_object('ok', false, 'error', 'NPC must be dead, mortally wounded, or unconscious to loot');
  end if;

  -- 5. Read the weapon from the skills slot
  v_skills := coalesce(v_npc.skills, '{}'::jsonb);
  v_weapon  := v_skills->p_weapon_slot;
  if v_weapon is null or jsonb_typeof(v_weapon) = 'null' then
    return jsonb_build_object('ok', false, 'error', 'no weapon in that slot');
  end if;
  v_weapon_name := v_weapon->>'weaponName';
  if v_weapon_name is null or trim(v_weapon_name) = '' then
    return jsonb_build_object('ok', false, 'error', 'weapon slot has no name');
  end if;

  -- 6. Build descriptive notes string for the PC's inventory entry
  v_condition := coalesce(v_weapon->>'condition', 'Unknown');
  v_ammo_cur  := coalesce((v_weapon->>'ammoCurrent')::int, 0);
  v_ammo_max  := coalesce((v_weapon->>'ammoMax')::int, 0);
  v_reloads   := coalesce((v_weapon->>'reloads')::int, 0);
  if v_ammo_max > 0 then
    v_notes := v_condition
      || ' - ' || v_ammo_cur || '/' || v_ammo_max || ' ammo'
      || ', ' || v_reloads || ' reload' || case when v_reloads <> 1 then 's' else '' end;
  else
    v_notes := v_condition;
  end if;

  -- 7. Null out the weapon slot in campaign_npcs.skills
  update public.campaign_npcs
     set skills = jsonb_set(v_skills, array[p_weapon_slot], 'null'::jsonb)
   where id = p_npc_id;

  -- 8. Find or build the PC's matching inventory entry
  v_pc_data := coalesce(v_pc.data, '{}'::jsonb);
  v_pc_inv  := coalesce(v_pc_data->'inventory', '[]'::jsonb);
  if jsonb_typeof(v_pc_inv) <> 'array' then
    v_pc_inv := '[]'::jsonb;
  end if;
  for i in 0 .. jsonb_array_length(v_pc_inv) - 1 loop
    if (v_pc_inv->i->>'name') = v_weapon_name
       and not coalesce((v_pc_inv->i->>'custom')::boolean, false) then
      v_match_idx := i;
      v_existing  := v_pc_inv->i;
      exit;
    end if;
  end loop;
  if v_match_idx >= 0 then
    v_new_pc_inv := jsonb_set(
      v_pc_inv,
      array[v_match_idx::text, 'qty'],
      to_jsonb(coalesce((v_existing->>'qty')::int, 1) + 1)
    );
  else
    v_new_item := jsonb_strip_nulls(jsonb_build_object(
      'name',   v_weapon_name,
      'qty',    1,
      'custom', false,
      'notes',  v_notes
    ));
    v_new_pc_inv := v_pc_inv || jsonb_build_array(v_new_item);
  end if;

  -- 9. Persist PC inventory update
  update public.characters
     set data = jsonb_set(v_pc_data, '{inventory}', v_new_pc_inv)
   where id = p_character_id;

  -- 10. Audit log
  insert into public.roll_log (
    campaign_id, user_id, character_name, label,
    die1, die2, amod, smod, cmod, total, outcome
  ) values (
    v_npc.campaign_id,
    v_user_id,
    v_pc.name,
    v_pc.name || ' looted a ' || v_weapon_name || ' from ' || v_npc.name,
    0, 0, 0, 0, 0, 0, 'loot'
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.loot_npc_equipment_item(uuid, uuid, text) from public;
grant execute on function public.loot_npc_equipment_item(uuid, uuid, text) to authenticated;

-- ── Sanity test (expects ok=false - placeholder UUIDs):
--
--   select public.loot_npc_equipment_item(
--     '00000000-0000-0000-0000-000000000000'::uuid,
--     '00000000-0000-0000-0000-000000000000'::uuid,
--     'weapon'
--   );
