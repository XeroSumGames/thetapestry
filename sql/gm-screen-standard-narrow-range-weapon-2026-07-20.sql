-- Xero 2026-07-20: in the shared standard GM Screen layout, set Range Bands and
-- Weapon Condition to 50% width (424 -> 212) and stack them together in a single
-- left-hand column (range-bands above weapon-condition at x=0). Surgical jsonb
-- update to the one standard row; all other cards untouched.
--
-- Apply with:
--   npx supabase db query --linked -f sql/gm-screen-standard-narrow-range-weapon-2026-07-20.sql

UPDATE public.gm_screen_standard_layout
SET state = jsonb_set(
      jsonb_set(state, ARRAY['positions','range-bands'],      '{"x":0,"y":624,"w":212,"h":212}'::jsonb, true),
      ARRAY['positions','weapon-condition'], '{"x":0,"y":848,"w":212,"h":212}'::jsonb, true),
    updated_at = now()
WHERE id = 1;
