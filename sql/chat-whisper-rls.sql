-- Whisper privacy RLS on chat_messages.
-- Only the sender and intended recipient can SELECT a whisper row.
-- Non-whisper rows are readable by any campaign member (existing membership policy still applies).

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop the old blanket read policy if it exists so we can replace it
DROP POLICY IF EXISTS "chat_messages_select" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_read" ON public.chat_messages;
DROP POLICY IF EXISTS "Campaign members can read chat" ON public.chat_messages;

-- Members of the campaign can read all non-whisper messages.
-- For whisper messages, only sender and recipient can read.
CREATE POLICY "chat_messages_select"
ON public.chat_messages
FOR SELECT
USING (
  -- Must be a member of the campaign (GM or accepted member)
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = chat_messages.campaign_id
      AND (
        c.gm_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.campaign_members cm
          WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid()
        )
      )
  )
  AND (
    -- Non-whispers: visible to all members
    is_whisper IS NOT TRUE
    OR
    -- Whispers: only sender or recipient
    user_id = auth.uid()
    OR recipient_user_id = auth.uid()
  )
);

-- INSERT: must be the user posting the message, must be a campaign member.
DROP POLICY IF EXISTS "chat_messages_insert" ON public.chat_messages;
CREATE POLICY "chat_messages_insert"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = chat_messages.campaign_id
      AND (
        c.gm_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.campaign_members cm
          WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid()
        )
      )
  )
);
