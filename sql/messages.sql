-- messages.sql
-- Platform messaging: DMs between users.
-- Three tables: conversations (thread), conversation_participants (who's in it),
-- messages (the actual content). A Postgres SECURITY DEFINER function handles
-- the get-or-create DM pattern so RLS doesn't need to allow arbitrary inserts.

-- ── conversations ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_created
  ON public.conversations(created_at DESC);

-- ── conversation_participants ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  last_read_at    timestamptz,
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cp_user
  ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_cp_conversation
  ON public.conversation_participants(conversation_id);

-- ── messages ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body            text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON public.messages(conversation_id, created_at ASC);

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.conversations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages                 ENABLE ROW LEVEL SECURITY;

-- conversations: visible if you're a participant
DROP POLICY IF EXISTS "conv_select" ON public.conversations;
CREATE POLICY "conv_select" ON public.conversations
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()
  )
);

-- participants: visible if you share the conversation
DROP POLICY IF EXISTS "cp_select" ON public.conversation_participants;
CREATE POLICY "cp_select" ON public.conversation_participants
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp2
    WHERE cp2.conversation_id = conversation_participants.conversation_id
      AND cp2.user_id = auth.uid()
  )
);

-- participants: users can update their own last_read_at
DROP POLICY IF EXISTS "cp_update_self" ON public.conversation_participants;
CREATE POLICY "cp_update_self" ON public.conversation_participants
FOR UPDATE USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- messages: readable if participant
DROP POLICY IF EXISTS "msg_select" ON public.messages;
CREATE POLICY "msg_select" ON public.messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
  )
);

-- messages: insertable if participant
DROP POLICY IF EXISTS "msg_insert" ON public.messages;
CREATE POLICY "msg_insert" ON public.messages
FOR INSERT WITH CHECK (
  sender_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
  )
);

-- ── get_or_create_dm ──────────────────────────────────────────────
-- Returns the id of the DM conversation between the caller and
-- other_user_id, creating it (and both participant rows) if it doesn't
-- exist. SECURITY DEFINER so it can insert participants for both users
-- without requiring a permissive INSERT policy on that table.
CREATE OR REPLACE FUNCTION public.get_or_create_dm(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_id uuid;
BEGIN
  -- Find an existing 1:1 conversation between the two users (exactly 2 participants).
  SELECT cp1.conversation_id INTO conv_id
  FROM   conversation_participants cp1
  JOIN   conversation_participants cp2
         ON  cp2.conversation_id = cp1.conversation_id
         AND cp2.user_id = other_user_id
  WHERE  cp1.user_id = auth.uid()
    AND  (SELECT COUNT(*) FROM conversation_participants cp3
          WHERE cp3.conversation_id = cp1.conversation_id) = 2
  LIMIT 1;

  IF conv_id IS NULL THEN
    INSERT INTO conversations DEFAULT VALUES RETURNING id INTO conv_id;
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (conv_id, auth.uid()), (conv_id, other_user_id);
  END IF;

  RETURN conv_id;
END;
$$;

-- Grant execute to authenticated users.
REVOKE ALL ON FUNCTION public.get_or_create_dm(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm(uuid) TO authenticated;
