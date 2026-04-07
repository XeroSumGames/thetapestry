-- Add geo columns to visitor_logs
ALTER TABLE visitor_logs ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE visitor_logs ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE visitor_logs ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE visitor_logs ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE visitor_logs ADD COLUMN IF NOT EXISTS longitude numeric;
