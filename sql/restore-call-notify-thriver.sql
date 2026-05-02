-- restore-call-notify-thriver.sql
-- The notify_new_survivor trigger PERFORMs call_notify_thriver(...) on
-- every profiles INSERT. The function went missing on the live DB
-- (likely got dropped manually), so signup was failing with
-- "function public.call_notify_thriver(unknown, unknown, text, unknown)
-- does not exist." Restoring the canonical definition from
-- sql/pass4-triggers-with-email.sql.
--
-- Function body fans out to the notify-thriver Edge Function via
-- pg_net. Wrapped in EXCEPTION WHEN OTHERS THEN NULL so a missing
-- pg_net config / Edge Function failure never breaks the parent
-- transaction (signup, pin submit, etc.). Idempotent — CREATE OR
-- REPLACE.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.call_notify_thriver(
  p_type text,
  p_title text,
  p_body text,
  p_link text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/notify-thriver',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'type', p_type,
      'title', p_title,
      'body', p_body,
      'link', p_link
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Silently swallow pg_net / Edge Function failures so the parent
  -- transaction (the signup that triggered us) doesn't roll back.
  NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
