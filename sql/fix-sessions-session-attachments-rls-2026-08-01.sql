-- Fix: three wide-open sessions/session_attachments policies coexisted with
-- correctly-scoped near-duplicate-named ones. PERMISSIVE policies OR
-- together, so the wide-open ones alone were enough to leave every
-- operation unrestricted regardless of the scoped policies sitting next to
-- them. Two prior fix files (sessions-rls-fix.sql, security-hardening-
-- 2026-05-08.sql) targeted these same policies and apparently never landed
-- against these exact live policy names.
--
-- Verified against actual app usage before writing this: the only read
-- path (app/stories/[id]/sessions/page.tsx) is GM-only-gated at the page
-- level, and the only write paths (startSession/endSession in
-- app/stories/[id]/table/page.tsx) are both `if (!gmLike) return` gated.
-- So both tables are GM-only resources in practice - the fix below makes
-- that the actual server-side boundary instead of a client-side-only gate.

BEGIN;

-- sessions: drop the two wide-open policies. The correctly-scoped
-- "GMs can update sessions" (UPDATE), "GMs can delete sessions" (DELETE),
-- and "Sessions viewable by authenticated users" (SELECT, membership-OR-GM)
-- policies already exist and are untouched by this migration.
DROP POLICY IF EXISTS "GM can insert sessions" ON public.sessions;
DROP POLICY IF EXISTS "GM can update sessions" ON public.sessions;

CREATE POLICY "GMs can insert sessions" ON public.sessions
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = sessions.campaign_id AND c.gm_user_id = auth.uid()));

-- session_attachments: replace the single ALL/true policy with 4 scoped
-- ones (GM of the parent session's campaign only, matching actual usage).
DROP POLICY IF EXISTS "Authenticated users can manage session attachments" ON public.session_attachments;

CREATE POLICY "GM can select session attachments" ON public.session_attachments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sessions s JOIN public.campaigns c ON c.id = s.campaign_id
    WHERE s.id = session_attachments.session_id AND c.gm_user_id = auth.uid()
  ));

CREATE POLICY "GM can insert session attachments" ON public.session_attachments
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sessions s JOIN public.campaigns c ON c.id = s.campaign_id
    WHERE s.id = session_attachments.session_id AND c.gm_user_id = auth.uid()
  ));

CREATE POLICY "GM can update session attachments" ON public.session_attachments
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sessions s JOIN public.campaigns c ON c.id = s.campaign_id
    WHERE s.id = session_attachments.session_id AND c.gm_user_id = auth.uid()
  ));

CREATE POLICY "GM can delete session attachments" ON public.session_attachments
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sessions s JOIN public.campaigns c ON c.id = s.campaign_id
    WHERE s.id = session_attachments.session_id AND c.gm_user_id = auth.uid()
  ));

COMMIT;
