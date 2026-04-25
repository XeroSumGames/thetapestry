-- campaign-npcs-realtime-publication.sql
-- Ensures campaign_npcs is in the supabase_realtime publication so
-- NpcRoster's postgres_changes subscription actually fires when an NPC
-- is updated elsewhere (e.g. disposition set from a popout sheet, HP
-- changed by combat damage, etc.). Without this, roster state goes
-- stale until the user refreshes.
--
-- Some setting seeds (district-zero-seed.sql) added campaign_npcs to
-- the publication, but a campaign that wasn't seeded with that file
-- can be in the inconsistent state where the table is missing from
-- the publication. Idempotent — safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'campaign_npcs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_npcs;
  END IF;
END $$;

-- REPLICA IDENTITY FULL so UPDATE payloads carry the full row, which
-- lets clients filter on non-PK columns reliably (campaign_id matters
-- for the NpcRoster filter).
ALTER TABLE public.campaign_npcs REPLICA IDENTITY FULL;
