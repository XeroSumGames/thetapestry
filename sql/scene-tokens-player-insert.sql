-- ============================================================
-- Allow players to place their own token on the tactical map
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================

-- Players can INSERT tokens for their own character
DROP POLICY IF EXISTS "Players place own token" ON scene_tokens;
CREATE POLICY "Players place own token" ON scene_tokens FOR INSERT TO authenticated
  WITH CHECK (
    -- Must be a PC token with a character_id
    token_type = 'pc'
    AND character_id IS NOT NULL
    -- The scene must belong to a campaign the player is in
    AND EXISTS (
      SELECT 1 FROM tactical_scenes ts
      JOIN campaign_members cm ON cm.campaign_id = ts.campaign_id
      WHERE ts.id = scene_tokens.scene_id
        AND cm.user_id = auth.uid()
        AND cm.character_id = scene_tokens.character_id
    )
  );

-- Players can UPDATE their own token position (for Move action)
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
  );
