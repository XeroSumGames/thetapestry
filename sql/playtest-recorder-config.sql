-- ============================================================
-- Playtest Recorder config — singleton row controlling whether
-- the in-app event recorder runs, and for which users.
--
-- Why: the recorder used to run for every visitor on every page,
-- including ghost traffic on the marketing landing pages. Wasteful.
-- This table lets a thriver-role admin (the project owner) flip
-- recording on/off and target specific players, controlled from
-- the /record admin page.
--
-- Read: any authenticated user (recorder needs to know if it
--   should run for them).
-- Write: thriver-role only.
--
-- Idempotent. Run via:
--   npx supabase db query --linked -f sql/playtest-recorder-config.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.playtest_recorder_config (
  id              INT PRIMARY KEY DEFAULT 1,
  enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  -- When `enabled = true`:
  --   target_user_ids = '{}'  → record for everyone (authenticated)
  --   target_user_ids non-empty → only record for these user ids
  -- When `enabled = false`: no one records, regardless.
  target_user_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      UUID,
  CONSTRAINT singleton CHECK (id = 1)
);

-- Seed the singleton row. Default OFF so deploying this SQL alone
-- doesn't immediately start recording for anyone.
INSERT INTO public.playtest_recorder_config (id, enabled, target_user_ids)
VALUES (1, FALSE, '{}'::uuid[])
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.playtest_recorder_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read recorder config" ON public.playtest_recorder_config;
CREATE POLICY "Authenticated read recorder config"
  ON public.playtest_recorder_config FOR SELECT
  TO authenticated
  USING (TRUE);

-- Writes: thriver only. Same role used by /moderate and other admin
-- surfaces. Lower-cased compare matches existing pattern in
-- app/moderate/page.tsx line 161.
DROP POLICY IF EXISTS "Thrivers write recorder config" ON public.playtest_recorder_config;
CREATE POLICY "Thrivers write recorder config"
  ON public.playtest_recorder_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND LOWER(p.role) = 'thriver')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND LOWER(p.role) = 'thriver')
  );

-- Inserts blocked except for the seed row above. Singleton invariant.
DROP POLICY IF EXISTS "Block recorder config insert" ON public.playtest_recorder_config;
CREATE POLICY "Block recorder config insert"
  ON public.playtest_recorder_config FOR INSERT
  TO authenticated
  WITH CHECK (FALSE);

-- Deletes blocked. Singleton invariant.
DROP POLICY IF EXISTS "Block recorder config delete" ON public.playtest_recorder_config;
CREATE POLICY "Block recorder config delete"
  ON public.playtest_recorder_config FOR DELETE
  TO authenticated
  USING (FALSE);
