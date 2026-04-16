-- ============================================================
-- Fix: player token UPDATE policy needs WITH CHECK clause
-- Without it, Supabase silently rejects the update (0 rows affected).
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================

-- Drop and recreate with both USING and WITH CHECK
DROP POLICY IF EXISTS "Players move own token" ON scene_tokens;
CREATE POLICY "Players move own token" ON scene_tokens FOR UPDATE TO authenticated
  USING (
    token_type = 'pc'
    AND character_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM tactical_scenes ts
      JOIN campaign_members cm ON cm.campaign_id = ts.campaign_id
      WHERE ts.id = scene_tokens.scene_id
        AND cm.user_id = auth.uid()
        AND cm.character_id = scene_tokens.character_id
    )
  )
  WITH CHECK (
    token_type = 'pc'
    AND character_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM tactical_scenes ts
      JOIN campaign_members cm ON cm.campaign_id = ts.campaign_id
      WHERE ts.id = scene_tokens.scene_id
        AND cm.user_id = auth.uid()
        AND cm.character_id = scene_tokens.character_id
    )
  );
