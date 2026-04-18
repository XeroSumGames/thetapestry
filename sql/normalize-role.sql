-- ============================================================
-- Normalize profiles.role to lowercase
-- Prevents case-sensitivity bugs across the codebase.
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================

-- 1. Drop the old check constraint that enforces capitalized values
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Add new check constraint allowing lowercase values
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('survivor', 'thriver'));

-- 3. Backfill: lowercase all existing roles
UPDATE public.profiles SET role = LOWER(role) WHERE role != LOWER(role);

-- 2. Trigger: auto-lowercase on insert/update
CREATE OR REPLACE FUNCTION public.normalize_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.role := LOWER(NEW.role);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_role ON public.profiles;
CREATE TRIGGER trg_normalize_role
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_profile_role();
