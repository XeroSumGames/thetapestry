-- Add sort_order to scene_tokens for persistent object ordering in sidebar
ALTER TABLE public.scene_tokens ADD COLUMN IF NOT EXISTS sort_order integer;
