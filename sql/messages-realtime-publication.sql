-- messages-realtime-publication.sql
-- Symptom: new DMs only appear after a manual page refresh; the bell badge
-- doesn't tick up live either. Both surfaces (app/messages/page.tsx and
-- components/MessagesBell.tsx) subscribe via supabase.channel(...).on(
-- 'postgres_changes', ...), which requires the table to be in the
-- supabase_realtime publication. Without that membership, Supabase silently
-- drops the events — RLS, channel name, and filters are irrelevant if the
-- publication doesn't include the table.
--
-- Fix: add public.messages (for live message inserts) and
-- public.conversation_participants (so the bell badge clears in realtime
-- when the other tab marks the thread as read). Idempotent — safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'conversation_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
  END IF;
END $$;

-- REPLICA IDENTITY FULL on conversation_participants so the UPDATE payload
-- (last_read_at) carries enough columns for the bell's filter
-- (filter: user_id=eq.<uid>) to match. Default REPLICA IDENTITY is the PK
-- only, which means the realtime payload's `old` row lacks user_id and the
-- filter on the client may drop the event.
ALTER TABLE public.conversation_participants REPLICA IDENTITY FULL;
