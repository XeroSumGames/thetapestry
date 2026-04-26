-- tactical-scenes-realtime-publication.sql
-- Adds tactical_scenes to the supabase_realtime publication so the
-- player TacticalMap's postgres_changes subscription on UPDATE
-- (active-scene flip when the GM switches scenes) actually fires.
-- Without this, the GM activates a new scene, the DB row updates,
-- but every connected player misses the realtime event and stays
-- looking at the old scene until they refresh.
--
-- Idempotent. Defensive REPLICA IDENTITY FULL so UPDATE payloads
-- include every column for client-side filters.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tactical_scenes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tactical_scenes;
  END IF;
END $$;

ALTER TABLE public.tactical_scenes REPLICA IDENTITY FULL;
