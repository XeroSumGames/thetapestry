-- Add play_time text column to modules for flexible duration display
-- ("60-90 min", "1 session", "6-12 sessions", etc.)
-- Apply: npx supabase db query --linked -f sql/modules-play-time-2026-06-12.sql

ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS play_time text;
