-- Add equipment column to campaign_npcs for NPC weapon/gear tracking
ALTER TABLE public.campaign_npcs ADD COLUMN IF NOT EXISTS equipment jsonb;
