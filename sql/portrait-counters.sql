-- ============================================================
-- Portrait Counters for /tools/portrait-resizer
-- Tracks global count of male/female NPC portraits downloaded.
-- Atomic increment via RPC so concurrent downloads don't clash.
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================

-- ── 1. Counter table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.portrait_counters (
  gender text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0
);

INSERT INTO public.portrait_counters (gender, count) VALUES ('man', 0), ('woman', 0)
  ON CONFLICT (gender) DO NOTHING;

-- ── 2. Allow reading counts (anyone, including ghosts) ──────
ALTER TABLE public.portrait_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads portrait counters" ON public.portrait_counters;
CREATE POLICY "Anyone reads portrait counters"
  ON public.portrait_counters FOR SELECT TO anon, authenticated
  USING (true);

-- ── 3. Atomic increment RPC ─────────────────────────────────
-- SECURITY DEFINER so ghosts/unauthenticated users can call it
-- without needing UPDATE policy on the table.
CREATE OR REPLACE FUNCTION public.increment_portrait_counter(g text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  IF g NOT IN ('man', 'woman') THEN
    RAISE EXCEPTION 'invalid gender: %', g;
  END IF;
  UPDATE public.portrait_counters
    SET count = count + 1
    WHERE gender = g
    RETURNING count INTO new_count;
  RETURN new_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_portrait_counter(text) TO anon, authenticated;
