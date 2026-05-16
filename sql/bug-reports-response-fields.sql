-- Bug-report response fields. The Thriver can type a reply on the
-- /moderate Bug Reports page; the reply lands here AND fires a
-- notification to the original reporter (if they're authenticated).
-- Separate from `thriver_notes` (which stays an internal triage scratchpad).

ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS response_text text,
  ADD COLUMN IF NOT EXISTS responded_at  timestamptz,
  ADD COLUMN IF NOT EXISTS responded_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
