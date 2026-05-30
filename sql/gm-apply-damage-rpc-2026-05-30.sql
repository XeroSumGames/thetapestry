-- gm-apply-damage-rpc-2026-05-30.sql
--
-- Deterministic GM-driven damage trigger for the combat-flow (#10) E2E spec
-- (and convenient for a future GM "apply damage" admin button). See:
--   tasks/e2e-combat-flow-plan-2026-05-30.md  (Phase C unblocker)
--   tasks/finding-pc-trade-rls-dataloss-2026-05-24.md (the pattern this mirrors)
--
-- *** APPLIED LIVE 2026-05-30 *** by Puffer with Xero's go. Verified via
-- pg_proc: gm_apply_damage(uuid, text, uuid, integer), SECURITY DEFINER = true.
-- Reapply / replay (idempotent CREATE OR REPLACE):
--   npx supabase db query --linked -f sql/gm-apply-damage-rpc-2026-05-30.sql
--
-- Schemas verified against sql/_baseline/schema.sql:
--   character_states (PC):  wp_current int, wp_max int, stress int, user_id uuid
--   campaign_npcs (NPC):    wp_current int, wp_max int, name text
--   roll_log:               damage_json jsonb, campaign_id, user_id,
--                           character_name, label, target_name
-- Canon mirrored from lib/conditions.ts: STRESS_CAP = 5; nextStress = +1 capped.
-- Memory project_stress_on_mortal_incap: PC-only stress bump, on entering WP=0
-- (or RP=0; this RPC handles WP-only - RP/incap is a separate path not needed
-- for the #10 spec per tasks/e2e-combat-flow-plan-2026-05-30.md).
--
-- WHY AN RPC (mirrors give_item_to_character, the Option B from 2026-05-24):
-- a player must NOT be able to damage anyone, and a GM is not auto-authorized
-- to write `characters` or `character_states` directly today. Rather than
-- broadening RLS (a cheat hole), this SECURITY DEFINER fn does ONE narrow
-- thing - apply N WP damage to one target - with its own in-function authz.
-- Caller MUST be the campaign GM. Anything else RAISEs.
--
-- WHAT IT DOES (atomic, in one transaction):
--   1. Locks the target row FOR UPDATE.
--   2. wp_after = GREATEST(0, wp_before - p_wp_damage).
--   3. PC only: if we just crossed FROM >0 TO 0, stress = LEAST(5, stress+1).
--      (Matches lib/conditions.ts:nextStress + canon. NPCs do not take stress.)
--   4. Writes wp_current (+ stress for PC) to the target row.
--   5. Inserts a roll_log row with damage_json.via='gm_apply' so E2E + clients
--      can distinguish this from a real attack outcome.
--   6. Returns the before/after state as jsonb (RPC convenience).
--
-- WHAT IT DOES NOT DO (intentionally, for the #10 scope):
--   - RP damage / incap (separate path; not needed for combat-flow Phase C).
--   - Conditions pipeline beyond stress-on-mortal (no Bleeding, Stunned, etc.;
--     real attacks set those via the client's nextStress + clearedConditionFields
--     calls; out of scope here - the E2E spec asserts FLOW + structural shape).
--   - End-of-combat infection flag (when E2E needs to test the modal trigger,
--     extend this RPC with a `p_infection_risk boolean DEFAULT false` arg or
--     write a sibling `gm_set_infection_flag` RPC. Deferred.).
--   - Lasting wounds (NPC-only column; same deferral logic).
--
-- AUTHZ:
--   - auth.uid() must == campaigns.gm_user_id for p_campaign_id. No exceptions.
--   - Target must belong to p_campaign_id (campaign-scoping is a hard gate).

CREATE OR REPLACE FUNCTION public.gm_apply_damage(
  p_campaign_id uuid,
  p_target_kind text,          -- 'pc' | 'npc'
  p_target_id   uuid,          -- character_id for 'pc', campaign_npcs.id for 'npc'
  p_wp_damage   integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_is_gm         boolean;
  v_wp_before     integer;
  v_wp_after      integer;
  v_stress_before integer;
  v_stress_after  integer;
  v_target_name   text;
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
    -- PC path: character_states row keyed by (campaign_id, character_id)
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
    -- stress-on-mortal: if we just crossed FROM >0 TO 0, +1 stress (cap 5)
    IF v_wp_before > 0 AND v_wp_after = 0 THEN
      v_stress_after := LEAST(5, COALESCE(v_stress_before, 0) + 1);
    END IF;

    UPDATE character_states
       SET wp_current = v_wp_after,
           stress     = v_stress_after,
           updated_at = now()
     WHERE campaign_id = p_campaign_id AND character_id = p_target_id;

  ELSE
    -- NPC path: campaign_npcs row keyed by (id, campaign_id)
    SELECT wp_current, name
      INTO v_wp_before, v_target_name
      FROM campaign_npcs
     WHERE id = p_target_id AND campaign_id = p_campaign_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'campaign_npcs row not found for id % in campaign %', p_target_id, p_campaign_id;
    END IF;
    -- Treat NULL wp_current as 0 (NPC has not been touched yet but campaign_npcs
    -- allows it; safer than COALESCE-ing to wp_max since wp_max may also be NULL).
    v_wp_before := COALESCE(v_wp_before, 0);
    v_wp_after  := GREATEST(0, v_wp_before - p_wp_damage);

    UPDATE campaign_npcs
       SET wp_current = v_wp_after
     WHERE id = p_target_id AND campaign_id = p_campaign_id;

    -- NPCs do not take stress per canon.
    v_stress_before := NULL;
    v_stress_after  := NULL;
  END IF;

  -- audit / propagation row. damage_json.via='gm_apply' lets the client + E2E
  -- distinguish this from a real attack-result row.
  INSERT INTO roll_log (
    campaign_id, user_id, character_name, label, target_name, damage_json
  ) VALUES (
    p_campaign_id,
    v_uid,
    'GM',
    'GM Apply Damage',
    v_target_name,
    jsonb_build_object(
      'via',           'gm_apply',
      'target_kind',   p_target_kind,
      'target_id',     p_target_id,
      'wp_damage',     p_wp_damage,
      'wp_before',     v_wp_before,
      'wp_after',      v_wp_after,
      'stress_before', v_stress_before,
      'stress_after',  v_stress_after
    )
  );

  RETURN jsonb_build_object(
    'target_kind',   p_target_kind,
    'target_id',     p_target_id,
    'wp_before',     v_wp_before,
    'wp_after',      v_wp_after,
    'stress_before', v_stress_before,
    'stress_after',  v_stress_after
  );
END;
$$;

-- Logged-in users may call it; the in-function GM check is the real gate.
GRANT EXECUTE ON FUNCTION public.gm_apply_damage(uuid, text, uuid, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- E2E CONTRACT (Playwright lane - tasks/e2e-combat-flow-plan-2026-05-30.md Phase C):
--   const { data, error } = await supabase.rpc('gm_apply_damage', {
--     p_campaign_id: campaignId,
--     p_target_kind: 'pc',           // or 'npc'
--     p_target_id:   targetCharacterId,  // character_id for pc, campaign_npcs.id for npc
--     p_wp_damage:   wpMax,          // to force crossing to 0 for the stress-bump assertion
--   })
-- Assertions enabled (data-driven, REST-poll after the call):
--   - character_states.wp_current == 0
--   - character_states.stress == prev + 1 (capped at 5)
--   - roll_log latest row with target_name match + damage_json->>'via'='gm_apply'
--   - player-side: character_states sub fires a refetch on the owner's client
-- Negative tests:
--   - calling as a non-GM (player) -> RPC raises -> caught + assert error
--   - calling for a target outside the campaign -> raises 'not found'
