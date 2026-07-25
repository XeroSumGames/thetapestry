-- Issue reports (2026-07-24) from the free generators (and other XSG sites).
-- Captured via the public report-issue edge function; email is OPTIONAL.
-- Thriver-read for a future triage view.
CREATE TABLE IF NOT EXISTS public.issue_reports (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source     text,                 -- which generator/site (e.g. 'apegenerator')
  message    text NOT NULL,
  email      text,                 -- OPTIONAL contact-back address
  page_url   text,
  user_agent text,
  status     text NOT NULL DEFAULT 'open',   -- open | resolved
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.issue_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Thrivers read issue reports" ON public.issue_reports;
CREATE POLICY "Thrivers read issue reports" ON public.issue_reports
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'thriver'));

NOTIFY pgrst, 'reload schema';
