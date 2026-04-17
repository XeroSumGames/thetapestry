-- Link campaign pins to tactical scenes
ALTER TABLE public.campaign_pins ADD COLUMN IF NOT EXISTS tactical_scene_id uuid REFERENCES public.tactical_scenes(id) ON DELETE SET NULL;
