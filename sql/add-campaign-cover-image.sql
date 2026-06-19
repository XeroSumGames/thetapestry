-- Add cover_image_url to campaigns table.
-- Backward-compatible nullable column; NULL = no custom cover (inherits
-- module cover or shows placeholder).

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Storage bucket for campaign cover images.
-- Public bucket - reads are open; writes are gated below.
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-covers', 'campaign-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload (app code enforces GM check).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'campaign-covers insert'
  ) THEN
    CREATE POLICY "campaign-covers insert"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'campaign-covers' AND auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'campaign-covers update'
  ) THEN
    CREATE POLICY "campaign-covers update"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'campaign-covers' AND auth.role() = 'authenticated');
  END IF;
END $$;
