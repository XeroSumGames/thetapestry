-- Vehicle data stored as JSONB on campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS vehicles jsonb DEFAULT '[]'::jsonb;
