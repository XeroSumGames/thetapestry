-- Add CHECK constraint to enforce stress 0-5 range.
-- Current live data is clean (all values in 0-4), so no clamping needed.
ALTER TABLE character_states
  ADD CONSTRAINT check_stress_range CHECK (stress >= 0 AND stress <= 5);
