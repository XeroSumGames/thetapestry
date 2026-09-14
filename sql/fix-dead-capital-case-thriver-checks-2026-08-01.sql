-- Fix: 5 policies across 4 tables compare profiles.role = 'Thriver'
-- (capital-case). profiles.role is auto-lowercased by trg_normalize_role
-- (see AGENTS.md's role-literal rule + tasks/lessons.md), so this
-- comparison can never match any real row - dead code, not an
-- over-grant. Found via a full-schema grep for the literal during the
-- 2026-08-01 audit's map_pins fix (flagged as LOW at the time, not
-- fixed); swept the rest of the schema for the same literal just now.
--
-- Two of the five are pure redundancy (map_pins already has a working
-- map_pins_thriver_bypass FOR ALL policy using is_thriver(), so "Delete
-- pins"/"Update pins"/"View pins" being broken never mattered in
-- practice). The other three are meaningfully broken - no other Thriver
-- bypass exists for campaign_pins, world_npcs, or user_events, so
-- Thrivers currently cannot moderate campaign pins, moderate submitted
-- world NPCs, or read other users' events at all, despite the policy
-- names promising exactly that.
--
-- Fix: lower(role) = 'thriver' in all five, verbatim otherwise.

BEGIN;

DROP POLICY IF EXISTS "Thrivers can manage campaign pins" ON public.campaign_pins;
CREATE POLICY "Thrivers can manage campaign pins" ON public.campaign_pins
  AS PERMISSIVE FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'thriver'));

DROP POLICY IF EXISTS "Delete pins" ON public.map_pins;
CREATE POLICY "Delete pins" ON public.map_pins
  AS PERMISSIVE FOR DELETE TO public
  USING (auth.uid() = user_id OR auth.uid() IN (SELECT profiles.id FROM profiles WHERE lower(profiles.role) = 'thriver'));

DROP POLICY IF EXISTS "Update pins" ON public.map_pins;
CREATE POLICY "Update pins" ON public.map_pins
  AS PERMISSIVE FOR UPDATE TO public
  USING (auth.uid() = user_id OR auth.uid() IN (SELECT profiles.id FROM profiles WHERE lower(profiles.role) = 'thriver'));

DROP POLICY IF EXISTS "View pins" ON public.map_pins;
CREATE POLICY "View pins" ON public.map_pins
  AS PERMISSIVE FOR SELECT TO public
  USING (auth.uid() = user_id OR status = 'approved' OR auth.uid() IN (SELECT profiles.id FROM profiles WHERE lower(profiles.role) = 'thriver'));

DROP POLICY IF EXISTS "Thrivers can moderate world NPCs" ON public.world_npcs;
CREATE POLICY "Thrivers can moderate world NPCs" ON public.world_npcs
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND lower(profiles.role) = 'thriver'));

DROP POLICY IF EXISTS "Thrivers can read all events" ON public.user_events;
CREATE POLICY "Thrivers can read all events" ON public.user_events
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND lower(profiles.role) = 'thriver')) OR user_id = auth.uid());

COMMIT;
