-- ============================================================
-- Portrait Bank — shared library of NPC/PC portraits
-- Populated by the /tools/portrait-resizer tool.
-- Used by: random NPC generator, character wizard picker.
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================

-- ── 1. Storage bucket ───────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
  VALUES ('portrait-bank', 'portrait-bank', true)
  ON CONFLICT (id) DO NOTHING;

-- Anyone can read portraits (bank is a shared community resource)
DROP POLICY IF EXISTS "Anyone reads portrait bank" ON storage.objects;
CREATE POLICY "Anyone reads portrait bank"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'portrait-bank');

-- Authenticated users can upload to the bank
DROP POLICY IF EXISTS "Users upload to portrait bank" ON storage.objects;
CREATE POLICY "Users upload to portrait bank"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'portrait-bank');

-- ── 2. Metadata table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.portrait_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer NOT NULL,
  gender text NOT NULL CHECK (gender IN ('man', 'woman')),
  url_256 text NOT NULL,
  url_56 text NOT NULL,
  url_32 text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gender, number)
);

CREATE INDEX IF NOT EXISTS portrait_bank_gender_idx ON public.portrait_bank (gender);

ALTER TABLE public.portrait_bank ENABLE ROW LEVEL SECURITY;

-- Anyone reads portraits (used by NPC gen + character picker, also by ghosts browsing)
DROP POLICY IF EXISTS "Anyone reads portrait bank metadata" ON public.portrait_bank;
CREATE POLICY "Anyone reads portrait bank metadata"
  ON public.portrait_bank FOR SELECT TO anon, authenticated
  USING (true);

-- Authenticated users can insert
DROP POLICY IF EXISTS "Users insert portrait bank metadata" ON public.portrait_bank;
CREATE POLICY "Users insert portrait bank metadata"
  ON public.portrait_bank FOR INSERT TO authenticated
  WITH CHECK (true);

-- ── 3. Random-pick RPC ─────────────────────────────────────
-- Returns 1 random portrait row for a gender, or null if none exist.
-- Used by random NPC generator and character picker.
CREATE OR REPLACE FUNCTION public.random_portrait(g text)
RETURNS TABLE (id uuid, number integer, gender text, url_256 text, url_56 text, url_32 text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, number, gender, url_256, url_56, url_32
  FROM public.portrait_bank
  WHERE portrait_bank.gender = g
  ORDER BY random()
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.random_portrait(text) TO anon, authenticated;
