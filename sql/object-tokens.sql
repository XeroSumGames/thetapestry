-- ============================================================
-- Object Tokens — destructible environmental objects on tactical map
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================

-- Add WP columns to scene_tokens for destructible objects
ALTER TABLE public.scene_tokens
  ADD COLUMN IF NOT EXISTS wp_max integer,
  ADD COLUMN IF NOT EXISTS wp_current integer;

-- Storage bucket for custom object token images
INSERT INTO storage.buckets (id, name, public)
  VALUES ('object-tokens', 'object-tokens', true)
  ON CONFLICT (id) DO NOTHING;

-- Anyone can read object token images
DROP POLICY IF EXISTS "Anyone reads object tokens" ON storage.objects;
CREATE POLICY "Anyone reads object tokens"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'object-tokens');

-- Authenticated users can upload
DROP POLICY IF EXISTS "Users upload object tokens" ON storage.objects;
CREATE POLICY "Users upload object tokens"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'object-tokens');
