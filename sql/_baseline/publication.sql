-- CANONICAL supabase_realtime publication membership (infra-as-code baseline).
--
-- This file is the SOURCE OF TRUTH for which tables are in the realtime
-- publication. A table delivers postgres_changes events ONLY if it is here.
-- A subscription on a table NOT in this list is silently dead (no error) -
-- that is the bug class that cost an hour on 2026-05-24 and was triaged again
-- 2026-05-23. `scripts/check-publication-drift.mjs` diffs the LIVE membership
-- against this file and fails on drift.
--
-- DISCIPLINE: when you add a postgres_changes subscription to a new table,
-- add an `ADD TABLE` line here AND apply it to live in the SAME change:
--   npx supabase db query --linked -f sql/_baseline/publication.sql   (re-apply is safe to skip if already a member; ADD errors on dupes)
-- To apply just the new one: `ALTER PUBLICATION supabase_realtime ADD TABLE <name>;`
--
-- Captured 2026-05-23 from live (21 tables). Last fix that grew it:
-- sql/realtime-publication-fix-2026-05-24.sql (+6 tables).
--
-- REVERT a table: ALTER PUBLICATION supabase_realtime DROP TABLE <name>;

ALTER PUBLICATION supabase_realtime ADD TABLE advantages;
ALTER PUBLICATION supabase_realtime ADD TABLE campaign_events;
ALTER PUBLICATION supabase_realtime ADD TABLE campaign_members;
ALTER PUBLICATION supabase_realtime ADD TABLE campaign_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE campaign_npcs;
ALTER PUBLICATION supabase_realtime ADD TABLE campaign_pins;
ALTER PUBLICATION supabase_realtime ADD TABLE campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE character_states;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE community_members;
ALTER PUBLICATION supabase_realtime ADD TABLE community_stockpile_items;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE initiative_order;
ALTER PUBLICATION supabase_realtime ADD TABLE map_pins;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE npc_relationships;
ALTER PUBLICATION supabase_realtime ADD TABLE roll_log;
ALTER PUBLICATION supabase_realtime ADD TABLE scene_tokens;
ALTER PUBLICATION supabase_realtime ADD TABLE tactical_scenes;
ALTER PUBLICATION supabase_realtime ADD TABLE whispers;

-- Verify (should return exactly the 21 names above):
-- select tablename from pg_publication_tables where pubname='supabase_realtime' order by 1;
