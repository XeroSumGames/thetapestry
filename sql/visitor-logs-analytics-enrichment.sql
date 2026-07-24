-- Analytics enrichment (2026-07-24): TheTapestry's visitor_logs becomes the
-- unified analytics store for all three sites (tapestry / tableau / table).
-- All columns are additive + nullable, so existing beacons and the current
-- log-visit function keep working unchanged; new data lands as the enriched
-- beacon + function roll out. Legacy rows keep site = NULL (treated as "tapestry"
-- in the dashboard). Idempotent.

ALTER TABLE public.visitor_logs ADD COLUMN IF NOT EXISTS site         text;   -- 'tapestry' | 'tableau' | 'table'
ALTER TABLE public.visitor_logs ADD COLUMN IF NOT EXISTS full_path    text;   -- pathname + query string
ALTER TABLE public.visitor_logs ADD COLUMN IF NOT EXISTS user_agent   text;
ALTER TABLE public.visitor_logs ADD COLUMN IF NOT EXISTS device_type  text;   -- 'mobile' | 'tablet' | 'desktop' | 'bot'
ALTER TABLE public.visitor_logs ADD COLUMN IF NOT EXISTS browser      text;
ALTER TABLE public.visitor_logs ADD COLUMN IF NOT EXISTS os           text;
ALTER TABLE public.visitor_logs ADD COLUMN IF NOT EXISTS screen_w     integer;
ALTER TABLE public.visitor_logs ADD COLUMN IF NOT EXISTS screen_h     integer;
ALTER TABLE public.visitor_logs ADD COLUMN IF NOT EXISTS language     text;
ALTER TABLE public.visitor_logs ADD COLUMN IF NOT EXISTS utm_source   text;
ALTER TABLE public.visitor_logs ADD COLUMN IF NOT EXISTS utm_medium   text;
ALTER TABLE public.visitor_logs ADD COLUMN IF NOT EXISTS utm_campaign text;
ALTER TABLE public.visitor_logs ADD COLUMN IF NOT EXISTS utm_term     text;
ALTER TABLE public.visitor_logs ADD COLUMN IF NOT EXISTS utm_content  text;
-- Dwell / "how long they stayed": filled by an exit beacon that updates the row.
ALTER TABLE public.visitor_logs ADD COLUMN IF NOT EXISTS duration_ms  integer;
ALTER TABLE public.visitor_logs ADD COLUMN IF NOT EXISTS ended_at     timestamptz;

-- Dashboard read paths: by site over time, and by session for dwell/session rollups.
CREATE INDEX IF NOT EXISTS visitor_logs_site_created_idx ON public.visitor_logs (site, created_at DESC);
CREATE INDEX IF NOT EXISTS visitor_logs_session_idx      ON public.visitor_logs (session_id);

NOTIFY pgrst, 'reload schema';
