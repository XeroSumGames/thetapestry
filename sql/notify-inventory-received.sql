-- ── notify_inventory_received() RPC ──────────────────────
-- Insert a 'inventory_received' notification for the user who owns
-- target_character_id. Uses SECURITY DEFINER so cross-user inserts
-- bypass the notifications.user_id = auth.uid() RLS check (same
-- pattern as notify_community_encounter / player_joined triggers).
--
-- Idempotent (CREATE OR REPLACE). Re-run safely.
CREATE OR REPLACE FUNCTION public.notify_inventory_received(
  target_character_id uuid,
  item_name text,
  item_qty int,
  from_label text
)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
  v_target_char_name text;
BEGIN
  -- Resolve owner of the receiving character.
  SELECT user_id, name
    INTO v_user_id, v_target_char_name
    FROM public.characters
    WHERE id = target_character_id;

  -- No owner (orphaned / NPC character row), nothing to notify.
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Don't notify yourself if you somehow give to your own character.
  IF v_user_id = auth.uid() THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, metadata)
  VALUES (
    v_user_id,
    'inventory_received',
    'Item received',
    'You received ' || item_qty::text || '× ' || item_name
      || ' from ' || COALESCE(from_label, 'someone'),
    jsonb_build_object(
      'item_name', item_name,
      'qty', item_qty,
      'from_label', from_label,
      'target_character_id', target_character_id,
      'target_character_name', v_target_char_name
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.notify_inventory_received(uuid, text, int, text) TO authenticated;
