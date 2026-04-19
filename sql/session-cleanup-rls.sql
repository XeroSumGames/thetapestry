-- RLS DELETE policies so the campaign GM can wipe roll_log and chat_messages
-- on session start / session end. Without these, the startSession/endSession
-- deletes silently fail under default RLS and players see stale chat/logs.

ALTER TABLE public.roll_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- ── roll_log ──
DROP POLICY IF EXISTS "roll_log_delete_gm" ON public.roll_log;
CREATE POLICY "roll_log_delete_gm"
ON public.roll_log
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = roll_log.campaign_id AND c.gm_user_id = auth.uid()
  )
);

-- ── chat_messages ──
DROP POLICY IF EXISTS "chat_messages_delete_gm" ON public.chat_messages;
CREATE POLICY "chat_messages_delete_gm"
ON public.chat_messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = chat_messages.campaign_id AND c.gm_user_id = auth.uid()
  )
);
