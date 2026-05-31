-- Lock profiles.role to the canonical taxonomy (AGENTS.md):
--   thriver  - app-level admin / godmode (RLS bypass via is_thriver())
--   survivor - standard user (player / GM)
--   ghost    - unauthenticated / suspended visibility tier
--
-- Backstory 2026-05-30: an out-of-band UPDATE renamed every profile to
-- 'director' (was thriver) and 'operator' (was survivor). Xero lost
-- godmode silently (is_thriver() hardcoded to 'thriver'), and
-- /moderate's "load users" 403'd. We restored the values; this
-- constraint makes the silent regression impossible going forward -
-- any future write to a non-canonical role hard-fails with PG 23514
-- and surfaces in the .update().then() error path immediately.

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_canonical;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_canonical
  CHECK (role IN ('thriver', 'survivor', 'ghost'));
