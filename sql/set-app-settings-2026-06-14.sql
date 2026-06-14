-- Wire the app.settings that call_notify_thriver() reads at runtime.
-- Without these, current_setting() returns NULL, the pg_net URL becomes
-- "null/functions/v1/notify-thriver", and ALL notifications (bug reports,
-- moderation events, war stories, etc.) silently fail.
ALTER DATABASE postgres SET "app.settings.supabase_url" = 'https://jbudzglgtxeoaufpejrv.supabase.co';
ALTER DATABASE postgres SET "app.settings.service_role_key" = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpidWR6Z2xndHhlb2F1ZnBlanJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgzNDk4NiwiZXhwIjoyMDkwNDEwOTg2fQ.e1gE_fovj51LVs-5CA9owGLFCNfn5xMJ_a9031ebGq8';
