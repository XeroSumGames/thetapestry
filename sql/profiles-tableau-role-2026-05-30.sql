-- Multi-site role model (Xero 2026-05-30): Xero Sum Games is a multi-platform
-- VTT on one engine (the XSE). TheTapestry and TheTableau share user
-- identities (one auth.users row, one profiles row) but each site has its
-- own role taxonomy:
--
--   TheTapestry: profiles.role          = 'thriver' (super) | 'survivor' (base) | 'ghost'
--   TheTableau:  profiles.tableau_role  = 'director' (super) | 'operator' (base) | NULL
--                                         (NULL = no TheTableau account)
--
-- Earlier today an out-of-band UPDATE overwrote profiles.role with
-- 'director' / 'operator' (the TheTableau values), silently dropping every
-- thriver out of godmode on TheTapestry. The fix is to give each site its
-- own column + constraint so a write to one site's roles can never
-- collateral-damage the other.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tableau_role text;

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_tableau_role_canonical;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_tableau_role_canonical
  CHECK (tableau_role IS NULL OR tableau_role IN ('operator', 'director'));

COMMENT ON COLUMN profiles.role IS
  'TheTapestry role: thriver (super) | survivor (base) | ghost. NEVER director/operator - those are TheTableau (see tableau_role).';

COMMENT ON COLUMN profiles.tableau_role IS
  'TheTableau role: director (super) | operator (base) | NULL (no TheTableau account). NEVER thriver/survivor - those are TheTapestry (see role).';
