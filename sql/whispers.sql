-- whispers.sql
-- Public message wall surfaced as a tab on the /map sidebar (and any
-- other surface that mounts MapView). Distinct from the in-table
-- /whisper chat command — that's a private DM in TableChat. This is a
-- platform-wide bulletin: any authenticated user can post, anyone can
-- read, only Thrivers can delete.
--
-- Scope intentionally tiny: id + author + content + timestamp. No
-- replies, no reactions, no attachments — the value is "everyone sees
-- the same wall" not "another social feed."
--
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS public.whispers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content         text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whispers_created ON public.whispers (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whispers_author  ON public.whispers (author_user_id);

ALTER TABLE public.whispers ENABLE ROW LEVEL SECURITY;

-- Any signed-in user reads the wall.
DROP POLICY IF EXISTS "whispers_select" ON public.whispers;
CREATE POLICY "whispers_select" ON public.whispers
  FOR SELECT TO authenticated
  USING (true);

-- Any signed-in user posts; their auth uid must match the row.
DROP POLICY IF EXISTS "whispers_insert_own" ON public.whispers;
CREATE POLICY "whispers_insert_own" ON public.whispers
  FOR INSERT TO authenticated
  WITH CHECK (author_user_id = auth.uid());

-- Only Thrivers can delete. Authors don't get UPDATE/DELETE on their
-- own posts on purpose — moderation belongs to Thrivers, who can also
-- see the full wall via this same SELECT policy.
DROP POLICY IF EXISTS "whispers_delete_thriver" ON public.whispers;
CREATE POLICY "whispers_delete_thriver" ON public.whispers
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND lower(p.role) = 'thriver'
    )
  );

NOTIFY pgrst, 'reload schema';
