-- gm-apply-damage-rpc-v2-infection-2026-05-30.sql
--
-- v2 of gm_apply_damage: adds the optional 5th arg p_infection_risk boolean
-- DEFAULT false. When true AND target is 'pc' AND damage crosses the target
-- to WP=0 (the mortal-wound entry), the inserted roll_log row's damage_json
-- carries an "infection_risk":true flag alongside the existing via='gm_apply'
-- + target_kind + before/after fields. Unblocks the end-of-combat
-- infection-modal assertion in combat-flow #10 Phase C.
--
-- E2E ask + Xero greenlight: tasks/active-lanes.md "Puffer Fish" focus block
-- ASK FOR PUFFER FISH [XERO GREENLIT 2026-05-30, E2E ask]. Mirrors the v1
-- pattern (sql/gm-apply-damage-rpc-2026-05-30.sql, APPLIED LIVE 2026-05-30).
--
-- DROP-then-REPLACE on the 4-arg overload: CREATE OR REPLACE matches only
-- identical signatures, so adding a 5th arg would leave the 4-arg version
-- dangling as a separate overload. Dropping it first keeps the function
-- signature unique in pg_catalog. Existing 4-arg E2E callers (Phase A
-- 5f6e3eb / Phase C 2306181) continue to work unchanged because the 5th
-- arg's DEFAULT false fills in for them - their behavior is byte-identical
-- to before this change (no infection_risk in damage_json).
--
-- *** APPLIED LIVE 2026-05-30 *** by Puffer with Xero's standing greenlight
-- on the active-lanes board. Reapply / replay (idempotent):
--   npx supabase db query --linked -f sql/gm-apply-damage-rpc-v2-infection-2026-05-30.sql

DROP FUNCTION IF EXISTS public.gm_apply_damage(uuid, text, uuid, integer);

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
  v_uid            uuid := auth.uid();
  v_is_gm          boolean;
  v_wp_before      integer;
  v_wp_after       integer;
  v_stress_before  integer;
  v_stress_after   integer;
  v_target_name    text;
  v_crossed_zero   boolean := false;
  v_damage_json    jsonb;
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
    -- mortal-wound entry: just crossed FROM >0 TO 0
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
    -- NPC path
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

    -- NPCs do not take stress per canon (memory: project_stress_on_mortal_incap)
    v_stress_before := NULL;
    v_stress_after  := NULL;
    -- NPCs are not in the PC infection class either; the flag only applies to
    -- the PC mortal-wound entry per CRB Ch9 Wound Infection (memory: project_
    -- infection_canon). Leave v_crossed_zero=false for NPCs even if they did
    -- cross zero; the flag below gates on (kind='pc' AND crossed).
  END IF;

  -- Build damage_json. Start with the v1 shape; conditionally add
  -- infection_risk so v1 callers see the IDENTICAL byte shape they did before.
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

  INSERT INTO roll_log (
    campaign_id, user_id, character_name, label, target_name, damage_json
  ) VALUES (
    p_campaign_id, v_uid, 'GM', 'GM Apply Damage', v_target_name, v_damage_json
  );

  RETURN jsonb_build_object(
    'target_kind',     p_target_kind,
    'target_id',       p_target_id,
    'wp_before',       v_wp_before,
    'wp_after',        v_wp_after,
    'stress_before',   v_stress_before,
    'stress_after',    v_stress_after,
    'infection_risk',  COALESCE(p_infection_risk, false) AND p_target_kind = 'pc' AND v_crossed_zero
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gm_apply_damage(uuid, text, uuid, integer, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- E2E CONTRACT (Playwright lane, combat-flow #10 Phase C end-of-combat
-- infection-modal slice):
--   const { data } = await supabase.rpc('gm_apply_damage', {
--     p_campaign_id:    campaignId,
--     p_target_kind:    'pc',
--     p_target_id:      targetCharacterId,
--     p_wp_damage:      wpMax,             // force mortal-wound entry
--     p_infection_risk: true,
--   })
--   // Assert: latest roll_log row's damage_json->>'infection_risk' = 'true'
--   //         AND data->>'infection_risk' = 'true' (mirror in RPC return).
--   // Then close combat and assert the infection-modal renders on the OWNER's
--   // client only (separate refetch / DOM assertion).
-- Negative cases:
--   - p_infection_risk=true on an NPC target -> NO infection_risk field set
--     (gated on target_kind='pc').
--   - p_infection_risk=true on a PC that did NOT cross to WP=0 -> NO
--     infection_risk field set (gated on the crossing).
--   - Omitting p_infection_risk -> 4-arg-equivalent behavior, byte-identical
--     damage_json shape to the v1 RPC (Phase A/C green continues unchanged).
