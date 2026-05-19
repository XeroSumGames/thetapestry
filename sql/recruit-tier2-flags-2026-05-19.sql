-- ============================================================
-- Recruit Tier-2 approach-specific Success / Failure flags
-- Per Xero rules-extract Tier-2 cleanup #3 + design Qs answered
-- 2026-05-19. Maps canon outcome ladder to real state, not narrative.
-- ============================================================
--
-- Canon (SRD §08 + CRB ch. 10 p.168-171):
--   * Cohort / Conscript / Convert Success
--     → NPC joins TEMPORARILY (drops at next Morale Check)
--   * Wild Success / HI → permanent commit (unchanged from today)
--   * Conscript Failure → NPC appears to comply but escapes at next
--     opportunity (GM-fired via "Escape Pending" surface)
--   * Convert + Intimidation Failure → NPC permanently rejects the
--     Convert approach (any PC, any future attempt). Other approaches
--     (Cohort) remain available if the story justifies it.
--
-- Phase A of the rollout: schema + flag-setting on save. Phase B will
-- add the morale-tick drainer + GM "Escape Pending" surface. Phase C
-- will gate locked approaches in the Recruit modal.
--
-- Idempotent: re-run safely against any campaign DB.

-- ── community_members: temporary + escape flags ────────────────────
ALTER TABLE public.community_members
  ADD COLUMN IF NOT EXISTS temporary_until_morale BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.community_members
  ADD COLUMN IF NOT EXISTS escape_pending BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.community_members.temporary_until_morale IS
  'Set true on Cohort/Conscript/Convert Success. The morale-check drainer (Phase B) removes the membership at the next Morale Check unless the NPC has been re-secured. Wild Success / HI leave this false = permanent.';

COMMENT ON COLUMN public.community_members.escape_pending IS
  'Set true on Conscript Failure. NPC appears to comply but escapes at first opportunity. The GM "Escape Pending" surface (Phase B) lists these rows so the GM can fire the escape at a story-appropriate juncture.';

-- Index the escape-pending rows so the GM surface fast-filters by
-- community without scanning every member row in the campaign.
CREATE INDEX IF NOT EXISTS idx_community_members_escape_pending
  ON public.community_members(community_id)
  WHERE escape_pending = true;

-- Index the temporary-until-morale rows for the same reason - the
-- morale-tick drainer needs to scan only the flagged rows for the
-- community whose morale check just resolved.
CREATE INDEX IF NOT EXISTS idx_community_members_temporary
  ON public.community_members(community_id)
  WHERE temporary_until_morale = true;

-- ── campaign_npcs: per-NPC recruit-locked-approaches array ─────────
-- Global per NPC (not per PC). Per Xero 2026-05-19: "a PC COULD try
-- a Cohort check, if the story made sense" - meaning only the failed
-- approach is locked, not the NPC entirely. The lock applies to ALL
-- PCs going forward (the NPC has been burned by Intimidation, no
-- matter who tried).
--
-- Array values are RecruitApproach strings: 'cohort' | 'conscript' |
-- 'convert'. Today only 'convert' gets populated (via Convert +
-- Intimidation Failure); the array shape lets us extend to other
-- approach-specific bans later without another schema migration.
ALTER TABLE public.campaign_npcs
  ADD COLUMN IF NOT EXISTS recruit_locked_approaches TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.campaign_npcs.recruit_locked_approaches IS
  'Per-NPC array of approach strings (cohort / conscript / convert) that are permanently locked for future recruit attempts. Populated by the recruit-result handler on terminal failures (today only Convert + Intimidation Failure). The Recruit modal (Phase C) hides locked approaches per NPC.';

-- GIN index for the array containment check the Recruit modal will
-- use to gate approach picker per NPC. Cheap; the array stays small
-- (max 3 elements per NPC) so a btree on the underlying column shape
-- would also work, but GIN is the canonical pick for array filters.
CREATE INDEX IF NOT EXISTS idx_campaign_npcs_recruit_locked_approaches
  ON public.campaign_npcs USING gin(recruit_locked_approaches);

-- ── Verify ────────────────────────────────────────────────────────
-- After apply, both new columns should appear on the respective
-- tables with the documented defaults. Sample:
--   SELECT column_name, data_type, column_default, is_nullable
--   FROM information_schema.columns
--   WHERE table_name IN ('community_members', 'campaign_npcs')
--     AND column_name IN ('temporary_until_morale', 'escape_pending', 'recruit_locked_approaches');
