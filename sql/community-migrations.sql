-- Phase E Sprint 4e — Migration on dissolution.
--
-- When a community collapses (3-failure dissolution), the GM can
-- offer surviving NPCs to nearby published communities. The
-- receiving GM accepts or declines. MVP scope: offer + notification
-- + narrative acceptance. Automatic NPC copy into the target
-- campaign is queued as a follow-up (the recipient GM manually
-- adds the survivor via the existing add-member flow after accepting).
--
-- Idempotent — drops + recreates triggers.

CREATE TABLE IF NOT EXISTS public.community_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The dying / dissolved community offering up survivors. CASCADE
  -- so deleting the source nukes the offer history (the offer no
  -- longer means anything if the source is gone).
  source_community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  -- Snapshot the source name so we can render historical migrations
  -- even if the source is later deleted.
  source_community_name text NOT NULL,
  -- The source member row + the underlying NPC. Both nullable on
  -- delete cascade so historical rows don't break.
  source_member_id uuid REFERENCES public.community_members(id) ON DELETE SET NULL,
  source_npc_id uuid REFERENCES public.campaign_npcs(id) ON DELETE SET NULL,
  npc_name text NOT NULL,  -- snapshot
  -- The receiving published community (lives on world_communities).
  target_world_community_id uuid NOT NULL REFERENCES public.world_communities(id) ON DELETE CASCADE,
  -- Who offered (typically the dissolving community's GM).
  offered_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Optional one-line context the offering GM types.
  narrative text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_migrations_source
  ON public.community_migrations(source_community_id, status);
CREATE INDEX IF NOT EXISTS idx_community_migrations_target
  ON public.community_migrations(target_world_community_id, status);

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE public.community_migrations ENABLE ROW LEVEL SECURITY;

-- Read: source-side GM + members (their own offers); target-side GM
-- (incoming offers); Thriver god-read.
DROP POLICY IF EXISTS "community_migrations_read" ON public.community_migrations;
CREATE POLICY "community_migrations_read"
  ON public.community_migrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.communities c
      JOIN public.campaign_members cm ON cm.campaign_id = c.campaign_id
      WHERE c.id = community_migrations.source_community_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.world_communities wc
      JOIN public.campaigns c ON c.id = wc.source_campaign_id
      WHERE wc.id = community_migrations.target_world_community_id
        AND c.gm_user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

-- Insert: only the source community's GM (their own user_id), and
-- only on a community they own.
DROP POLICY IF EXISTS "community_migrations_insert" ON public.community_migrations;
CREATE POLICY "community_migrations_insert"
  ON public.community_migrations FOR INSERT
  WITH CHECK (
    offered_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.communities c
      JOIN public.campaigns cp ON cp.id = c.campaign_id
      WHERE c.id = community_migrations.source_community_id
        AND cp.gm_user_id = auth.uid()
    )
  );

-- Update: target-side GM accepts/declines; source GM can withdraw
-- (delete preferred); Thriver god-write.
DROP POLICY IF EXISTS "community_migrations_update" ON public.community_migrations;
CREATE POLICY "community_migrations_update"
  ON public.community_migrations FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
    OR EXISTS (
      SELECT 1 FROM public.world_communities wc
      JOIN public.campaigns c ON c.id = wc.source_campaign_id
      WHERE wc.id = community_migrations.target_world_community_id
        AND c.gm_user_id = auth.uid()
    )
    OR offered_by_user_id = auth.uid()
  );

-- Delete: source GM (withdrawing) or Thriver.
DROP POLICY IF EXISTS "community_migrations_delete" ON public.community_migrations;
CREATE POLICY "community_migrations_delete"
  ON public.community_migrations FOR DELETE
  USING (
    offered_by_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

-- ── notify_community_migration() trigger ──────────────────────
-- On INSERT, notify the target community's GM with the migrant's
-- name + the source community + optional narrative.
CREATE OR REPLACE FUNCTION public.notify_community_migration()
RETURNS trigger AS $$
DECLARE
  v_target_user_id uuid;
  v_target_community_id uuid;
  v_target_community_name text;
  v_offerer_username text;
BEGIN
  SELECT wc.source_community_id, wc.name, c.gm_user_id
    INTO v_target_community_id, v_target_community_name, v_target_user_id
  FROM public.world_communities wc
  JOIN public.campaigns c ON c.id = wc.source_campaign_id
  WHERE wc.id = NEW.target_world_community_id;

  SELECT username INTO v_offerer_username
    FROM public.profiles WHERE id = NEW.offered_by_user_id;

  IF v_target_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (
    v_target_user_id,
    'community_migration',
    '📤 Migration request',
    'Survivor "' || NEW.npc_name || '" from "' || NEW.source_community_name
      || '" seeks shelter in your "' || COALESCE(v_target_community_name, 'unknown') || '"'
      || CASE WHEN NEW.narrative IS NOT NULL AND length(NEW.narrative) > 0
              THEN ': ' || NEW.narrative ELSE '' END,
    '/communities/' || v_target_community_id::text,
    jsonb_build_object(
      'migration_id', NEW.id,
      'npc_name', NEW.npc_name,
      'source_community_name', NEW.source_community_name,
      'target_community_name', v_target_community_name,
      'offerer_username', v_offerer_username,
      'narrative', NEW.narrative
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_community_migration_notify ON public.community_migrations;
CREATE TRIGGER trg_community_migration_notify
  AFTER INSERT ON public.community_migrations
  FOR EACH ROW EXECUTE FUNCTION public.notify_community_migration();

-- ── notify_community_migration_response() trigger ─────────────
-- When the target GM flips status pending → accepted|declined,
-- notify the original offerer. Mirrors the link-response pattern
-- so both sides see the loop close.
CREATE OR REPLACE FUNCTION public.notify_community_migration_response()
RETURNS trigger AS $$
DECLARE
  v_target_community_name text;
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('accepted', 'declined') THEN
    SELECT wc.name INTO v_target_community_name
      FROM public.world_communities wc
      WHERE wc.id = NEW.target_world_community_id;
    IF NEW.offered_by_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
      VALUES (
        NEW.offered_by_user_id,
        'community_migration_response',
        CASE WHEN NEW.status = 'accepted' THEN '✓ Migrant accepted' ELSE '✗ Migrant declined' END,
        '"' || COALESCE(v_target_community_name, 'unknown') || '" '
          || NEW.status || ' "' || NEW.npc_name || '" from your "'
          || NEW.source_community_name || '"',
        '/communities/' || NEW.source_community_id::text,
        jsonb_build_object(
          'migration_id', NEW.id,
          'npc_name', NEW.npc_name,
          'status', NEW.status,
          'target_community_name', v_target_community_name
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_community_migration_response_notify ON public.community_migrations;
CREATE TRIGGER trg_community_migration_response_notify
  AFTER UPDATE OF status ON public.community_migrations
  FOR EACH ROW EXECUTE FUNCTION public.notify_community_migration_response();
