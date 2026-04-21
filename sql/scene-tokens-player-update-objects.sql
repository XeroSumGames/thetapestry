-- ============================================================
-- Fix: players couldn't damage destructible object tokens (barrels, crates, etc.)
--
-- Existing player UPDATE policy on scene_tokens only allowed updates to
-- their own PC token (token_type='pc' AND character_id matches). When a
-- player attacked a barrel, the wp_current update was silently rejected
-- by RLS (0 rows affected, no error) and the barrel took no damage.
--
-- This adds a separate UPDATE policy for token_type='object' tokens in
-- scenes of campaigns the player is a member of. GMs already have a
-- blanket policy so they're unaffected.
--
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================

DROP POLICY IF EXISTS "Members damage object tokens" ON scene_tokens;
CREATE POLICY "Members damage object tokens" ON scene_tokens FOR UPDATE TO authenticated
  USING (
    token_type = 'object'
    AND EXISTS (
      SELECT 1 FROM tactical_scenes ts
      JOIN campaign_members cm ON cm.campaign_id = ts.campaign_id
      WHERE ts.id = scene_tokens.scene_id
        AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    token_type = 'object'
    AND EXISTS (
      SELECT 1 FROM tactical_scenes ts
      JOIN campaign_members cm ON cm.campaign_id = ts.campaign_id
      WHERE ts.id = scene_tokens.scene_id
        AND cm.user_id = auth.uid()
    )
  );
