-- RPC: toggle_wall_segment_door
--
-- Lets any campaign member (not just the GM) flip door_open on a single
-- wall segment in tactical_scenes.walls. Replaces the player-side
-- scheduleWallsPersist() call which was gated on isGM and silently
-- no-oped for non-GM players, producing cross-client LoS desync.
--
-- Security envelope: SECURITY DEFINER + explicit campaign_members check.
-- Same pattern as gm_apply_damage. A player who is NOT a member of the
-- scene's campaign cannot call this.
--
-- Usage:
--   SELECT toggle_wall_segment_door(
--     p_scene_id  := '<scene-uuid>',
--     p_segment_id := '<segment-string-id>',
--     p_open      := true
--   );
--
-- Apply: npx supabase db query --linked -f sql/toggle-wall-segment-door-2026-05-31.sql

CREATE OR REPLACE FUNCTION public.toggle_wall_segment_door(
  p_scene_id   uuid,
  p_segment_id text,
  p_open       boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id uuid;
BEGIN
  -- Resolve the scene to its campaign
  SELECT campaign_id INTO v_campaign_id
  FROM tactical_scenes
  WHERE id = p_scene_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'scene not found: %', p_scene_id;
  END IF;

  -- Membership gate: any campaign member may toggle doors/windows
  IF NOT EXISTS (
    SELECT 1 FROM campaign_members
    WHERE campaign_id = v_campaign_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not a member of campaign %', v_campaign_id;
  END IF;

  -- Read-modify-write: set door_open on the matching segment only.
  -- walls is jsonb NOT NULL DEFAULT '[]', so no COALESCE needed.
  UPDATE tactical_scenes
  SET walls = (
    SELECT jsonb_agg(
      CASE
        WHEN (elem->>'id') = p_segment_id
          THEN jsonb_set(elem, '{door_open}', to_jsonb(p_open))
        ELSE elem
      END
    )
    FROM jsonb_array_elements(walls) AS elem
  )
  WHERE id = p_scene_id;
END;
$$;

-- Allow every authenticated user to call this RPC; the body itself
-- enforces the campaign-member check.
GRANT EXECUTE ON FUNCTION public.toggle_wall_segment_door(uuid, text, boolean)
  TO authenticated;
