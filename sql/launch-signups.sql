-- Launch email capture (2026-07-24). "Notify me at launch" signups from the
-- Xero Sum Games sites land here via the public launch-signup edge function
-- (service role inserts; --no-verify-jwt). One row per (email, site). Thrivers
-- can read for a future list export.
CREATE TABLE IF NOT EXISTS public.launch_signups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  site       text,                 -- product they want (e.g. 'table')
  source     text,                 -- page/path they signed up from
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, site)
);

ALTER TABLE public.launch_signups ENABLE ROW LEVEL SECURITY;

-- Reads are Thriver-only (inserts happen via the edge function's service role,
-- which bypasses RLS). Mirrors the visitor_logs read policy.
DROP POLICY IF EXISTS "Thrivers read launch signups" ON public.launch_signups;
CREATE POLICY "Thrivers read launch signups" ON public.launch_signups
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'thriver'));

NOTIFY pgrst, 'reload schema';
