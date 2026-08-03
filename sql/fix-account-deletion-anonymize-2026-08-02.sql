-- Fix: app/account/page.tsx promises deleted-account content is "anonymized
-- rather than deleted, so the platform doesn't break for everyone else."
-- The FKs said otherwise: forum_threads/war_stories/lfg_posts/whispers.
-- author_user_id was ON DELETE CASCADE against auth.users(id), so self-
-- deleting an account hard-deleted every thread/story/post/whisper that
-- account authored. Worse, the REPLY tables (forum_replies.thread_id,
-- war_story_replies.war_story_id, lfg_post_replies.post_id) cascade off
-- the PARENT row, not the author - so deleting the thread deletes every
-- OTHER user's replies to it too, with zero warning to them. modules.
-- author_user_id was already correctly ON DELETE SET NULL - that pattern
-- was just never extended to these 4 tables. Xero's decision (routed via
-- Comms 2026-08-02): build the anonymize behavior for real, matching the
-- existing modules pattern, rather than changing the promise.
--
-- This migration is the schema half only (Puffer Fish's lane). The UI
-- half - rendering "Anonymous" wherever author_user_id is now null,
-- instead of a broken/missing name - is Hunt & Peck's, coordinated
-- separately.

BEGIN;

ALTER TABLE public.forum_threads ALTER COLUMN author_user_id DROP NOT NULL;
ALTER TABLE public.forum_threads DROP CONSTRAINT forum_threads_author_user_id_fkey;
ALTER TABLE public.forum_threads ADD CONSTRAINT forum_threads_author_user_id_fkey
  FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.war_stories ALTER COLUMN author_user_id DROP NOT NULL;
ALTER TABLE public.war_stories DROP CONSTRAINT war_stories_author_user_id_fkey;
ALTER TABLE public.war_stories ADD CONSTRAINT war_stories_author_user_id_fkey
  FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.lfg_posts ALTER COLUMN author_user_id DROP NOT NULL;
ALTER TABLE public.lfg_posts DROP CONSTRAINT lfg_posts_author_user_id_fkey;
ALTER TABLE public.lfg_posts ADD CONSTRAINT lfg_posts_author_user_id_fkey
  FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.whispers ALTER COLUMN author_user_id DROP NOT NULL;
ALTER TABLE public.whispers DROP CONSTRAINT whispers_author_user_id_fkey;
ALTER TABLE public.whispers ADD CONSTRAINT whispers_author_user_id_fkey
  FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMIT;
