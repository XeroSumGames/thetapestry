-- messages-latest-rpc.sql
-- Single-round-trip "latest message per conversation" lookup. Replaces
-- the old N+1 in MessagesBell + /messages page that fired one
-- `messages.select(...).limit(1)` per conversation in Promise.all.
--
-- The function does NOT use SECURITY DEFINER — RLS on `messages` already
-- gates by auth.uid() membership in conversation_participants, so a plain
-- STABLE SQL function is the right shape. The DISTINCT ON / ORDER BY uses
-- the existing idx_messages_conversation index.

CREATE OR REPLACE FUNCTION public.get_latest_messages_for_conversations(conv_ids uuid[])
RETURNS TABLE (
  conversation_id uuid,
  body            text,
  created_at      timestamptz,
  sender_user_id  uuid
)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id, m.body, m.created_at, m.sender_user_id
  FROM   public.messages m
  WHERE  m.conversation_id = ANY(conv_ids)
  ORDER  BY m.conversation_id, m.created_at DESC;
$$;

REVOKE ALL    ON FUNCTION public.get_latest_messages_for_conversations(uuid[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_latest_messages_for_conversations(uuid[]) TO authenticated;
