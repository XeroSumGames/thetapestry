-- Add event_date to map_pins for timeline pins
ALTER TABLE public.map_pins ADD COLUMN IF NOT EXISTS event_date text;
