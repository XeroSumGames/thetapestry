-- Read-only triage of the 3 HELD publication tables (2026-05-23).
-- Question per table: is it subscribed via postgres_changes in app code AND
-- absent from supabase_realtime? Absent+subscribed = real dead surface.
-- Code findings (this session):
--   characters             -> SUBSCRIBED raw postgres_changes @ app/character-sheet/page.tsx:83
--   war_story_replies      -> NOT subscribed (CRUD-only; InlineRepliesPanel)
--   forum_thread_reactions -> NOT subscribed (CRUD-only; ReactionButtons)
select tablename,
       case when tablename in (
         select tablename from pg_publication_tables where pubname='supabase_realtime'
       ) then 'PUBLISHED' else 'ABSENT' end as publication_status
from (values
  ('characters'),
  ('war_story_replies'),
  ('forum_thread_reactions'),
  ('character_states')  -- control: known-working vitals sub on the same char-sheet channel
) as t(tablename)
order by tablename;
