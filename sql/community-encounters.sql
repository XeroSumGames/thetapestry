-- Phase E Sprint 4a — GM-to-GM Contact Handshake.
--
-- A "community encounter" is the canonical event when one campaign's
-- PCs run into a published community from another campaign. The
-- encountering GM clicks "🤝 My PCs encountered this" on the world
-- map; a row lands here and a notification fires to the source
-- community's GM. The recipient can accept (agreeing the encounter
-- happened in their fiction) or decline (didn't fit their canon).
-- Status defaults to 'pending' and never transitions automatically.
--
-- Idempotent — re-running drops + recreates the trigger.

-- ── notifications.metadata column ──────────────────────────────
-- Forward-compatible jsonb payload so encounter notifications can
-- carry the encounter id, encountering campaign name, GM username,
-- etc. without a body-text regex parse on the client.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- ── community_encounters table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The published community being encountered (lives on world_communities).
  -- CASCADE so unpublishing a community cleans up its encounters.
  world_community_id uuid NOT NULL REFERENCES public.world_communities(id) ON DELETE CASCADE,
  -- The encountering side: which campaign's PCs ran into them.
  encountering_campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  -- The user who flagged the encounter (typically the encountering
  -- campaign's GM). Nullable on user delete to keep the encounter
  -- history intact.
  encountering_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Optional one-line "what happened" the encountering GM types.
  -- Shown to the source GM in the notification body so they know
  -- the gist before they accept/decline.
  narrative text,
  -- Source GM's response. Stays 'pending' until the source GM
  -- explicitly acts — accept means the fiction is canon on both
  -- tables; decline means the source GM doesn't accept it.
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- One open encounter per (world_community, encountering_campaign).
  -- Re-encounters use a fresh row only after the previous one is
  -- accepted or declined — a partial unique index lets us enforce
  -- "no two pending requests" without blocking history.
  CONSTRAINT community_encounters_no_dup_pending UNIQUE (world_community_id, encountering_campaign_id, status) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_community_encounters_world
  ON public.community_encounters(world_community_id, status);
CREATE INDEX IF NOT EXISTS idx_community_encounters_campaign
  ON public.community_encounters(encountering_campaign_id, created_at DESC);

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE public.community_encounters ENABLE ROW LEVEL SECURITY;

-- Read: encountering GM (and their campaign members) can see their
-- own encounters; source GM can see encounters TO their community;
-- Thrivers see everything.
DROP POLICY IF EXISTS "community_encounters_read" ON public.community_encounters;
CREATE POLICY "community_encounters_read"
  ON public.community_encounters FOR SELECT
  USING (
    -- I'm the encountering GM (or a member of that campaign)
    EXISTS (
      SELECT 1 FROM public.campaign_members cm
      WHERE cm.campaign_id = community_encounters.encountering_campaign_id
        AND cm.user_id = auth.uid()
    )
    -- I'm the source community's GM
    OR EXISTS (
      SELECT 1
      FROM public.world_communities wc
      JOIN public.campaigns c ON c.id = wc.source_campaign_id
      WHERE wc.id = community_encounters.world_community_id
        AND c.gm_user_id = auth.uid()
    )
    -- Thriver god-read
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

-- Insert: only the encountering campaign's GM (their own user_id).
-- Prevents people from creating encounters in someone else's name.
DROP POLICY IF EXISTS "community_encounters_insert" ON public.community_encounters;
CREATE POLICY "community_encounters_insert"
  ON public.community_encounters FOR INSERT
  WITH CHECK (
    encountering_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = community_encounters.encountering_campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );

-- Update: source community's GM can flip status (accept/decline);
-- encountering GM can edit the narrative on a pending row;
-- Thrivers can do anything.
DROP POLICY IF EXISTS "community_encounters_update" ON public.community_encounters;
CREATE POLICY "community_encounters_update"
  ON public.community_encounters FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
    OR EXISTS (
      SELECT 1
      FROM public.world_communities wc
      JOIN public.campaigns c ON c.id = wc.source_campaign_id
      WHERE wc.id = community_encounters.world_community_id
        AND c.gm_user_id = auth.uid()
    )
    OR encountering_user_id = auth.uid()
  );

-- Delete: encountering GM can withdraw their own request; source GM
-- and Thriver can delete too.
DROP POLICY IF EXISTS "community_encounters_delete" ON public.community_encounters;
CREATE POLICY "community_encounters_delete"
  ON public.community_encounters FOR DELETE
  USING (
    encountering_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.world_communities wc
      JOIN public.campaigns c ON c.id = wc.source_campaign_id
      WHERE wc.id = community_encounters.world_community_id
        AND c.gm_user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

-- ── notify_community_encounter() trigger ──────────────────────
-- On INSERT of a new encounter, fire a notification to the source
-- community's GM. Body is human-readable; metadata carries structured
-- payload so the NotificationBell can render rich content + buttons
-- without parsing the body.
CREATE OR REPLACE FUNCTION public.notify_community_encounter()
RETURNS trigger AS $$
DECLARE
  v_source_community_id uuid;
  v_source_gm_user_id uuid;
  v_source_community_name text;
  v_encountering_campaign_name text;
  v_encountering_username text;
BEGIN
  -- Source community + GM lookup via world_communities → campaigns.
  SELECT wc.source_community_id, c.gm_user_id, wc.name
    INTO v_source_community_id, v_source_gm_user_id, v_source_community_name
  FROM public.world_communities wc
  JOIN public.campaigns c ON c.id = wc.source_campaign_id
  WHERE wc.id = NEW.world_community_id;

  -- Encountering campaign + GM username for the body text.
  SELECT name INTO v_encountering_campaign_name
    FROM public.campaigns WHERE id = NEW.encountering_campaign_id;
  SELECT username INTO v_encountering_username
    FROM public.profiles WHERE id = NEW.encountering_user_id;

  -- Skip if we can't find the source GM (shouldn't happen — RLS
  -- + FK should guarantee it). Belt-and-suspenders.
  IF v_source_gm_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (
    v_source_gm_user_id,
    'community_encounter',
    'Cross-Campaign Encounter',
    COALESCE(v_encountering_username, 'Another GM') || '''s campaign "'
      || COALESCE(v_encountering_campaign_name, 'unknown campaign')
      || '" has encountered your community "'
      || COALESCE(v_source_community_name, 'unknown') || '"'
      || CASE WHEN NEW.narrative IS NOT NULL AND length(NEW.narrative) > 0
              THEN ': ' || NEW.narrative ELSE '' END,
    '/communities/' || v_source_community_id::text,
    jsonb_build_object(
      'encounter_id', NEW.id,
      'world_community_id', NEW.world_community_id,
      'source_community_id', v_source_community_id,
      'source_community_name', v_source_community_name,
      'encountering_campaign_id', NEW.encountering_campaign_id,
      'encountering_campaign_name', v_encountering_campaign_name,
      'encountering_username', v_encountering_username,
      'narrative', NEW.narrative
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_community_encounter_notify ON public.community_encounters;
CREATE TRIGGER trg_community_encounter_notify
  AFTER INSERT ON public.community_encounters
  FOR EACH ROW EXECUTE FUNCTION public.notify_community_encounter();
