-- ============================================================
-- RPC: snap_token_to_seat
--
-- Problem: the vehicle popout's MOVE HERE button writes directly to
-- scene_tokens via supabase.from('scene_tokens').update(). The
-- "Players move own token" RLS policy only lets a player update their
-- OWN PC token (token_type='pc' AND character_id matches their
-- campaign_members.character_id). So when a non-GM player clicks
-- MOVE HERE on a seat assigned to someone else, the UPDATE is silently
-- rejected (0 rows affected) and the token never snaps. Players
-- working a vehicle popout need to be able to position ANY crew/passenger
-- token onto the vehicle's seat cells.
--
-- Fix: a narrow SECURITY DEFINER function that bypasses RLS for ONLY
-- this one operation. Caller must be a member of the scene's campaign
-- (GM or campaign_members row); function then performs the position
-- UPDATE on the specified PC or NPC token. Does not allow arbitrary
-- token updates - only repositioning a known assignee onto a seat
-- coordinate computed client-side.
--
-- Run in Supabase SQL Editor or `npx supabase db query --linked -f
-- sql/snap-token-to-seat-rpc-2026-05-17.sql`. Idempotent.
-- ============================================================

CREATE OR REPLACE FUNCTION snap_token_to_seat(
  p_scene_id uuid,
  p_assignee_id uuid,
  p_kind text,        -- 'pc' or 'npc'
  p_target_x int,
  p_target_y int
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id uuid;
  v_authorized boolean;
BEGIN
  -- Resolve scene to its campaign so we can authorize against members.
  SELECT campaign_id INTO v_campaign_id
  FROM tactical_scenes
  WHERE id = p_scene_id;

  IF v_campaign_id IS NULL THEN
    RAISE EXCEPTION 'snap_token_to_seat: scene % not found', p_scene_id;
  END IF;

  -- Authorize: GM of the campaign OR any campaign_members row for the
  -- calling user. Anyone with seat-popout access should qualify here.
  SELECT
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE id = v_campaign_id AND gm_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = v_campaign_id AND user_id = auth.uid()
    )
  INTO v_authorized;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'snap_token_to_seat: caller % is not a member of campaign %', auth.uid(), v_campaign_id;
  END IF;

  -- Perform the targeted UPDATE. Bypasses scene_tokens RLS via the
  -- SECURITY DEFINER context. We restrict the UPDATE to scene+assignee,
  -- so the worst a caller can do via this RPC is reposition a PC/NPC
  -- token onto the (x, y) they computed. They cannot edit other columns,
  -- delete tokens, or touch tokens outside the named scene.
  IF p_kind = 'pc' THEN
    UPDATE scene_tokens
    SET grid_x = p_target_x, grid_y = p_target_y
    WHERE scene_id = p_scene_id AND character_id = p_assignee_id;
  ELSIF p_kind = 'npc' THEN
    UPDATE scene_tokens
    SET grid_x = p_target_x, grid_y = p_target_y
    WHERE scene_id = p_scene_id AND npc_id = p_assignee_id;
  ELSE
    RAISE EXCEPTION 'snap_token_to_seat: invalid kind %', p_kind;
  END IF;
END;
$$;

-- Lock down the default PUBLIC EXECUTE grant; only logged-in users
-- can call this. (The auth check inside still gates by membership.)
REVOKE ALL ON FUNCTION snap_token_to_seat(uuid, uuid, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION snap_token_to_seat(uuid, uuid, text, int, int) TO authenticated;
