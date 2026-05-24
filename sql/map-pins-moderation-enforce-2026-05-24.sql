-- map-pins-moderation-enforce-2026-05-24.sql
--
-- FIX for the 2026-05-24 security finding (MEDIUM):
--   tasks/security-finding-map-pins-moderation-2026-05-24.md
--   + Risk Register entry (tasks/debug-handoff.md Sec 1, RED).
--
-- *** NOT YET APPLIED TO LIVE. *** This is a bright line (RLS/trigger change
-- against prod) - apply ONLY on Xero's explicit go:
--   npx supabase db query --linked -f sql/map-pins-moderation-enforce-2026-05-24.sql
-- Columns/functions referenced verified against sql/_baseline/schema.sql
-- (map_pins.pin_type / .status, profiles.role, auth.uid()); NOT executed here.
--
-- BACKGROUND. World-map pin moderation (pending vs approved) is enforced ONLY
-- in the browser (MapView.tsx:948, QuickAddModal.tsx:236). There is no BEFORE
-- INSERT trigger on map_pins, and the INSERT RLS only checks user_id =
-- auth.uid() (+ suspension + rate limit) - it does NOT constrain status /
-- pin_type by role. The SELECT policy ("View pins") shows ANY status='approved'
-- pin to everyone (incl. anon), keyed on status, NOT pin_type. So a non-Thriver
-- can craft a direct REST insert with pin_type='gm', status='approved' and
-- publish a world-visible "GM" pin with zero moderation review.
--
-- This mirrors the campfire fix (enforce_moderation_on_insert,
-- sql/moderation-enforce-trigger-2026-05-17.sql) that closed the same bug class
-- for forum_threads / war_stories / lfg_posts. map_pins differs: no approved_by
-- / approved_at / campaign_id columns - so the rule keys off pin_type and the
-- private-vs-shared distinction instead of scope, and just sets pin_type/status.
--
-- THE RULE (a non-Thriver can NEVER produce pin_type='gm' or status='approved'):
--   Thriver           -> respect the client's values (Thrivers ARE the
--                        moderation layer; they publish gm/approved pins).
--   Non-Thriver:
--     pin_type='private' -> clamp status to 'active' (private pins are
--                        owner-only via SELECT; this blocks the private+
--                        'approved' leak path while leaving real private pins
--                        untouched - client already sends 'active').
--     anything else (gm / rumor / a world-share attempt) -> force
--                        pin_type='rumor', status='pending' (the moderation
--                        queue - exactly the legit non-Thriver client path).
--
-- Idempotent + additive (CREATE OR REPLACE + DROP TRIGGER IF EXISTS); existing
-- rows are unaffected. UPDATE is out of scope (handled by RLS separately) -
-- INSERT only, matching the campfire trigger.

CREATE OR REPLACE FUNCTION public.enforce_map_pin_moderation_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_thriver boolean;
BEGIN
  SELECT lower(role) = 'thriver' INTO v_is_thriver
    FROM public.profiles WHERE id = auth.uid();

  -- Thrivers are the moderation layer: respect their pin_type/status.
  IF COALESCE(v_is_thriver, false) THEN
    RETURN NEW;
  END IF;

  -- Non-Thrivers can never publish (gm) or self-approve.
  IF NEW.pin_type = 'private' THEN
    -- Genuine private pin: owner-only via SELECT. Block the private+approved
    -- leak by clamping status to 'active'; leave the rest as-is.
    NEW.status := 'active';
  ELSE
    -- Any shared/world pin attempt -> the moderation queue.
    NEW.pin_type := 'rumor';
    NEW.status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_map_pin_moderation ON public.map_pins;
CREATE TRIGGER trg_enforce_map_pin_moderation
  BEFORE INSERT ON public.map_pins
  FOR EACH ROW EXECUTE FUNCTION public.enforce_map_pin_moderation_on_insert();

NOTIFY pgrst, 'reload schema';

-- POST-APPLY verification (run as a non-Thriver; should land pending, not approved):
--   insert into map_pins (user_id, lat, lng, title, pin_type, status, category)
--   values (auth.uid(), 0, 0, 'evasion test', 'gm', 'approved', 'location')
--   returning pin_type, status;   -- expect: rumor / pending
-- The E2E lane mirrors this as a spec after the trigger lands.
