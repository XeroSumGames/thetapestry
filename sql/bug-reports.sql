-- bug-reports.sql
-- User-submitted bug reports with email alert to Xero on every insert.
-- Surfaces via the 🐛 button in the sidebar's icon row; users describe
-- what broke + what they expected; we capture the URL they were on +
-- their browser UA + a server timestamp. Trigger fans out to the
-- notify-thriver edge function so the email lands in
-- xerosumstudio@gmail.com instantly.
--
-- RLS:
--   SELECT — Thrivers only (this is GM-side moderation data)
--   INSERT — any authenticated user (and ghost guests; they may have
--            no auth.uid() but should still be able to report bugs)
--   UPDATE / DELETE — Thriver only
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.bug_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_email  text,                       -- denormalized in case the user is later deleted
  reporter_name   text,                       -- profiles.username at submit time
  page_url        text,                       -- where the bug happened
  description     text NOT NULL,
  user_agent      text,
  status          text NOT NULL DEFAULT 'open',  -- 'open' | 'triaged' | 'fixed' | 'wontfix'
  thriver_notes   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_created
  ON public.bug_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status
  ON public.bug_reports (status, created_at DESC);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bug_reports_select ON public.bug_reports;
CREATE POLICY bug_reports_select ON public.bug_reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

DROP POLICY IF EXISTS bug_reports_insert ON public.bug_reports;
CREATE POLICY bug_reports_insert ON public.bug_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    -- A logged-in user inserts their own row, OR an unauthenticated
    -- guest can leave reporter_id null. Either way, we trust the
    -- description text — bots are an edge case, not a launch blocker.
    reporter_id IS NULL OR reporter_id = auth.uid()
  );

DROP POLICY IF EXISTS bug_reports_update ON public.bug_reports;
CREATE POLICY bug_reports_update ON public.bug_reports
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

DROP POLICY IF EXISTS bug_reports_delete ON public.bug_reports;
CREATE POLICY bug_reports_delete ON public.bug_reports
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

-- updated_at maintenance.
CREATE OR REPLACE FUNCTION public.bug_reports_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_bug_reports_touch ON public.bug_reports;
CREATE TRIGGER trg_bug_reports_touch
BEFORE UPDATE ON public.bug_reports
FOR EACH ROW EXECUTE FUNCTION public.bug_reports_touch_updated_at();

-- Email-alert trigger. Fans out via call_notify_thriver (the existing
-- pg_net wrapper that posts to the notify-thriver edge function).
-- Subject / body match what notify-thriver renders into the email.
CREATE OR REPLACE FUNCTION public.notify_bug_report()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_who text;
BEGIN
  v_who := COALESCE(NEW.reporter_name, NEW.reporter_email, 'an unknown user');
  PERFORM public.call_notify_thriver(
    'bug_report',
    '🐛 New bug report from ' || v_who,
    'Page: ' || COALESCE(NEW.page_url, '(unknown)') || E'\n\n' ||
    'Description:' || E'\n' || NEW.description || E'\n\n' ||
    'User-Agent: ' || COALESCE(NEW.user_agent, '(unknown)'),
    NEW.page_url
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_bug_reports_notify ON public.bug_reports;
CREATE TRIGGER trg_bug_reports_notify
AFTER INSERT ON public.bug_reports
FOR EACH ROW EXECUTE FUNCTION public.notify_bug_report();

NOTIFY pgrst, 'reload schema';
