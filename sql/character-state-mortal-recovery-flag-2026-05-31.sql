-- Gap C: post-mortal slow WP regen must persist until fully healed.
--
-- Canon (/rules/combat/incapacitation #healing): a character who WAS
-- mortally wounded regens 1 WP per 2 days "until fully recovered" (back at
-- wp_max). Today the Rest modal infers "was mortal" from wp_current === 0,
-- so the instant a stabilised patient rises to 1 WP the next rest flips them
-- to the fast 1/day rate - undercutting the canon (slow recovery is the COST
-- of going mortal; it should persist through the whole healing cycle).
--
-- Fix: a persistent flag, maintained by a trigger so EVERY write path that
-- can zero or restore WP (gm_apply_damage RPC, manual dot-clicks, rest,
-- streaming heals) keeps it correct - no per-call-site hooks.
--
-- APPLIED LIVE 2026-06-01 (Xero-authorized). Verified in catalog: column
-- recovering_from_mortal_wound (boolean, default false) on character_states,
-- function trg_maintain_mortal_recovery_flag, trigger
-- maintain_mortal_recovery_flag all present. Mirrored into
-- sql/_baseline/schema.sql. Applied with:
--   npx supabase db query --linked -f sql/character-state-mortal-recovery-flag-2026-05-31.sql
--
-- Backward-compatible: additive column with a default; the BEFORE UPDATE
-- trigger only ever touches the new column. No em/en-dashes (live function
-- body rule).

-- 1. The flag. Defaults false; backfill leaves existing rows healthy unless
--    they are currently at 0 WP (those are mid-mortal already - set true so
--    they start the slow track).
ALTER TABLE character_states
  ADD COLUMN IF NOT EXISTS recovering_from_mortal_wound boolean NOT NULL DEFAULT false;

UPDATE character_states
  SET recovering_from_mortal_wound = true
  WHERE wp_current = 0 AND recovering_from_mortal_wound = false;

-- 2. Trigger function. Set the flag true the moment WP reaches 0; clear it
--    only once WP is restored to full. Between 0 and max the flag is left
--    untouched, so it persists across stabilisation + partial heals.
CREATE OR REPLACE FUNCTION trg_maintain_mortal_recovery_flag()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.wp_current = 0 THEN
    NEW.recovering_from_mortal_wound := true;
  ELSIF NEW.wp_current >= NEW.wp_max THEN
    NEW.recovering_from_mortal_wound := false;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Wire it. BEFORE UPDATE so the flag is set in the same row write (no
--    second UPDATE, no extra round trip). Fires only when wp_current
--    actually changes, to keep it off the hot path for unrelated updates.
DROP TRIGGER IF EXISTS maintain_mortal_recovery_flag ON character_states;
CREATE TRIGGER maintain_mortal_recovery_flag
  BEFORE UPDATE OF wp_current ON character_states
  FOR EACH ROW
  EXECUTE FUNCTION trg_maintain_mortal_recovery_flag();

-- After apply, the app side (separate HP commit) reads
-- localState.recovering_from_mortal_wound in lib/rest.ts's wasMortal instead
-- of (wp_current === 0 || death_countdown != null), and database.types.ts
-- gets the new column added by hand.
