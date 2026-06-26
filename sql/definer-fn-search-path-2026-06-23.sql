-- S1 from supabase-advisor-triage-2026-06-23.md: pin search_path on every
-- SECURITY DEFINER function in public that has a mutable search_path (lint 0011).
--
-- A definer function runs as its owner (elevated); a mutable search_path lets a
-- user shadow an unqualified object reference and hijack the elevated execution.
-- (Not exploitable today - anon/authenticated lack CREATE on public - but a cheap
-- pre-Beta-500 hardening that clears the linter.)
--
-- `public, extensions` is non-breaking: unqualified public table refs still
-- resolve, extension functions (if any) still resolve, qualified refs (auth.*,
-- etc.) are unaffected, and a schema that doesn't exist is silently ignored.
-- NOT `= ''` (would break unqualified refs across 33 bodies).
--
-- Catalog-driven so signatures (incl. overloads) are handled automatically.
-- Idempotent: re-running skips functions that already have search_path set.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) c
        WHERE c LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', r.sig);
  END LOOP;
END $$;
