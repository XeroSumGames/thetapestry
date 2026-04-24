-- Phase E Sprint 4b — Trade / Alliance / Feud links between published
-- communities. Two-way consent required: GM A proposes the link
-- (status='pending'), GM B accepts (status='active') or declines
-- (status='declined'). Only 'active' links render as polylines on
-- the world map. Notifications fire on propose and on response.
--
-- Idempotent — re-running drops + recreates the trigger.

CREATE TABLE IF NOT EXISTS public.world_community_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The two endpoints. Order is arbitrary at the DB level; the
  -- proposing side is recorded via proposed_by_user_id below so
  -- "who's waiting on whom" is unambiguous. CASCADE on either
  -- world_community removal cleans up the link row.
  community_a_id uuid NOT NULL REFERENCES public.world_communities(id) ON DELETE CASCADE,
  community_b_id uuid NOT NULL REFERENCES public.world_communities(id) ON DELETE CASCADE,
  -- Narrative type. Each renders as a different polyline color on
  -- the world map (trade=green, alliance=blue, feud=red).
  link_type text NOT NULL CHECK (link_type IN ('trade','alliance','feud')),
  -- Workflow state. Active is the only status that renders publicly.
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','declined')),
  -- Proposing GM. Receiver is derived from the OTHER community's
  -- source campaign GM at trigger / response time.
  proposed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  proposed_from_community_id uuid REFERENCES public.world_communities(id) ON DELETE SET NULL,
  -- Optional one-line context the proposer types. Surfaced in the
  -- notification body and the polyline tooltip.
  narrative text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- A community can have at most one PENDING link of any type with
  -- another specific community at a time. Once the response lands
  -- (active or declined), a new pending row is allowed.
  CONSTRAINT world_community_links_no_dup_pending UNIQUE (community_a_id, community_b_id, link_type, status) DEFERRABLE INITIALLY DEFERRED,
  -- Endpoints can't be the same community.
  CONSTRAINT world_community_links_distinct_endpoints CHECK (community_a_id <> community_b_id)
);

CREATE INDEX IF NOT EXISTS idx_world_community_links_a
  ON public.world_community_links(community_a_id, status);
CREATE INDEX IF NOT EXISTS idx_world_community_links_b
  ON public.world_community_links(community_b_id, status);

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE public.world_community_links ENABLE ROW LEVEL SECURITY;

-- Read: anyone can read 'active' links (public world surface).
-- Either side's GM (and their campaign members) can also read
-- pending/declined to see workflow. Thrivers see all.
DROP POLICY IF EXISTS "world_community_links_read" ON public.world_community_links;
CREATE POLICY "world_community_links_read"
  ON public.world_community_links FOR SELECT
  USING (
    status = 'active'
    OR EXISTS (
      SELECT 1 FROM public.world_communities wc
      JOIN public.campaigns c ON c.id = wc.source_campaign_id
      WHERE (wc.id = community_a_id OR wc.id = community_b_id)
        AND c.gm_user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

-- Insert: must be the GM of the proposing community's source
-- campaign, AND the proposed_by_user_id must match auth.uid().
-- proposed_from_community_id must be one of the two endpoints.
DROP POLICY IF EXISTS "world_community_links_insert" ON public.world_community_links;
CREATE POLICY "world_community_links_insert"
  ON public.world_community_links FOR INSERT
  WITH CHECK (
    proposed_by_user_id = auth.uid()
    AND proposed_from_community_id IN (community_a_id, community_b_id)
    AND EXISTS (
      SELECT 1 FROM public.world_communities wc
      JOIN public.campaigns c ON c.id = wc.source_campaign_id
      WHERE wc.id = proposed_from_community_id
        AND c.gm_user_id = auth.uid()
    )
  );

-- Update: either side's GM can flip status (accept/decline) or
-- edit the narrative on a pending row. Thrivers can do anything.
DROP POLICY IF EXISTS "world_community_links_update" ON public.world_community_links;
CREATE POLICY "world_community_links_update"
  ON public.world_community_links FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
    OR EXISTS (
      SELECT 1 FROM public.world_communities wc
      JOIN public.campaigns c ON c.id = wc.source_campaign_id
      WHERE (wc.id = community_a_id OR wc.id = community_b_id)
        AND c.gm_user_id = auth.uid()
    )
  );

-- Delete: either side's GM can delete (withdraws the link). Thriver
-- can too.
DROP POLICY IF EXISTS "world_community_links_delete" ON public.world_community_links;
CREATE POLICY "world_community_links_delete"
  ON public.world_community_links FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.world_communities wc
      JOIN public.campaigns c ON c.id = wc.source_campaign_id
      WHERE (wc.id = community_a_id OR wc.id = community_b_id)
        AND c.gm_user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver')
  );

-- ── notify_community_link() trigger ────────────────────────────
-- On INSERT, notify the OTHER community's GM (the one whose
-- consent is needed). Body carries the proposer's username +
-- both community names + link type + optional narrative.
CREATE OR REPLACE FUNCTION public.notify_community_link()
RETURNS trigger AS $$
DECLARE
  v_recipient_user_id uuid;
  v_recipient_community_id uuid;
  v_recipient_community_name text;
  v_proposer_community_name text;
  v_proposer_username text;
BEGIN
  -- The recipient is the GM of the community that ISN'T the proposer's.
  v_recipient_community_id := CASE
    WHEN NEW.proposed_from_community_id = NEW.community_a_id THEN NEW.community_b_id
    ELSE NEW.community_a_id
  END;

  SELECT wc.name, c.gm_user_id, wc.source_community_id
    INTO v_recipient_community_name, v_recipient_user_id, v_recipient_community_id
  FROM public.world_communities wc
  JOIN public.campaigns c ON c.id = wc.source_campaign_id
  WHERE wc.id = (CASE
    WHEN NEW.proposed_from_community_id = NEW.community_a_id THEN NEW.community_b_id
    ELSE NEW.community_a_id
  END);

  SELECT wc.name INTO v_proposer_community_name
    FROM public.world_communities wc
    WHERE wc.id = NEW.proposed_from_community_id;

  SELECT username INTO v_proposer_username
    FROM public.profiles WHERE id = NEW.proposed_by_user_id;

  IF v_recipient_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (
    v_recipient_user_id,
    'community_link_proposal',
    CASE NEW.link_type
      WHEN 'trade' THEN '💱 Trade route proposed'
      WHEN 'alliance' THEN '🤝 Alliance proposed'
      WHEN 'feud' THEN '⚔️ Feud declared'
      ELSE 'Community link proposed'
    END,
    COALESCE(v_proposer_username, 'Another GM') || ' proposes a '
      || NEW.link_type || ' between "'
      || COALESCE(v_proposer_community_name, 'unknown') || '" and your "'
      || COALESCE(v_recipient_community_name, 'unknown') || '"'
      || CASE WHEN NEW.narrative IS NOT NULL AND length(NEW.narrative) > 0
              THEN ': ' || NEW.narrative ELSE '' END,
    '/communities/' || v_recipient_community_id::text,
    jsonb_build_object(
      'link_id', NEW.id,
      'link_type', NEW.link_type,
      'community_a_id', NEW.community_a_id,
      'community_b_id', NEW.community_b_id,
      'proposed_from_community_id', NEW.proposed_from_community_id,
      'proposer_community_name', v_proposer_community_name,
      'recipient_community_name', v_recipient_community_name,
      'proposer_username', v_proposer_username,
      'narrative', NEW.narrative
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_community_link_notify ON public.world_community_links;
CREATE TRIGGER trg_community_link_notify
  AFTER INSERT ON public.world_community_links
  FOR EACH ROW EXECUTE FUNCTION public.notify_community_link();

-- ── notify_community_link_response() trigger ───────────────────
-- When the recipient flips status from 'pending' → 'active' or
-- 'declined', notify the original proposer. So both sides get a
-- close-the-loop notification.
CREATE OR REPLACE FUNCTION public.notify_community_link_response()
RETURNS trigger AS $$
DECLARE
  v_proposer_user_id uuid;
  v_proposer_community_id uuid;
  v_proposer_community_name text;
  v_recipient_community_name text;
  v_other_id uuid;
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('active', 'declined') THEN
    -- The proposer's notification target.
    v_proposer_user_id := NEW.proposed_by_user_id;
    SELECT wc.name, wc.source_community_id INTO v_proposer_community_name, v_proposer_community_id
      FROM public.world_communities wc WHERE wc.id = NEW.proposed_from_community_id;
    v_other_id := CASE
      WHEN NEW.proposed_from_community_id = NEW.community_a_id THEN NEW.community_b_id
      ELSE NEW.community_a_id
    END;
    SELECT wc.name INTO v_recipient_community_name
      FROM public.world_communities wc WHERE wc.id = v_other_id;

    IF v_proposer_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
      VALUES (
        v_proposer_user_id,
        'community_link_response',
        CASE
          WHEN NEW.status = 'active' THEN '✓ Link accepted'
          ELSE '✗ Link declined'
        END,
        '"' || COALESCE(v_recipient_community_name, 'unknown')
          || '" ' || NEW.status || ' your ' || NEW.link_type
          || ' proposal with "' || COALESCE(v_proposer_community_name, 'unknown') || '"',
        '/communities/' || v_proposer_community_id::text,
        jsonb_build_object(
          'link_id', NEW.id,
          'link_type', NEW.link_type,
          'status', NEW.status,
          'proposer_community_name', v_proposer_community_name,
          'recipient_community_name', v_recipient_community_name
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_community_link_response_notify ON public.world_community_links;
CREATE TRIGGER trg_community_link_response_notify
  AFTER UPDATE OF status ON public.world_community_links
  FOR EACH ROW EXECUTE FUNCTION public.notify_community_link_response();
