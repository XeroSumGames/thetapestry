-- Add folder column to campaign_npcs for NPC organization
ALTER TABLE public.campaign_npcs ADD COLUMN IF NOT EXISTS folder text;
