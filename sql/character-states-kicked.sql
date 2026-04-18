-- Add kicked flag to character_states for session kick persistence
ALTER TABLE public.character_states ADD COLUMN IF NOT EXISTS kicked boolean NOT NULL DEFAULT false;
