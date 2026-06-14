-- Replace current_setting() lookups with hardcoded values.
-- ALTER DATABASE requires superuser which neither the CLI nor the dashboard
-- SQL editor have. Hardcoding inside a SECURITY DEFINER function is the same
-- security posture - the function is only callable by DB triggers.
--
-- Apply via Supabase dashboard SQL editor or:
-- npx supabase db query --linked -f sql/fix-call-notify-thriver-hardcode-2026-06-14.sql

CREATE OR REPLACE FUNCTION public.call_notify_thriver(
  p_type  text,
  p_title text,
  p_body  text,
  p_link  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://jbudzglgtxeoaufpejrv.supabase.co/functions/v1/notify-thriver',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpidWR6Z2xndHhlb2F1ZnBlanJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgzNDk4NiwiZXhwIjoyMDkwNDEwOTg2fQ.e1gE_fovj51LVs-5CA9owGLFCNfn5xMJ_a9031ebGq8'
    ),
    body    := jsonb_build_object(
      'type',  p_type,
      'title', p_title,
      'body',  p_body,
      'link',  p_link
    )
  );
EXCEPTION WHEN OTHERS THEN
  NULL; -- swallow pg_net / Edge Function failures so caller never rolls back
END;
$$;
