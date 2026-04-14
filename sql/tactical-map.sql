-- Tactical map tables for combat scenes and tokens
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS tactical_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Scene',
  background_url text,
  grid_cols integer NOT NULL DEFAULT 20,
  grid_rows integer NOT NULL DEFAULT 15,
  is_active boolean NOT NULL DEFAULT false,
  has_grid boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scene_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid REFERENCES tactical_scenes(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_type text NOT NULL DEFAULT 'npc',
  character_id uuid,
  npc_id uuid,
  portrait_url text,
  grid_x integer NOT NULL DEFAULT 0,
  grid_y integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  color text NOT NULL DEFAULT '#c0392b'
);

ALTER TABLE tactical_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scene_tokens ENABLE ROW LEVEL SECURITY;

-- Campaign members can read scenes and tokens
DROP POLICY IF EXISTS "Members read scenes" ON tactical_scenes;
CREATE POLICY "Members read scenes" ON tactical_scenes FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM campaign_members cm WHERE cm.campaign_id = tactical_scenes.campaign_id AND cm.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM campaigns c WHERE c.id = tactical_scenes.campaign_id AND c.gm_user_id = auth.uid())
  );

-- GM can do everything with scenes
DROP POLICY IF EXISTS "GM manages scenes" ON tactical_scenes;
CREATE POLICY "GM manages scenes" ON tactical_scenes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = tactical_scenes.campaign_id AND c.gm_user_id = auth.uid()));

-- Campaign members can read tokens
DROP POLICY IF EXISTS "Members read tokens" ON scene_tokens;
CREATE POLICY "Members read tokens" ON scene_tokens FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tactical_scenes ts
      JOIN campaign_members cm ON cm.campaign_id = ts.campaign_id
      WHERE ts.id = scene_tokens.scene_id AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM tactical_scenes ts
      JOIN campaigns c ON c.id = ts.campaign_id
      WHERE ts.id = scene_tokens.scene_id AND c.gm_user_id = auth.uid()
    )
  );

-- GM can do everything with tokens
DROP POLICY IF EXISTS "GM manages tokens" ON scene_tokens;
CREATE POLICY "GM manages tokens" ON scene_tokens FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tactical_scenes ts
      JOIN campaigns c ON c.id = ts.campaign_id
      WHERE ts.id = scene_tokens.scene_id AND c.gm_user_id = auth.uid()
    )
  );
