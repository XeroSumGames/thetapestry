-- Pregen Library - user-generated pre-generated characters.
--
-- Lets GMs and Thrivers publish any character they build as a reusable
-- pregen template via the "PREGEN" button in the character builder.
--   - Thriver submissions auto-approve (straight to the global library).
--   - GM submissions land 'pending' and go through Thriver moderation;
--     they stay visible to the author on their own My Characters list
--     while pending, and hit the global /pregen page once approved.
--
-- Mirrors the modules moderation shape (sql/modules-phase-a.sql):
-- author + moderation_status pending/approved/rejected + approved_by/at,
-- Thriver god-read/update. A pregen is a reusable TEMPLATE, not an owned
-- playable character, so it gets its own table rather than a flag on
-- `characters`. The `data` blob is the same XSECharacter shape that
-- `characters.data` stores, so the "Use this character" flow can insert
-- it straight into `characters` unchanged.
--
-- Idempotent - safe to re-run.

-- ── pregen_library ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pregen_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The author. Keeps the pregen alive if the author leaves (hard
  -- delete of the auth row just nulls this out; approved pregens keep
  -- working for everyone else).
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  -- Full XSECharacter blob - same shape as characters.data.
  data jsonb NOT NULL,
  -- Optional portrait pulled from the character photo at publish time.
  portrait_url text,
  -- Setting slug (matches lib/settings.ts keys, e.g. 'chased') so the
  -- pregen can surface on matching story pages. Auto-tagged from the
  -- campaign the character was built for when there is one.
  setting text,
  -- Optional tighter association to a specific module/campaign source.
  module_id uuid REFERENCES public.modules(id) ON DELETE SET NULL,
  -- Thriver moderation. Thriver inserts go straight to 'approved' (the
  -- insert WITH CHECK below only lets non-Thrivers insert 'pending', so
  -- a GM cannot self-approve by bypassing the app).
  moderation_status text NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending','approved','rejected')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pregen_library_author
  ON public.pregen_library(author_id);
-- Global /pregen listing reads approved rows, often filtered by setting.
CREATE INDEX IF NOT EXISTS idx_pregen_library_listing
  ON public.pregen_library(moderation_status, setting)
  WHERE moderation_status = 'approved';

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.pregen_library ENABLE ROW LEVEL SECURITY;

-- Read: author sees their own at any status (so a GM sees their pending
-- pregen on My Characters); everyone sees approved; Thriver god-read.
DROP POLICY IF EXISTS "pregen_library_read" ON public.pregen_library;
CREATE POLICY "pregen_library_read"
  ON public.pregen_library FOR SELECT
  USING (
    author_id = auth.uid()
    OR moderation_status = 'approved'
    OR public.is_thriver()
  );

-- Insert: GM/Thriver only (curated library). A GM = a Survivor who owns
-- at least one campaign. Non-Thrivers may only insert 'pending' rows -
-- this is what stops a GM self-approving by hitting the table directly.
DROP POLICY IF EXISTS "pregen_library_insert" ON public.pregen_library;
CREATE POLICY "pregen_library_insert"
  ON public.pregen_library FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (
      public.is_thriver()
      OR (
        moderation_status = 'pending'
        AND EXISTS (
          SELECT 1 FROM public.campaigns c WHERE c.gm_user_id = auth.uid()
        )
      )
    )
  );

-- Update: author may edit their own row; Thriver flips moderation_status
-- (approve/reject). Author edits to a non-Thriver row must stay/return to
-- 'pending' so an author cannot self-approve via update either.
DROP POLICY IF EXISTS "pregen_library_update" ON public.pregen_library;
CREATE POLICY "pregen_library_update"
  ON public.pregen_library FOR UPDATE
  USING (
    author_id = auth.uid()
    OR public.is_thriver()
  )
  WITH CHECK (
    public.is_thriver()
    OR (author_id = auth.uid() AND moderation_status = 'pending')
  );

-- Delete: author or Thriver.
DROP POLICY IF EXISTS "pregen_library_delete" ON public.pregen_library;
CREATE POLICY "pregen_library_delete"
  ON public.pregen_library FOR DELETE
  USING (
    author_id = auth.uid()
    OR public.is_thriver()
  );
