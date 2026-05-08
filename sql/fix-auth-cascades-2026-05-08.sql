-- Fix auth.users delete cascades — 2026-05-08
--
-- Discovered while cleaning up test signup accounts: deleting a row from
-- auth.users was failing with FK violations on tables whose constraints
-- were ON DELETE NO ACTION. Five tables were blocking. Most other FKs
-- already use ON DELETE SET NULL (preserving rows but clearing the
-- author column) — these five just hadn't been updated to match.
--
-- Decision tree:
--   - Row REPRESENTS the user (their messages, their notifications,
--     their event log) → ON DELETE CASCADE so the row goes with them
--   - Row IS COMMUNITY content the user merely contributed to (an
--     attachment in a shared campaign, a world-bank NPC) → ON DELETE
--     SET NULL so the content persists but the author column clears
--
-- After this lands, deleting users from /moderate (or any
-- DELETE FROM auth.users) goes through cleanly. No more whack-a-mole.

-- chat_messages: user's DMs / chat. CASCADE — their messages go with them.
alter table public.chat_messages
  drop constraint chat_messages_user_id_fkey,
  add constraint chat_messages_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

-- notifications: user's inbox. CASCADE — notifications about a deleted
-- user are just noise; nothing to retain.
alter table public.notifications
  drop constraint notifications_user_id_fkey,
  add constraint notifications_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

-- user_events: analytics / activity log scoped to the user. CASCADE —
-- events about a non-existent user are just orphans.
alter table public.user_events
  drop constraint user_events_user_id_fkey,
  add constraint user_events_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

-- session_attachments: files uploaded into campaign sessions. SET NULL —
-- the file/attachment stays part of the campaign's record; only the
-- "uploaded by" attribution clears. Same pattern as bug_reports.reporter,
-- campaign_snapshots.created_by, etc.
alter table public.session_attachments
  drop constraint session_attachments_uploaded_by_fkey,
  add constraint session_attachments_uploaded_by_fkey
    foreign key (uploaded_by) references auth.users(id) on delete set null;

-- world_npcs: NPCs published to the shared world bank. SET NULL — NPC
-- continues to exist for everyone else; only the original-creator
-- attribution clears. Mirrors world_communities.published_by.
alter table public.world_npcs
  drop constraint world_npcs_created_by_fkey,
  add constraint world_npcs_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

-- Schema reload so PostgREST picks up the new constraint definitions
-- without waiting for the periodic refresh.
notify pgrst, 'reload schema';
