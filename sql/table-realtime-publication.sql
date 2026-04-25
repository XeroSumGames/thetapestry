-- table-realtime-publication.sql
-- Same root cause as messages-realtime-publication: tables not in the
-- supabase_realtime publication silently drop postgres_changes events
-- even when the client subscribes correctly. The codebase already has
-- workaround comments admitting this:
--
--   "postgres_changes on npc_relationships doesn't reliably fire (RLS /
--    publication)" — app/stories/[id]/table/page.tsx:2103
--   "Players' postgres_changes subscription on npc_relationships is
--    unreliable" — app/stories/[id]/table/page.tsx:1112
--
-- Symptom: when the GM clicks Show on the NPC roster (per-NPC or per-
-- folder), the player has to refresh to see the tokens appear on the
-- tactical map and the new entries appear in their NPC sidebar. With
-- both tables in the publication, the client's existing postgres_changes
-- subscriptions fire reliably and the UI updates without refresh.
--
-- Idempotent — safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'scene_tokens'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scene_tokens;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'npc_relationships'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.npc_relationships;
  END IF;
END $$;

-- REPLICA IDENTITY FULL on both tables so UPDATE events carry full row
-- data — without this, postgres_changes UPDATEs deliver only the PK in
-- the OLD record, which can defeat client-side filters that match on
-- non-PK columns (e.g. campaign_id, scene_id).
ALTER TABLE public.scene_tokens       REPLICA IDENTITY FULL;
ALTER TABLE public.npc_relationships  REPLICA IDENTITY FULL;
