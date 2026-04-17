-- Add grappled_by column to initiative_order for grapple state tracking
-- Stores the character_name of the grappler. NULL = not grappled.
ALTER TABLE public.initiative_order ADD COLUMN IF NOT EXISTS grappled_by text;
