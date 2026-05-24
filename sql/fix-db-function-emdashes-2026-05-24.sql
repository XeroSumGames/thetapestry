-- Fix: replace literal em-dashes (U+2014) with ASCII hyphens inside live
-- function/trigger bodies. Surfaced by the 2026-05-23 schema capture.
-- 2 user-facing notification strings (notify_community_milestone,
-- notify_world_community_deletion) violated the no-em-dash rule IN PROD;
-- the rest are RAISE NOTICE logs + code comments. Bodies are the EXACT
-- live definitions (pg_get_functiondef) with only the em-dash char swapped.
-- Apply: npx supabase db query --linked -f sql/fix-db-function-emdashes-2026-05-24.sql

CREATE OR REPLACE FUNCTION public.apply_community_migration_acceptance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_target_campaign_id uuid;
  v_target_community_id uuid;
  v_new_npc_id uuid;
BEGIN
  -- Only fire on the pending → accepted transition. Decline paths
  -- and late re-edits of the row are ignored.
  IF NOT (OLD.status = 'pending' AND NEW.status = 'accepted') THEN
    RETURN NEW;
  END IF;

  -- If the source NPC was deleted between offer and acceptance,
  -- there's nothing left to clone. Leave status=accepted so the
  -- offerer's notification still fires, but skip the copy.
  IF NEW.source_npc_id IS NULL THEN
    RAISE NOTICE 'community_migration % accepted but source_npc_id is NULL - skipping auto-copy', NEW.id;
    RETURN NEW;
  END IF;

  -- Resolve the target campaign + community from the world row.
  -- If the world row is missing (force-unpublished since the offer
  -- was made), bail.
  SELECT wc.source_campaign_id, wc.source_community_id
    INTO v_target_campaign_id, v_target_community_id
  FROM public.world_communities wc
  WHERE wc.id = NEW.target_world_community_id;

  IF v_target_campaign_id IS NULL OR v_target_community_id IS NULL THEN
    RAISE NOTICE 'community_migration % accepted but target world_community % resolved no campaign/community', NEW.id, NEW.target_world_community_id;
    RETURN NEW;
  END IF;

  BEGIN
    -- Clone the NPC into the target campaign. SELECT ... from the
    -- source row so we get every live column without having to
    -- list them; only overwrite fields that must be different:
    --   * campaign_id = target
    --   * campaign_pin_id = null (the old pin doesn't exist in the
    --     target campaign; leaves the NPC unpinned until the target
    --     GM parks them somewhere)
    --   * wp_current / rp_current reset to their max (fresh start)
    --   * status = 'active'
    --   * sort_order = 9999 (lands at the bottom of the roster)
    INSERT INTO public.campaign_npcs (
      campaign_id, campaign_pin_id, name,
      reason, acumen, physicality, influence, dexterity,
      skills, equipment, notes, motivation,
      portrait_url, npc_type,
      wp_max, rp_max, wp_current, rp_current,
      status, sort_order
    )
    SELECT
      v_target_campaign_id, NULL, name,
      reason, acumen, physicality, influence, dexterity,
      skills, equipment, notes, motivation,
      portrait_url, npc_type,
      wp_max, rp_max, wp_max, rp_max,
      'active', 9999
    FROM public.campaign_npcs
    WHERE id = NEW.source_npc_id
    RETURNING id INTO v_new_npc_id;

    IF v_new_npc_id IS NULL THEN
      RAISE NOTICE 'community_migration % - source NPC % no longer exists', NEW.id, NEW.source_npc_id;
      RETURN NEW;
    END IF;

    -- Insert the target community_members row. Refugee migrants
    -- join as Convert-type (voluntary, seeking shelter / shared
    -- purpose). Role starts unassigned so the target's rebalancer
    -- can place them on next run. Status explicit 'active' so we
    -- don't trip the pending-default schema gap (same pattern as
    -- schism fix in 9182fc9).
    INSERT INTO public.community_members (
      community_id, npc_id, role, recruitment_type, status, joined_at
    )
    VALUES (
      v_target_community_id, v_new_npc_id, 'unassigned', 'convert', 'active', now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'community_migration % auto-copy failed: % (status still accepted)', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_thriver()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  -- profiles.role is auto-lowercased by trg_normalize_role (see
  -- tasks/lessons.md), so compare against 'thriver' (lowercase).
  -- The original 'Thriver' check silently no-op'd every godmode
  -- policy - fixed by sql/thriver-role-case-fix.sql.
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'thriver'
  );
$function$;

CREATE OR REPLACE FUNCTION public.loot_npc_item(p_npc_id uuid, p_character_id uuid, p_item_name text, p_item_custom boolean DEFAULT false, p_qty integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  --    SECURITY DEFINER so we bypass it - the campaign-membership
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
    -- Append a fresh entry - keep the source item's metadata
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
    '🎒 ' || v_pc.name || ' searched the corpse of ' || v_npc.name ||
      ' and looted ' || p_item_name ||
      case when v_take > 1 then ' ×' || v_take else '' end,
    0, 0, 0, 0, 0, 0, 'loot'
  );

  return jsonb_build_object('ok', true, 'taken', v_take);
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_community_milestone()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_community_id uuid;
  v_count int;
  v_already_notified boolean;
  v_leader_user_id uuid;
  v_community_name text;
  v_has_status boolean;
BEGIN
  -- Which community are we evaluating? For DELETEs this would be OLD,
  -- but we don't trigger on DELETE (a community shrinking back below
  -- 13 stays a community in-fiction; no un-notify).
  v_community_id := NEW.community_id;

  -- Pull the community row + flag. Bail early if already notified
  -- so we don't do the expensive count.
  SELECT leader_user_id, name, notified_community_milestone
    INTO v_leader_user_id, v_community_name, v_already_notified
  FROM public.communities
  WHERE id = v_community_id;

  IF v_already_notified IS TRUE THEN
    RETURN NEW;
  END IF;

  -- Detect whether community_members.status exists (migration may or
  -- may not have landed); count active members accordingly.
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_members'
      AND column_name = 'status'
  ) INTO v_has_status;

  IF v_has_status THEN
    SELECT count(*) INTO v_count
    FROM public.community_members
    WHERE community_id = v_community_id
      AND left_at IS NULL
      AND COALESCE(status, 'active') = 'active';
  ELSE
    SELECT count(*) INTO v_count
    FROM public.community_members
    WHERE community_id = v_community_id
      AND left_at IS NULL;
  END IF;

  IF v_count >= 13 AND v_leader_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      v_leader_user_id,
      'community_milestone',
      'Your group is now a Community',
      COALESCE(v_community_name, 'Your group') || ' has grown to ' || v_count || ' members - it''s officially a Community now.',
      '/communities'
    );

    UPDATE public.communities
    SET notified_community_milestone = true
    WHERE id = v_community_id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_world_community_deletion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF OLD.published_by IS NULL THEN
    RETURN OLD;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (
    OLD.published_by,
    'world_community_deleted',
    '🗑 Community unpublished',
    'A Thriver removed your published community "' || OLD.name
    || '" from the Distemperverse. The source campaign community is untouched - '
    || 'you can re-publish from the Community ▾ → Status panel if you want it back on the world map.',
    '/communities/' || OLD.source_community_id::text,
    jsonb_build_object(
      'world_community_id', OLD.id,
      'source_community_id', OLD.source_community_id,
      'name', OLD.name,
      'prior_moderation_status', OLD.moderation_status
    )
  );
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_world_community_public_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_editor_username text;
  v_field_changes text[] := ARRAY[]::text[];
BEGIN
  -- Don't fire on moderation transitions - the moderation notifier
  -- handles those. A moderation flip also usually lands at the same
  -- instant as approved_by/approved_at; suppress those too.
  IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status THEN
    RETURN NEW;
  END IF;

  -- Collect which fields changed so the notification body can
  -- summarize. Only count the public-facing ones.
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    v_field_changes := array_append(v_field_changes, 'name');
  END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    v_field_changes := array_append(v_field_changes, 'description');
  END IF;
  IF NEW.faction_label IS DISTINCT FROM OLD.faction_label THEN
    v_field_changes := array_append(v_field_changes, 'faction');
  END IF;
  IF NEW.size_band IS DISTINCT FROM OLD.size_band THEN
    v_field_changes := array_append(v_field_changes, 'size');
  END IF;
  IF NEW.community_status IS DISTINCT FROM OLD.community_status THEN
    v_field_changes := array_append(v_field_changes, 'status');
  END IF;
  IF NEW.homestead_lat IS DISTINCT FROM OLD.homestead_lat
     OR NEW.homestead_lng IS DISTINCT FROM OLD.homestead_lng THEN
    v_field_changes := array_append(v_field_changes, 'homestead');
  END IF;

  -- No visible change? Skip. (Covers bookkeeping-only UPDATEs like
  -- last_public_update_at without other changes, or pure
  -- approved_by / approved_at touches.)
  IF cardinality(v_field_changes) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT username INTO v_editor_username
    FROM public.profiles WHERE id = NEW.published_by;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  SELECT p.id,
    'world_community_updated',
    '✎ Community updated',
    COALESCE(v_editor_username, 'Someone') || ' updated public info on "'
      || NEW.name || '" ('
      || array_to_string(v_field_changes, ', ') || ').',
    '/map',
    jsonb_build_object(
      'world_community_id', NEW.id,
      'source_community_id', NEW.source_community_id,
      'fields_changed', v_field_changes
    )
  FROM public.profiles p
  WHERE p.role = 'thriver'
    AND p.id IS DISTINCT FROM NEW.published_by;

  RETURN NEW;
END;
$function$;

