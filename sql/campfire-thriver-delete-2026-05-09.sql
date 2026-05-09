-- Campfire: Thriver-can-delete-any-post policies for the four
-- author-owned tables. Mirrors the *_update_thriver pattern from
-- sql/campfire-moderation.sql. Without these the Thriver godmode UI
-- (Edit + Delete on every post / thread / reply / story) surfaces
-- a Delete button whose request RLS silently drops.

DROP POLICY IF EXISTS "lfg_delete_thriver" ON public.lfg_posts;
CREATE POLICY "lfg_delete_thriver" ON public.lfg_posts
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

DROP POLICY IF EXISTS "ft_delete_thriver" ON public.forum_threads;
CREATE POLICY "ft_delete_thriver" ON public.forum_threads
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

DROP POLICY IF EXISTS "fr_delete_thriver" ON public.forum_replies;
CREATE POLICY "fr_delete_thriver" ON public.forum_replies
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

DROP POLICY IF EXISTS "ws_delete_thriver" ON public.war_stories;
CREATE POLICY "ws_delete_thriver" ON public.war_stories
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

NOTIFY pgrst, 'reload schema';
