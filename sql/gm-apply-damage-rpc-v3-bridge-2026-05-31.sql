-- gm-apply-damage-rpc-v3-bridge-2026-05-31.sql
--
-- v3 of gm_apply_damage: closes the infection_risk bridge gap E2E found.
-- When p_infection_risk=true AND target is 'pc' AND damage crosses to WP=0
-- (mortal-wound entry), the RPC now ALSO inserts a sibling roll_log row
-- with outcome='wound_infection_warning' so the existing RollsFeed banner
-- (`components/RollsFeed.tsx:433-447`, the orange "Wound Infection
-- Warning" amber-border render) lights up automatically - same source of
-- truth as `maybeLogWoundInfection` in the in-combat attack handler
-- (`app/stories/[id]/table/page.tsx:4661`).
--
-- E2E ask + Xero greenlight: `tasks/finding-infection-risk-app-bridge-
-- 2026-05-30.md` Option A (preferred). The previous v2 wrote the flag in
-- damage_json but nothing in the app read it; this v3 makes the flag
-- atomic with the user-visible warning row, no client wiring needed.
--
-- Signature unchanged (same 5 args) -> CREATE OR REPLACE replaces in
-- place; no DROP needed. Existing E2E Phase A/C callers byte-identical:
-- they don't pass p_infection_risk so the new branch never fires.
--
-- DEDUP (mirrors maybeLogWoundInfection's logic at the DB):
-- only insert the wound_infection_warning row if NO prior warning exists
-- for this campaign + target_name since the most recent OUTCOME='combat_start'
-- row. Covers the case where (a) GM calls gm_apply_damage twice on the
-- same target in the same combat, or (b) the in-combat attack handler
-- already wrote a warning and the GM then RPCs damage. Either way: one
-- warning per target per combat, the canon rule.
--
-- The row shape mirrors maybeLogWoundInfection exactly:
--   character_name = resolved target_name
--   label = '<name> is wounded and may have to deal with infection'
--   outcome = 'wound_infection_warning'
--   die1/die2/amod/smod/cmod/total = 0
--   damage_json = NULL (banner does not read it)
--
-- *** APPLIED LIVE 2026-05-31 *** by Puffer with Xero's standing greenlight
-- on the active-lanes board. Reapply / replay (idempotent):
--   npx supabase db query --linked -f sql/gm-apply-damage-rpc-v3-bridge-2026-05-31.sql

CREATE OR REPLACE FUNCTION public.gm_apply_damage(
  p_campaign_id     uuid,
  p_target_kind     text,        -- 'pc' | 'npc'
  p_target_id       uuid,        -- character_id for 'pc', campaign_npcs.id for 'npc'
  p_wp_damage       integer,
  p_infection_risk  boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid                  uuid := auth.uid();
  v_is_gm                boolean;
  v_wp_before            integer;
  v_wp_after             integer;
  v_stress_before        integer;
  v_stress_after         integer;
  v_target_name          text;
  v_crossed_zero         boolean := false;
  v_damage_json          jsonb;
  v_combat_start_at      timestamptz;
  v_warning_already      boolean;
  v_warning_inserted     boolean := false;
BEGIN
  -- input checks
  IF p_campaign_id IS NULL OR p_target_id IS NULL THEN
    RAISE EXCEPTION 'campaign_id and target_id required';
  END IF;
  IF p_wp_damage IS NULL OR p_wp_damage < 1 THEN
    RAISE EXCEPTION 'wp_damage must be >= 1';
  END IF;
  IF p_target_kind NOT IN ('pc','npc') THEN
    RAISE EXCEPTION 'target_kind must be pc or npc';
  END IF;

  -- authz: caller is the campaign GM
  SELECT EXISTS (
    SELECT 1 FROM campaigns WHERE id = p_campaign_id AND gm_user_id = v_uid
  ) INTO v_is_gm;
  IF NOT COALESCE(v_is_gm, false) THEN
    RAISE EXCEPTION 'not authorized: caller is not the GM of this campaign';
  END IF;

  IF p_target_kind = 'pc' THEN
    SELECT wp_current, stress
      INTO v_wp_before, v_stress_before
      FROM character_states
     WHERE campaign_id = p_campaign_id AND character_id = p_target_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'character_states row not found for character % in campaign % (initialize state first)', p_target_id, p_campaign_id;
    END IF;

    SELECT name INTO v_target_name FROM characters WHERE id = p_target_id;

    v_wp_after := GREATEST(0, v_wp_before - p_wp_damage);
    v_stress_after := v_stress_before;
    IF v_wp_before > 0 AND v_wp_after = 0 THEN
      v_crossed_zero := true;
      v_stress_after := LEAST(5, COALESCE(v_stress_before, 0) + 1);
    END IF;

    UPDATE character_states
       SET wp_current = v_wp_after,
           stress     = v_stress_after,
           updated_at = now()
     WHERE campaign_id = p_campaign_id AND character_id = p_target_id;

  ELSE
    SELECT wp_current, name
      INTO v_wp_before, v_target_name
      FROM campaign_npcs
     WHERE id = p_target_id AND campaign_id = p_campaign_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'campaign_npcs row not found for id % in campaign %', p_target_id, p_campaign_id;
    END IF;
    v_wp_before := COALESCE(v_wp_before, 0);
    v_wp_after  := GREATEST(0, v_wp_before - p_wp_damage);

    UPDATE campaign_npcs
       SET wp_current = v_wp_after
     WHERE id = p_target_id AND campaign_id = p_campaign_id;

    v_stress_before := NULL;
    v_stress_after  := NULL;
  END IF;

  -- Build damage_json. v1 v2 callers see byte-identical shape (no
  -- infection_risk field) when the gate doesn't fire.
  v_damage_json := jsonb_build_object(
    'via',           'gm_apply',
    'target_kind',   p_target_kind,
    'target_id',     p_target_id,
    'wp_damage',     p_wp_damage,
    'wp_before',     v_wp_before,
    'wp_after',      v_wp_after,
    'stress_before', v_stress_before,
    'stress_after',  v_stress_after
  );
  IF COALESCE(p_infection_risk, false) AND p_target_kind = 'pc' AND v_crossed_zero THEN
    v_damage_json := v_damage_json || jsonb_build_object('infection_risk', true);
  END IF;

  -- audit row (existing v2 behavior)
  INSERT INTO roll_log (
    campaign_id, user_id, character_name, label, target_name, damage_json
  ) VALUES (
    p_campaign_id, v_uid, 'GM', 'GM Apply Damage', v_target_name, v_damage_json
  );

  -- NEW v3: bridge to the user-visible RollsFeed banner. Same gate as the
  -- damage_json.infection_risk flag (PC + crossed zero + flag passed),
  -- then dedup against the most-recent combat to avoid double-banners.
  IF COALESCE(p_infection_risk, false) AND p_target_kind = 'pc' AND v_crossed_zero THEN
    SELECT created_at
      INTO v_combat_start_at
      FROM roll_log
     WHERE campaign_id = p_campaign_id
       AND outcome = 'combat_start'
     ORDER BY created_at DESC
     LIMIT 1;

    SELECT EXISTS (
      SELECT 1 FROM roll_log
       WHERE campaign_id = p_campaign_id
         AND outcome = 'wound_infection_warning'
         AND character_name = v_target_name
         AND created_at >= COALESCE(v_combat_start_at, '1970-01-01'::timestamptz)
    ) INTO v_warning_already;

    IF NOT COALESCE(v_warning_already, false) THEN
      INSERT INTO roll_log (
        campaign_id, user_id, character_name, label,
        die1, die2, amod, smod, cmod, total, outcome
      ) VALUES (
        p_campaign_id, v_uid, v_target_name,
        v_target_name || ' is wounded and may have to deal with infection',
        0, 0, 0, 0, 0, 0, 'wound_infection_warning'
      );
      v_warning_inserted := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'target_kind',                p_target_kind,
    'target_id',                  p_target_id,
    'wp_before',                  v_wp_before,
    'wp_after',                   v_wp_after,
    'stress_before',              v_stress_before,
    'stress_after',               v_stress_after,
    'infection_risk',             COALESCE(p_infection_risk, false) AND p_target_kind = 'pc' AND v_crossed_zero,
    'wound_infection_warning',    v_warning_inserted
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gm_apply_damage(uuid, text, uuid, integer, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- E2E CONTRACT EXTENSION (Phase C bridge):
--   const { data } = await supabase.rpc('gm_apply_damage', {
--     p_campaign_id:    campaignId,
--     p_target_kind:    'pc',
--     p_target_id:      targetCharacterId,
--     p_wp_damage:      wpMax,
--     p_infection_risk: true,
--   })
-- Assertions newly enabled (on top of the v2 contract):
--   - data->>'wound_infection_warning' = 'true' (when flag + cross-to-zero
--     fire AND no prior warning exists for this target this combat).
--   - latest roll_log row for the campaign has outcome='wound_infection_warning'
--     + character_name=<target> + label='<target> is wounded and may have to
--     deal with infection'.
--   - RollsFeed renders the orange 'Wound Infection Warning' banner on the
--     target owner's client (DOM assertion - `🩸 Wound Infection Warning`
--     visible in the feed).
-- Dedup positive test:
--   - call gm_apply_damage(pc, wp_max, p_infection_risk=true) TWICE on the
--     same PC in the same combat -> only ONE wound_infection_warning row
--     present; data->>'wound_infection_warning' = 'true' on the first call,
--     'false' on the second.
