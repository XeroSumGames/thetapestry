-- ============================================================
-- THRIVER GODMODE — app-level superuser across all major tables
-- ============================================================
--
-- The Thriver role (currently just Xero) is the app admin. They
-- need unconditional read/write/delete access across every
-- user-campaign table so they can moderate, repair, relocate,
-- and clean up any stray data without needing to be the GM of
-- the relevant campaign.
--
-- Strategy: one helper function `public.is_thriver()` + one
-- additive FOR ALL policy per table. The policies are ADDITIVE —
-- Postgres allows the action if ANY matching policy passes. The
-- existing GM/member/owner policies stay untouched, so non-Thriver
-- behavior is unchanged.
--
-- Naming convention: `<table>_thriver_bypass` so the policies are
-- easy to find and drop later if scope changes.
--
-- Idempotent. Safe to re-run — each policy is DROP'd then recreated.
--
-- NOTE: campaign_pins already has a dedicated Thriver bypass in
-- sql/campaign-pins-rls-thriver-bypass.sql. This file deliberately
-- does NOT touch that table to avoid a duplicate policy name.
-- ============================================================

-- ── 1. Helper function ────────────────────────────────────────
-- STABLE so the query planner can inline it and memoize per-query.
-- SECURITY DEFINER so the profile lookup works even if the caller's
-- RLS on `profiles` would otherwise hide their own row (shouldn't,
-- but belt and suspenders).
CREATE OR REPLACE FUNCTION public.is_thriver()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'Thriver'
  );
$$;

-- Grant execute to authenticated role so policies can call it.
GRANT EXECUTE ON FUNCTION public.is_thriver() TO authenticated;


-- ── 2. Per-table bypass policies ─────────────────────────────
-- Each block: DROP IF EXISTS → CREATE FOR ALL USING is_thriver().
-- Tables grouped by concern for easy scanning.

-- 2a. Campaigns & members ────────────────────────────────────
DROP POLICY IF EXISTS campaigns_thriver_bypass ON public.campaigns;
CREATE POLICY campaigns_thriver_bypass ON public.campaigns
  FOR ALL TO authenticated
  USING (public.is_thriver()) WITH CHECK (public.is_thriver());

DROP POLICY IF EXISTS campaign_members_thriver_bypass ON public.campaign_members;
CREATE POLICY campaign_members_thriver_bypass ON public.campaign_members
  FOR ALL TO authenticated
  USING (public.is_thriver()) WITH CHECK (public.is_thriver());

DROP POLICY IF EXISTS campaign_npcs_thriver_bypass ON public.campaign_npcs;
CREATE POLICY campaign_npcs_thriver_bypass ON public.campaign_npcs
  FOR ALL TO authenticated
  USING (public.is_thriver()) WITH CHECK (public.is_thriver());

DROP POLICY IF EXISTS campaign_snapshots_thriver_bypass ON public.campaign_snapshots;
CREATE POLICY campaign_snapshots_thriver_bypass ON public.campaign_snapshots
  FOR ALL TO authenticated
  USING (public.is_thriver()) WITH CHECK (public.is_thriver());

-- 2b. Characters & state ─────────────────────────────────────
DROP POLICY IF EXISTS characters_thriver_bypass ON public.characters;
CREATE POLICY characters_thriver_bypass ON public.characters
  FOR ALL TO authenticated
  USING (public.is_thriver()) WITH CHECK (public.is_thriver());

DROP POLICY IF EXISTS character_states_thriver_bypass ON public.character_states;
CREATE POLICY character_states_thriver_bypass ON public.character_states
  FOR ALL TO authenticated
  USING (public.is_thriver()) WITH CHECK (public.is_thriver());

DROP POLICY IF EXISTS npc_relationships_thriver_bypass ON public.npc_relationships;
CREATE POLICY npc_relationships_thriver_bypass ON public.npc_relationships
  FOR ALL TO authenticated
  USING (public.is_thriver()) WITH CHECK (public.is_thriver());

-- 2c. Tactical map ───────────────────────────────────────────
DROP POLICY IF EXISTS tactical_scenes_thriver_bypass ON public.tactical_scenes;
CREATE POLICY tactical_scenes_thriver_bypass ON public.tactical_scenes
  FOR ALL TO authenticated
  USING (public.is_thriver()) WITH CHECK (public.is_thriver());

DROP POLICY IF EXISTS scene_tokens_thriver_bypass ON public.scene_tokens;
CREATE POLICY scene_tokens_thriver_bypass ON public.scene_tokens
  FOR ALL TO authenticated
  USING (public.is_thriver()) WITH CHECK (public.is_thriver());

DROP POLICY IF EXISTS initiative_order_thriver_bypass ON public.initiative_order;
CREATE POLICY initiative_order_thriver_bypass ON public.initiative_order
  FOR ALL TO authenticated
  USING (public.is_thriver()) WITH CHECK (public.is_thriver());

-- 2d. Communities ────────────────────────────────────────────
DROP POLICY IF EXISTS communities_thriver_bypass ON public.communities;
CREATE POLICY communities_thriver_bypass ON public.communities
  FOR ALL TO authenticated
  USING (public.is_thriver()) WITH CHECK (public.is_thriver());

DROP POLICY IF EXISTS community_members_thriver_bypass ON public.community_members;
CREATE POLICY community_members_thriver_bypass ON public.community_members
  FOR ALL TO authenticated
  USING (public.is_thriver()) WITH CHECK (public.is_thriver());

DROP POLICY IF EXISTS community_morale_thriver_bypass ON public.community_morale_checks;
CREATE POLICY community_morale_thriver_bypass ON public.community_morale_checks
  FOR ALL TO authenticated
  USING (public.is_thriver()) WITH CHECK (public.is_thriver());

DROP POLICY IF EXISTS community_resource_thriver_bypass ON public.community_resource_checks;
CREATE POLICY community_resource_thriver_bypass ON public.community_resource_checks
  FOR ALL TO authenticated
  USING (public.is_thriver()) WITH CHECK (public.is_thriver());

-- 2e. Sessions & logs ────────────────────────────────────────
DROP POLICY IF EXISTS sessions_thriver_bypass ON public.sessions;
CREATE POLICY sessions_thriver_bypass ON public.sessions
  FOR ALL TO authenticated
  USING (public.is_thriver()) WITH CHECK (public.is_thriver());

DROP POLICY IF EXISTS roll_log_thriver_bypass ON public.roll_log;
CREATE POLICY roll_log_thriver_bypass ON public.roll_log
  FOR ALL TO authenticated
  USING (public.is_thriver()) WITH CHECK (public.is_thriver());

DROP POLICY IF EXISTS player_notes_thriver_bypass ON public.player_notes;
CREATE POLICY player_notes_thriver_bypass ON public.player_notes
  FOR ALL TO authenticated
  USING (public.is_thriver()) WITH CHECK (public.is_thriver());

-- GM notes live in campaign_notes (both GM notes + player handouts —
-- the component is called GmNotes.tsx but the table is campaign_notes).
DROP POLICY IF EXISTS campaign_notes_thriver_bypass ON public.campaign_notes;
CREATE POLICY campaign_notes_thriver_bypass ON public.campaign_notes
  FOR ALL TO authenticated
  USING (public.is_thriver()) WITH CHECK (public.is_thriver());

-- 2f. World map ──────────────────────────────────────────────
DROP POLICY IF EXISTS map_pins_thriver_bypass ON public.map_pins;
CREATE POLICY map_pins_thriver_bypass ON public.map_pins
  FOR ALL TO authenticated
  USING (public.is_thriver()) WITH CHECK (public.is_thriver());

-- 2g. Profile & notifications ────────────────────────────────
-- Profile bypass is the biggest-trust policy — a Thriver can edit
-- any user's username, email, role (including demoting other Thrivers
-- or themselves). That's the explicit "Godmode" intent.
DROP POLICY IF EXISTS profiles_thriver_bypass ON public.profiles;
CREATE POLICY profiles_thriver_bypass ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_thriver()) WITH CHECK (public.is_thriver());

DROP POLICY IF EXISTS notifications_thriver_bypass ON public.notifications;
CREATE POLICY notifications_thriver_bypass ON public.notifications
  FOR ALL TO authenticated
  USING (public.is_thriver()) WITH CHECK (public.is_thriver());


-- ── 3. Diagnostic ────────────────────────────────────────────
-- Run this to list every Thriver bypass currently in place:
--
-- SELECT polname, pg_get_expr(polqual, polrelid) AS using_expr
-- FROM pg_policy
-- WHERE polname LIKE '%thriver_bypass%'
-- ORDER BY polrelid::regclass::text, polname;
--
-- Expected: one row per table listed above. If any is missing, the
-- CREATE may have failed silently because the TABLE doesn't exist
-- in your schema yet — skip that table or adjust the migration.
