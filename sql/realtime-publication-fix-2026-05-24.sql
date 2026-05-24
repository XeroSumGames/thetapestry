-- Realtime publication gap fix (2026-05-24).
--
-- ROOT CAUSE: several tables are subscribed via postgres_changes in the app
-- (usePostgresSubscription / useCampaignChannel postgres[]) but were never
-- added to the supabase_realtime publication. postgres_changes delivers
-- NOTHING for an unpublished table, so those realtime surfaces are silently
-- dead. Pre-existing (the pre-re-arch code also used postgres_changes here);
-- the Phase 7 2-client smoke surfaced it for the first time.
--
-- Confirmed dead surfaces:
--   community_stockpile_items -> stockpile deposits don't propagate (Section D, REPORTED)
--   map_pins                  -> map pins don't propagate          (Section E, latent)
--   community_members         -> NPC community-membership changes  (Section C, latent)
--   advantages                -> GM advantage grants don't appear live to the player
--   campaign_notes            -> shared GM-notes don't live-refresh (PlayerNotes)
--   campaign_events           -> community events feed doesn't live-refresh
--
-- This is ADDITIVE + non-destructive. RLS still governs what each client can
-- SELECT, so publishing a table does not leak rows - it only enables the
-- change-feed for rows a client is already allowed to read.
--
-- HELD for separate triage (not in this migration):
--   characters            - high update frequency + RLS implications; confirm scope first
--   war_story_replies     - campfire/forum surface, not a re-arch god-component
--   forum_thread_reactions - same
--
-- REVERT:
--   ALTER PUBLICATION supabase_realtime DROP TABLE
--     community_stockpile_items, map_pins, community_members,
--     advantages, campaign_notes, campaign_events;

ALTER PUBLICATION supabase_realtime ADD TABLE community_stockpile_items;
ALTER PUBLICATION supabase_realtime ADD TABLE map_pins;
ALTER PUBLICATION supabase_realtime ADD TABLE community_members;
ALTER PUBLICATION supabase_realtime ADD TABLE advantages;
ALTER PUBLICATION supabase_realtime ADD TABLE campaign_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE campaign_events;

-- Verify:
select tablename from pg_publication_tables
where pubname='supabase_realtime'
  and tablename in ('community_stockpile_items','map_pins','community_members','advantages','campaign_notes','campaign_events')
order by tablename;
