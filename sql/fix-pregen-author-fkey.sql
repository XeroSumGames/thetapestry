-- Fix pregen_library.author_id FK: was auth.users, must be public.profiles
-- so PostgREST can resolve the embedded join in loadApprovedPregens().
-- Error seen during 2026-06-23 playtest: PGRST200 on the story lobby page.
ALTER TABLE public.pregen_library
  DROP CONSTRAINT pregen_library_author_id_fkey;

ALTER TABLE public.pregen_library
  ADD CONSTRAINT pregen_library_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
