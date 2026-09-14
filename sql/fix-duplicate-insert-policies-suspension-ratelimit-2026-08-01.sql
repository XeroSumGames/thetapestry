-- Fix: found via a schema-wide sweep for duplicate PERMISSIVE policies
-- (same pattern as the campaign_npcs/scene_tokens fix earlier tonight).
-- Four content tables each carry TWO INSERT policies - an older, looser
-- one left over from before suspension/rate-limit checks were added, and
-- a newer, correctly-guarded one that never had the old one dropped:
--
--   forum_threads: ft_insert (author_user_id = auth.uid() only)
--                  vs forum_threads_insert (+ NOT is_user_suspended() + check_rate_limit)
--   lfg_posts:     lfg_insert (author_user_id = auth.uid() only)
--                  vs lfg_posts_insert (+ suspension + rate limit)
--   war_stories:   ws_insert (author_user_id = auth.uid() only)
--                  vs war_stories_insert (+ suspension + rate limit)
--   whispers:      whispers_insert_own (author_user_id = auth.uid() only)
--                  vs whispers_insert (+ suspension + rate limit)
--
-- Since PERMISSIVE policies OR together, the old policy alone was
-- sufficient to insert - a SUSPENDED user could still post forum threads,
-- LFG posts, war stories, and whispers (moderation bypass), and every
-- rate limit on these 4 content types was fully unenforceable (spam/flood
-- vector - script a loop, insert unlimited rows, no server-side backstop).
-- The new, correctly-guarded policy's restrictions were pure decoration.
--
-- Fix: drop the four old duplicates. Every insert the old policy allowed
-- that the new one doesn't is exactly the suspended-user / rate-limit-
-- bypass case this closes - normal, non-suspended, rate-limit-respecting
-- users are unaffected.

BEGIN;

DROP POLICY IF EXISTS ft_insert ON public.forum_threads;
DROP POLICY IF EXISTS lfg_insert ON public.lfg_posts;
DROP POLICY IF EXISTS ws_insert ON public.war_stories;
DROP POLICY IF EXISTS whispers_insert_own ON public.whispers;

COMMIT;
