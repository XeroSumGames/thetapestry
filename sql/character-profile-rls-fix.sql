-- ============================================================
-- Allow campaign members to read each other's characters and profiles.
-- Run in Supabase SQL Editor.
-- Idempotent: safe to re-run.
-- ============================================================
--
-- Why: loadEntries fetches characters and profiles by id from inside
-- the table page. If the existing RLS only allows users to read their
-- own rows, the GM can never read player characters and players can
-- never read each other's, which makes the entries fall back to
-- { name: 'Unknown' }. That cascades into the damage targeting bug
-- (entries.find(... === 'Frankie Gibblets') returns undefined when
-- the row says name='Unknown') and the "PCs switched to Unknown"
-- symptom.

-- ── characters ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Campaign members read each other's characters" ON public.characters;

CREATE POLICY "Campaign members read each other's characters"
  ON public.characters FOR SELECT TO authenticated
  USING (
    -- Owner can always read.
    user_id = auth.uid()
    OR
    -- Anyone in the same campaign as a member who owns this character can read.
    EXISTS (
      SELECT 1 FROM public.campaign_members me
      JOIN public.campaign_members theirs
        ON theirs.campaign_id = me.campaign_id
      WHERE me.user_id = auth.uid()
        AND theirs.user_id = public.characters.user_id
    )
  );

-- ── profiles ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Campaign members read each other's profiles" ON public.profiles;

CREATE POLICY "Campaign members read each other's profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    -- Self.
    id = auth.uid()
    OR
    -- Anyone in the same campaign.
    EXISTS (
      SELECT 1 FROM public.campaign_members me
      JOIN public.campaign_members theirs
        ON theirs.campaign_id = me.campaign_id
      WHERE me.user_id = auth.uid()
        AND theirs.user_id = public.profiles.id
    )
  );

-- ── Diagnostic — verify policies are present ─────────────────
SELECT polname, polrelid::regclass AS table, polcmd AS cmd
FROM pg_policy
WHERE polrelid IN ('public.characters'::regclass, 'public.profiles'::regclass)
ORDER BY table, polname;
