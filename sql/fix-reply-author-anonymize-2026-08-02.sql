-- Fix: follow-up to sql/fix-account-deletion-anonymize-2026-08-02.sql,
-- caught by Hunt & Peck while shipping the UI half - that migration only
-- changed the TOP-LEVEL content tables' author FK (forum_threads/
-- war_stories/lfg_posts/whispers), which fixes the "thread author
-- deletes their account -> thread and its replies survive" case (the
-- thread's own author_user_id no longer cascades, so forum_replies'
-- existing thread_id CASCADE never fires because the thread itself
-- isn't deleted anymore).
--
-- It did NOT cover the separate case: a REPLIER (not the thread's
-- author) deletes their own account. forum_replies/lfg_post_replies/
-- war_story_replies each have their OWN author_user_id column with its
-- OWN FK to auth.users(id), independent of the thread_id FK - and that
-- one was still ON DELETE CASCADE. A replier deleting their account
-- would still hard-delete their own reply out of someone ELSE's thread,
-- leaving a conversation gap - the exact same "anonymize, don't delete"
-- promise violation the original fix was for, just on the reply layer
-- instead of the thread layer.
--
-- Same fix, same pattern: nullable + ON DELETE SET NULL, matching
-- modules.author_user_id and the 4 tables already fixed.

BEGIN;

ALTER TABLE public.forum_replies ALTER COLUMN author_user_id DROP NOT NULL;
ALTER TABLE public.forum_replies DROP CONSTRAINT forum_replies_author_user_id_fkey;
ALTER TABLE public.forum_replies ADD CONSTRAINT forum_replies_author_user_id_fkey
  FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.war_story_replies ALTER COLUMN author_user_id DROP NOT NULL;
ALTER TABLE public.war_story_replies DROP CONSTRAINT war_story_replies_author_user_id_fkey;
ALTER TABLE public.war_story_replies ADD CONSTRAINT war_story_replies_author_user_id_fkey
  FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.lfg_post_replies ALTER COLUMN author_user_id DROP NOT NULL;
ALTER TABLE public.lfg_post_replies DROP CONSTRAINT lfg_post_replies_author_user_id_fkey;
ALTER TABLE public.lfg_post_replies ADD CONSTRAINT lfg_post_replies_author_user_id_fkey
  FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMIT;
