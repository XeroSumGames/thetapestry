SELECT column_name FROM information_schema.columns WHERE table_schema = 'net' AND table_name = '_http_response';

SELECT current_setting('app.settings.supabase_url', true) AS supabase_url;
