-- Fix: chat_messages INSERT had no campaign-membership check - any
-- authenticated user could inject a message into any campaign's live chat
-- feed without ever joining it. A properly-scoped policy was drafted in
-- sql/chat-whisper-rls.sql but its DROP list never targeted the actual live
-- policy name ("Authenticated can insert chat"), so the old unscoped policy
-- stayed in place and OR'd together with anything added alongside it.
--
-- This migration only closes the membership gap on INSERT. It does not
-- implement whisper-scoped SELECT (a separate privacy feature drafted in
-- chat-whisper-rls.sql) - that's out of scope for this fix.

BEGIN;

DROP POLICY IF EXISTS "Authenticated can insert chat" ON public.chat_messages;

CREATE POLICY "Campaign members can insert chat" ON public.chat_messages
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = chat_messages.campaign_id
        AND (c.gm_user_id = auth.uid() OR public.is_campaign_member(c.id))
    )
  );

COMMIT;
