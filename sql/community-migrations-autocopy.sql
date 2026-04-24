-- Phase E Sprint 4e — close the Migration loop.
--
-- When the target GM accepts a community_migrations row (status flips
-- pending → accepted), this trigger auto-copies the source NPC into
-- the target campaign AND inserts a community_members row in the
-- target community pointing at the new NPC. Closes the gap flagged
-- in testplan.md "Known deferrals".
--
-- Before this migration: the status flipped but nothing propagated —
-- the target GM had to manually add-member after accepting. Testplan
-- Section SPRINT 4e "Known gap" spelled this out.
--
-- After: acceptance is end-to-end. Decline path is unchanged (just
-- flips status to 'declined' and fires the response notification).
--
-- Error handling: wrapped in EXCEPTION so a failed clone doesn't
-- roll back the user's acceptance click. If the clone breaks, the
-- status still lands as 'accepted' and the target GM falls back to
-- the pre-trigger flow (manual add-member). A Postgres NOTICE is
-- raised so we see it in logs without hard-failing the UPDATE.
--
-- Idempotent — drops + recreates function and trigger.

CREATE OR REPLACE FUNCTION public.apply_community_migration_acceptance()
RETURNS trigger AS $$
DECLARE
  v_target_campaign_id uuid;
  v_target_community_id uuid;
  v_new_npc_id uuid;
BEGIN
  -- Only fire on the pending → accepted transition. Decline paths
  -- and late re-edits of the row are ignored.
  IF NOT (OLD.status = 'pending' AND NEW.status = 'accepted') THEN
    RETURN NEW;
  END IF;

  -- If the source NPC was deleted between offer and acceptance,
  -- there's nothing left to clone. Leave status=accepted so the
  -- offerer's notification still fires, but skip the copy.
  IF NEW.source_npc_id IS NULL THEN
    RAISE NOTICE 'community_migration % accepted but source_npc_id is NULL — skipping auto-copy', NEW.id;
    RETURN NEW;
  END IF;

  -- Resolve the target campaign + community from the world row.
  -- If the world row is missing (force-unpublished since the offer
  -- was made), bail.
  SELECT wc.source_campaign_id, wc.source_community_id
    INTO v_target_campaign_id, v_target_community_id
  FROM public.world_communities wc
  WHERE wc.id = NEW.target_world_community_id;

  IF v_target_campaign_id IS NULL OR v_target_community_id IS NULL THEN
    RAISE NOTICE 'community_migration % accepted but target world_community % resolved no campaign/community', NEW.id, NEW.target_world_community_id;
    RETURN NEW;
  END IF;

  BEGIN
    -- Clone the NPC into the target campaign. SELECT ... from the
    -- source row so we get every live column without having to
    -- list them; only overwrite fields that must be different:
    --   * campaign_id = target
    --   * campaign_pin_id = null (the old pin doesn't exist in the
    --     target campaign; leaves the NPC unpinned until the target
    --     GM parks them somewhere)
    --   * wp_current / rp_current reset to their max (fresh start)
    --   * status = 'active'
    --   * sort_order = 9999 (lands at the bottom of the roster)
    INSERT INTO public.campaign_npcs (
      campaign_id, campaign_pin_id, name,
      reason, acumen, physicality, influence, dexterity,
      skills, equipment, notes, motivation,
      portrait_url, npc_type,
      wp_max, rp_max, wp_current, rp_current,
      status, sort_order
    )
    SELECT
      v_target_campaign_id, NULL, name,
      reason, acumen, physicality, influence, dexterity,
      skills, equipment, notes, motivation,
      portrait_url, npc_type,
      wp_max, rp_max, wp_max, rp_max,
      'active', 9999
    FROM public.campaign_npcs
    WHERE id = NEW.source_npc_id
    RETURNING id INTO v_new_npc_id;

    IF v_new_npc_id IS NULL THEN
      RAISE NOTICE 'community_migration % — source NPC % no longer exists', NEW.id, NEW.source_npc_id;
      RETURN NEW;
    END IF;

    -- Insert the target community_members row. Refugee migrants
    -- join as Convert-type (voluntary, seeking shelter / shared
    -- purpose). Role starts unassigned so the target's rebalancer
    -- can place them on next run. Status explicit 'active' so we
    -- don't trip the pending-default schema gap (same pattern as
    -- schism fix in 9182fc9).
    INSERT INTO public.community_members (
      community_id, npc_id, role, recruitment_type, status, joined_at
    )
    VALUES (
      v_target_community_id, v_new_npc_id, 'unassigned', 'convert', 'active', now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'community_migration % auto-copy failed: % (status still accepted)', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_apply_community_migration_acceptance
  ON public.community_migrations;
CREATE TRIGGER trg_apply_community_migration_acceptance
  AFTER UPDATE OF status ON public.community_migrations
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_community_migration_acceptance();
