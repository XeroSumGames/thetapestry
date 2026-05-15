-- Per-user pin folders (2026-05-15).
--
-- Each user (GM or player) gets their own private folder collection
-- per campaign for organising visible pins. Folders don't leak across
-- users — Xero's "Waypoints" folder is invisible to a player even
-- though they both see the same pins.
--
-- A pin's folder assignment is per-(user, pin), so the GM can have
-- "Hells Hole Spring" in their "Mongrels Setup" folder while a player
-- has the same pin in their "Visited" folder.
--
-- Pin deletion cascades to the assignments; user deletion cascades to
-- the folders (and through them, the assignments).

CREATE TABLE IF NOT EXISTS public.pin_folders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(trim(name)) > 0),
  sort_order  integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pin_folders_campaign_user_idx
  ON public.pin_folders (campaign_id, user_id);

CREATE TABLE IF NOT EXISTS public.pin_folder_assignments (
  pin_id    uuid NOT NULL REFERENCES public.campaign_pins(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL REFERENCES public.pin_folders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pin_id, user_id)
);

CREATE INDEX IF NOT EXISTS pin_folder_assignments_user_folder_idx
  ON public.pin_folder_assignments (user_id, folder_id);

-- ── RLS ──
-- Per-user: a user can see / mutate only their own folders and
-- assignments. No GM override (Thrivers either) — folders are
-- intentionally private even from the campaign's GM.
ALTER TABLE public.pin_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pin_folder_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pin_folders own all" ON public.pin_folders;
CREATE POLICY "pin_folders own all" ON public.pin_folders
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "pin_folder_assignments own all" ON public.pin_folder_assignments;
CREATE POLICY "pin_folder_assignments own all" ON public.pin_folder_assignments
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Refresh PostgREST schema cache so the new tables are queryable
-- immediately without waiting for the polling cycle.
NOTIFY pgrst, 'reload schema';
